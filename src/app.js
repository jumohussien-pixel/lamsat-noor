/**
 * لمسة نور — Main Application Controller
 * Mobile Portrait PWA built exclusively for blind & low-vision children.
 */

import { LaserScannerEngine } from './laser-scanner-engine.js';
import { VisionEngine, createDemoDetection } from './vision-engine.js';
import { ArabicVoiceCoach } from './arabic-voice-coach.js';
import { ARABIC_SPEECH_CONFIG } from '../agent_skills/arabic-web-speech/arabic-speech-config.js';
import {
  loadSavedAppState,
  saveAppState,
  retrySafely,
  installAppSafetyGuards,
} from './safety-storage.js';
import { ScreenWakeLockManager } from './screen-wake-lock.js';

const DOM = {
  welcomeScreen: document.getElementById('welcomeScreen'),
  btnWelcomeStart: document.getElementById('btnWelcomeStart'),
  mainApp: document.getElementById('mainApp'),
  btnGoHome: document.getElementById('btnGoHome'),
  viewportFrame: document.getElementById('viewportFrame'),
  videoFeed: document.getElementById('videoFeed'),
  laserCanvas: document.getElementById('laserCanvas'),
  startOverlay: document.getElementById('startOverlay'),
  btnStartLaser: document.getElementById('btnStartLaser'),
  btnTorch: document.getElementById('btnTorch'),
  btnMute: document.getElementById('btnMute'),
  btnScanNow: document.getElementById('btnScanNow'),
  btnRepeatNow: document.getElementById('btnRepeatNow'),
  btnNextObject: document.getElementById('btnNextObject'),
  statusText: document.getElementById('statusText'),
  colorSwatch: document.getElementById('colorSwatch'),
  colorNameLabel: document.getElementById('colorNameLabel'),
  spokenSentence: document.getElementById('spokenSentence'),
  sensoryHint: document.getElementById('sensoryHint'),
  speechFeedbackBox: document.getElementById('speechFeedbackBox'),
  micIndicator: document.getElementById('micIndicator'),
  childSpeechText: document.getElementById('childSpeechText'),
  turnActions: document.getElementById('turnActions'),
  btnChildSaidRight: document.getElementById('btnChildSaidRight'),
  btnSkipRepeat: document.getElementById('btnSkipRepeat'),
  starsCount: document.getElementById('starsCount'),
  historyCount: document.getElementById('historyCount'),
  historyList: document.getElementById('historyList'),
  demoButtons: document.querySelectorAll('[data-demo]'),
};

const laser = new LaserScannerEngine();
const vision = new VisionEngine();
const voice = new ArabicVoiceCoach();
const wakeLock = new ScreenWakeLockManager();

const appState = {
  screen: 'welcome', // welcome | main
  phase: 'IDLE', // IDLE | SCANNING | LOCKED | LISTENING | DANGER
  cameraActive: false,
  currentProximity: 0.18,
  currentTarget: null,
  lastCompletedSignature: null,
  lastCompletedTime: 0,
  lastScanTime: 0,
  sawMotionRecently: false,
  steadyTicks: 0,
  lastGuidanceTime: 0,
  lastLowLightTime: 0,
  lastNetWarningTime: 0,
  lastTapTime: 0,
  stars: 0,
  history: [],
  rafId: null,
  detectTimerId: null,
  cycleId: 0,
  pendingDecision: null,
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const isCurrent = (cycle) => cycle === appState.cycleId;

function persistNow() {
  saveAppState({
    stars: appState.stars,
    history: appState.history,
    muted: voice.isMuted,
    screen: appState.screen,
    lastTarget: appState.currentTarget,
  });
}

function renderHistoryList() {
  DOM.historyCount.textContent =
    appState.history.length === 1 ? 'شيء واحد' : `${appState.history.length} أشياء`;

  DOM.historyList.innerHTML = '';
  if (!appState.history.length) {
    const empty = document.createElement('li');
    empty.className = 'history-empty';
    empty.textContent = 'لم يتم اكتشاف أي شيء بعد.';
    DOM.historyList.appendChild(empty);
    return;
  }

  appState.history.forEach((item) => {
    const li = document.createElement('li');
    li.className = 'history-item';
    const left = document.createElement('span');
    left.textContent = `${item.repeatedOk ? '★ ' : ''}${item.label}`;
    const right = document.createElement('span');
    right.style.color = '#b6c6d8';
    right.style.fontSize = '0.9rem';
    right.textContent = item.timeStr || '';
    li.appendChild(left);
    li.appendChild(right);
    DOM.historyList.appendChild(li);
  });
}

function setPhase(phase, statusMessage) {
  appState.phase = phase;
  if (DOM.viewportFrame) DOM.viewportFrame.dataset.state = phase;
  if (statusMessage && DOM.statusText) DOM.statusText.textContent = statusMessage;
}

function setMicUI(listening) {
  DOM.speechFeedbackBox.dataset.listening = String(listening);
  DOM.micIndicator.textContent = listening ? 'الميكروفون يستمع' : 'الميكروفون مغلق';
}

function showTurnActions(show) {
  DOM.turnActions.hidden = !show;
}

function resolvePendingDecision(value) {
  if (appState.pendingDecision) {
    const resolver = appState.pendingDecision;
    appState.pendingDecision = null;
    resolver(value);
  }
}

function waitForTeacherDecision() {
  resolvePendingDecision('none');
  return new Promise((resolve) => {
    appState.pendingDecision = resolve;
  });
}

function cancelActiveCycle() {
  appState.cycleId += 1;
  voice.stopAll();
  resolvePendingDecision('cancelled');
  setMicUI(false);
  showTurnActions(false);
}

function syncCanvasSize() {
  const rect = DOM.viewportFrame.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  if (DOM.laserCanvas.width !== Math.round(rect.width)) DOM.laserCanvas.width = Math.round(rect.width);
  if (DOM.laserCanvas.height !== Math.round(rect.height)) DOM.laserCanvas.height = Math.round(rect.height);
}

function renderOverlayLoop() {
  try {
    syncCanvasSize();
    const drawState = appState.phase === 'IDLE' ? 'SCANNING' : appState.phase;
    laser.drawLaserOverlay(DOM.laserCanvas, drawState, null);
  } catch {
    // Keep animation loop crash-free
  }
  appState.rafId = requestAnimationFrame(renderOverlayLoop);
}

function updateResultUI(detection) {
  if (!detection) return;
  DOM.colorSwatch.style.backgroundColor = detection.colorHex || '#94A3B8';
  DOM.colorNameLabel.textContent = detection.isDanger
    ? `تنبيه أمان: ${detection.objectName}`
    : `${detection.objectName} — اللون: ${detection.colorName}`;
  DOM.spokenSentence.textContent = detection.sentence || '';
  DOM.sensoryHint.textContent = detection.sensoryHint || '';
  DOM.btnRepeatNow.disabled = Boolean(detection.isDanger);
  DOM.btnNextObject.disabled = false;
}

function addDiscoveryToHistory(detection, repeatedOk) {
  if (!detection || detection.isDanger) return;
  const timeStr = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

  appState.history.unshift({
    label: `${detection.objectName} (${detection.colorName})`,
    repeatedOk,
    timeStr,
  });
  if (appState.history.length > 30) appState.history.pop();

  renderHistoryList();
  persistNow();
}

function awardStar() {
  appState.stars += 1;
  DOM.starsCount.textContent = String(appState.stars);
  persistNow();
}

function showMainScreen() {
  appState.screen = 'main';
  if (DOM.welcomeScreen) DOM.welcomeScreen.hidden = true;
  if (DOM.mainApp) DOM.mainApp.hidden = false;
  syncCanvasSize();
  persistNow();
}

function stopCameraSafely() {
  if (appState.detectTimerId) {
    clearInterval(appState.detectTimerId);
    appState.detectTimerId = null;
  }
  laser.stopCamera();
  wakeLock.release();
  vision.resetFrameCache();
  appState.cameraActive = false;
  DOM.startOverlay.classList.remove('hidden');
  DOM.btnStartLaser.disabled = false;
  DOM.btnStartLaser.textContent = 'افتح الكاميرا الآن';
  DOM.btnScanNow.disabled = true;
}

function showWelcomeScreen(stopCameraToo = false, announce = false) {
  cancelActiveCycle();
  laser.stopSonarLoop();
  if (stopCameraToo) {
    stopCameraSafely();
  }
  appState.screen = 'welcome';
  if (DOM.mainApp) DOM.mainApp.hidden = true;
  if (DOM.welcomeScreen) DOM.welcomeScreen.hidden = false;
  persistNow();

  if (announce) {
    voice.speak('عدنا إلى الصفحة الرئيسية في لمسة نور. اضغط ابدأ للمتابعة.', 'kids');
  }
}

function restoreSavedState() {
  const saved = loadSavedAppState();
  appState.stars = saved.stars;
  appState.history = saved.history;
  appState.screen = saved.screen;
  appState.currentTarget = saved.lastTarget;

  voice.isMuted = saved.muted;
  laser.isMuted = saved.muted;

  DOM.starsCount.textContent = String(appState.stars);
  renderHistoryList();

  DOM.btnMute.setAttribute('aria-pressed', String(saved.muted));
  DOM.btnMute.textContent = saved.muted ? 'الصوت مكتوم' : 'الصوت يعمل';

  if (appState.currentTarget) {
    updateResultUI(appState.currentTarget);
  }

  if (appState.screen === 'main') {
    showMainScreen();
  } else {
    if (DOM.welcomeScreen) DOM.welcomeScreen.hidden = false;
    if (DOM.mainApp) DOM.mainApp.hidden = true;
  }
}

async function teacherConfirmFlow(myCycle, reason) {
  const reasonText =
    reason === 'denied'
      ? 'الميكروفون غير مسموح به. اسمح به من إعدادات المتصفح، أو اضغط «قالها صح» بعد أن يكرر الطفل.'
      : 'هذا المتصفح لا يدعم التعرف على الصوت. افتح «لمسة نور» في Chrome أو Edge، أو اضغط «قالها صح» بعد أن يكرر الطفل.';

  setPhase('LISTENING', 'بانتظار تكرار الطفل');
  DOM.childSpeechText.textContent = reasonText;
  showTurnActions(true);
  const decision = await waitForTeacherDecision();
  showTurnActions(false);

  if (!isCurrent(myCycle) || decision === 'cancelled') return { cancelled: true };
  return decision === 'right' ? { success: true, heard: '' } : { success: false, skipped: true };
}

async function runRepeatCoaching(detection, myCycle) {
  const maxAttempts = ARABIC_SPEECH_CONFIG.maxRepeatAttempts;
  let prompt = `دورك الآن يا بطل. قل ورائي: ${detection.repeatTarget}.`;

  const micReady = voice.supportsListening() && (await voice.ensureMicPermission());
  if (!isCurrent(myCycle)) return { cancelled: true };

  if (!micReady) {
    setPhase('LOCKED', 'استمع جيداً...');
    await voice.speak(prompt, 'kids');
    if (!isCurrent(myCycle)) return { cancelled: true };
    return teacherConfirmFlow(myCycle, voice.supportsListening() ? 'denied' : 'unsupported');
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    setPhase('LOCKED', 'استمع جيداً...');
    await voice.speak(prompt, 'kids');
    if (!isCurrent(myCycle)) return { cancelled: true };

    setPhase('LISTENING', `دورك الآن — المحاولة ${attempt} من ${maxAttempts}`);
    laser.playListeningChime();
    setMicUI(true);
    showTurnActions(true);
    DOM.childSpeechText.textContent = 'أنا أستمع إليك... تكلّم الآن';

    const decisionPromise = waitForTeacherDecision();
    const listenPromise = voice.listen({
      onInterim: (text) => {
        if (isCurrent(myCycle)) DOM.childSpeechText.textContent = text;
      },
    });

    const first = await Promise.race([
      listenPromise.then((result) => ({ kind: 'listen', result })),
      decisionPromise.then((decision) => ({ kind: 'decision', decision })),
    ]);

    setMicUI(false);
    showTurnActions(false);
    if (!isCurrent(myCycle)) return { cancelled: true };

    if (first.kind === 'decision') {
      voice.cancelListening();
      if (first.decision === 'right') return { success: true, heard: '' };
      if (first.decision === 'skip') return { success: false, skipped: true };
      return { cancelled: true };
    }
    resolvePendingDecision('none');

    const { result } = first;
    if (result.status === 'cancelled') return { cancelled: true };
    if (['denied', 'network', 'unsupported', 'error'].includes(result.status)) {
      return teacherConfirmFlow(myCycle, result.status === 'denied' ? 'denied' : 'unsupported');
    }

    const verdict = voice.evaluate(result, detection);
    if (verdict === 'exact' || verdict === 'object') {
      return { success: true, heard: result.transcript, verdict };
    }

    DOM.childSpeechText.textContent = result.transcript
      ? `سمعت: «${result.transcript}»`
      : 'لم أسمع صوتاً بعد';

    if (verdict === 'color') {
      prompt = `أحسنت، قلت اللون صح! والآن قل اسم الشيء: ${detection.objectName}.`;
    } else if (verdict === 'wrong') {
      prompt = `سمعتك يا بطل، محاولة جميلة! هيا نقولها معاً ببطء: ${detection.repeatTarget}.`;
    } else {
      prompt = `أنا منتظرك يا بطل، خذ وقتك. قل: ${detection.repeatTarget}.`;
    }
  }

  return { success: false };
}

async function handleDetectedObject(detection, options = { isDemo: false }) {
  cancelActiveCycle();
  const myCycle = appState.cycleId;
  laser.stopSonarLoop();

  appState.currentTarget = detection;
  DOM.childSpeechText.textContent = '—';
  updateResultUI(detection);
  persistNow();

  const finishCycle = async (repeatedOk) => {
    addDiscoveryToHistory(detection, repeatedOk);
    appState.lastCompletedSignature = `${detection.className}_${detection.colorKey}`;
    appState.lastCompletedTime = Date.now();

    if (appState.cameraActive) {
      await voice.speak('ضع شيئاً جديداً أمام لمسة نور.', 'kids');
      if (!isCurrent(myCycle)) return;
      resumeScanning(false);
    } else if (options.isDemo) {
      setPhase('IDLE', 'جاهز لمثال جديد أو لفتح الكاميرا');
    }
  };

  // 1. Safety Shield
  if (detection.isDanger) {
    setPhase('DANGER', 'تنبيه أمان فوري');
    laser.playSafetyAlertSound();
    await voice.speak(detection.sentence, 'kids');
    if (!isCurrent(myCycle)) return;
    appState.lastCompletedSignature = `${detection.className}_${detection.colorKey}`;
    appState.lastCompletedTime = Date.now();
    await delay(1400);
    if (!isCurrent(myCycle)) return;
    if (appState.cameraActive) resumeScanning(false);
    else setPhase('IDLE', 'جاهز لمثال جديد أو لفتح الكاميرا');
    return;
  }

  // 2. Lock & announce
  setPhase('LOCKED', 'تم رصد الشيء');
  laser.playLockSound();
  await delay(350);
  if (!isCurrent(myCycle)) return;

  const intro = detection.sensoryHint
    ? `${detection.sentence} ${detection.sensoryHint}`
    : detection.sentence;
  await voice.speak(intro, 'kids');
  if (!isCurrent(myCycle)) return;

  // 3. Patient listening turn
  const outcome = await runRepeatCoaching(detection, myCycle);
  if (outcome.cancelled || !isCurrent(myCycle)) return;

  // 4. Praise or gentle encouragement
  if (outcome.success) {
    setPhase('LOCKED', 'شاطر! قلتها صح');
    DOM.childSpeechText.textContent = outcome.heard
      ? `«${outcome.heard}» — شاطر! قلتها صح`
      : 'شاطر! قلتها صح';
    laser.playCelebrationSound();
    awardStar();
    await delay(600);
    if (!isCurrent(myCycle)) return;
    await voice.speak(
      `شاطر! أنت قلت صح: ${detection.repeatTarget}. أحسنت يا بطل، وحصلت على نجمة جديدة. ${detection.funFact}`,
      'kids'
    );
  } else if (outcome.skipped) {
    setPhase('LOCKED', 'تم التخطي');
  } else {
    setPhase('LOCKED', 'سنتدرب عليها لاحقاً');
    DOM.childSpeechText.textContent = 'لا بأس، سنتدرب عليها مرة أخرى';
    await voice.speak(
      `لا بأس يا بطل، سنتدرب عليها مرة أخرى. هذه هي: ${detection.repeatTarget}.`,
      'kids'
    );
  }
  if (!isCurrent(myCycle)) return;

  await finishCycle(Boolean(outcome.success));
}

function resumeScanning(announce = false) {
  appState.currentTarget = null;
  appState.sawMotionRecently = false;
  appState.steadyTicks = 0;

  if (!appState.cameraActive) {
    setPhase('IDLE', 'افتح الكاميرا من فضلك');
    DOM.btnScanNow.disabled = true;
    return;
  }

  DOM.btnScanNow.disabled = false;
  setPhase('SCANNING', 'لمسة نور تمسح.. ضع أي شيء في المنتصف');
  laser.startSonarLoop(() => appState.currentProximity, 1250);

  if (announce) {
    voice.speak('الكاميرا جاهزة، ضع أي طعام أو شيء أمام لمسة نور.', 'kids');
  }
}

async function triggerSmartScan(manual = false) {
  if (!appState.cameraActive) {
    if (manual) {
      setPhase('IDLE', 'افتح الكاميرا من فضلك');
      DOM.spokenSentence.textContent = 'افتح الكاميرا من فضلك.';
      voice.speak('افتح الكاميرا من فضلك.', 'kids');
    }
    return;
  }

  if (vision.isBusy) return;
  if (!manual && appState.phase !== 'SCANNING') return;

  if (manual && appState.phase !== 'SCANNING') {
    cancelActiveCycle();
    setPhase('SCANNING', 'جاري التحليل...');
  }

  appState.lastScanTime = Date.now();
  appState.sawMotionRecently = false;
  appState.steadyTicks = 0;
  appState.currentProximity = 0.72;
  DOM.statusText.textContent = 'جاري التعرف عبر لمسة نور...';

  let announcedWeakNet = false;

  try {
    const result = await retrySafely(
      async () => {
        DOM.statusText.textContent = 'جاري التعرف...';
        return vision.identifyFrame(DOM.videoFeed);
      },
      {
        maxAttempts: 3,
        baseDelayMs: 900,
        shouldRetry: () => true,
        onRetry: async (err) => {
          const isNet = err?.code === 'NETWORK_ERROR' || navigator.onLine === false;
          if (isNet) {
            DOM.statusText.textContent = 'النت ضعيف، حاول تاني';
            if (!announcedWeakNet && Date.now() - appState.lastNetWarningTime > 8000) {
              announcedWeakNet = true;
              appState.lastNetWarningTime = Date.now();
              await voice.speak('النت ضعيف، حاول تاني.', 'kids');
            }
          } else {
            DOM.statusText.textContent = 'جاري التعرف...';
          }
        },
      }
    );

    if (!result || appState.phase !== 'SCANNING') return;

    if (!result.hasObject) {
      appState.currentProximity = 0.18;
      if (Date.now() - appState.lastCompletedTime > 2000) {
        appState.lastCompletedSignature = null;
      }
      const guide = result.guidance || 'قرّب الشيء نحو منتصف الشاشة.';
      DOM.statusText.textContent = guide;
      if (manual || Date.now() - appState.lastGuidanceTime > 12000) {
        appState.lastGuidanceTime = Date.now();
        voice.speak(guide, 'kids');
      }
      return;
    }

    const signature = `${result.className}_${result.colorKey}`;
    if (!manual && signature === appState.lastCompletedSignature && Date.now() - appState.lastCompletedTime < 14000) {
      appState.currentProximity = 0.25;
      DOM.statusText.textContent = 'ضع شيئاً جديداً أو اضغط «امسح الآن»';
      return;
    }

    await handleDetectedObject(result, { isDemo: false });
  } catch (err) {
    appState.currentProximity = 0.18;
    const isNet = err?.code === 'NETWORK_ERROR' || navigator.onLine === false;
    if (isNet) {
      DOM.statusText.textContent = 'النت ضعيف، حاول تاني';
      DOM.spokenSentence.textContent = 'النت ضعيف، حاول تاني.';
      if (!announcedWeakNet) {
        voice.speak('النت ضعيف، حاول تاني.', 'kids');
      }
    } else {
      DOM.statusText.textContent = 'لم يتم التعرف الآن، سيجرب تلقائياً من جديد';
      if (manual) {
        voice.speak('لم أتمكن من القراءة الآن، سأحاول مرة أخرى.', 'kids');
      }
    }
  }
}

async function runWatchTick() {
  if (!appState.cameraActive || appState.phase !== 'SCANNING' || vision.isBusy) return;

  if (laser.videoTrack && laser.videoTrack.readyState === 'ended') {
    handleCameraLost();
    return;
  }

  const stats = laser.analyzeCenterFrame(DOM.videoFeed);
  const now = Date.now();

  if (stats.isLowLight && now - appState.lastLowLightTime > 18000) {
    appState.lastLowLightTime = now;
    const torchOn = await laser.toggleTorch(true);
    if (torchOn) {
      DOM.btnTorch.setAttribute('aria-pressed', 'true');
      DOM.btnTorch.textContent = 'الكشاف يعمل';
    }
  }

  if (stats.motionLevel > 0.14) {
    appState.sawMotionRecently = true;
    appState.steadyTicks = 0;
    appState.currentProximity = Math.min(0.85, 0.35 + stats.motionLevel);
    return;
  }

  appState.currentProximity = appState.sawMotionRecently ? 0.55 : 0.18;

  if (appState.sawMotionRecently) {
    appState.steadyTicks += 1;
    if (appState.steadyTicks >= 2 && now - appState.lastScanTime >= 2400) {
      await triggerSmartScan(false);
    }
    return;
  }

  if (now - appState.lastScanTime >= 5000 && vision.hasFrameChanged(DOM.videoFeed, 5)) {
    await triggerSmartScan(false);
  }
}

function handleCameraLost() {
  stopCameraSafely();
  setPhase('IDLE', 'افتح الكاميرا من فضلك');
  DOM.spokenSentence.textContent = 'افتح الكاميرا من فضلك.';
  voice.speak('افتح الكاميرا من فضلك.', 'kids');
}

async function startLaserExperience() {
  laser.initAudio();
  DOM.btnStartLaser.disabled = true;
  DOM.btnStartLaser.textContent = 'جاري فتح الكاميرا الخلفية...';
  setPhase('IDLE', 'جاري فتح الكاميرا الخلفية...');

  try {
    await laser.startCamera(DOM.videoFeed, 'environment');
    await wakeLock.acquire();
    vision.resetFrameCache();
    appState.cameraActive = true;
    DOM.startOverlay.classList.add('hidden');
    DOM.btnScanNow.disabled = false;

    if (laser.videoTrack) {
      laser.videoTrack.addEventListener('ended', handleCameraLost, { once: true });
      const caps = laser.videoTrack.getCapabilities ? laser.videoTrack.getCapabilities() : {};
      if (caps.torch) DOM.btnTorch.hidden = false;
    }

    if (!appState.rafId) renderOverlayLoop();

    DOM.statusText.textContent = 'اسمح بالميكروفون ليسمع «لمسة نور» صوت الطفل';
    await voice.ensureMicPermission();

    resumeScanning(true);

    if (appState.detectTimerId) clearInterval(appState.detectTimerId);
    appState.detectTimerId = setInterval(() => {
      runWatchTick().catch(() => {});
    }, 380);
  } catch {
    stopCameraSafely();
    setPhase('IDLE', 'افتح الكاميرا من فضلك');
    DOM.spokenSentence.textContent = 'افتح الكاميرا من فضلك.';
    DOM.sensoryHint.textContent =
      'تأكد من منح إذن الكاميرا ثم اضغط على «افتح الكاميرا الآن»، أو جرّب الأمثلة السريعة بالأسفل.';
    voice.speak('افتح الكاميرا من فضلك.', 'kids');
  }
}

function isRapidDuplicateTap() {
  const now = Date.now();
  if (now - appState.lastTapTime < 260) return true;
  appState.lastTapTime = now;
  return false;
}

// Event Listeners
DOM.btnWelcomeStart.addEventListener('click', () => {
  if (isRapidDuplicateTap()) return;
  laser.initAudio();
  laser.playLockSound();
  showMainScreen();
  voice.speak('أهلاً بك في لمسة نور.', 'kids');
});

DOM.btnGoHome.addEventListener('click', () => {
  if (isRapidDuplicateTap()) return;
  laser.initAudio();
  showWelcomeScreen(true, false);
});

DOM.btnStartLaser.addEventListener('click', () => {
  if (isRapidDuplicateTap()) return;
  startLaserExperience();
});

DOM.viewportFrame.addEventListener('click', (e) => {
  if (e.target.closest('button')) return;
  if (isRapidDuplicateTap()) return;
  laser.initAudio();
  triggerSmartScan(true);
});

DOM.btnScanNow.addEventListener('click', () => {
  if (isRapidDuplicateTap()) return;
  laser.initAudio();
  triggerSmartScan(true);
});

DOM.btnTorch.addEventListener('click', async () => {
  const on = await laser.toggleTorch();
  DOM.btnTorch.setAttribute('aria-pressed', String(on));
  DOM.btnTorch.textContent = on ? 'الكشاف يعمل' : 'الكشاف';
});

DOM.btnMute.addEventListener('click', () => {
  const nextMuted = !voice.isMuted;
  voice.isMuted = nextMuted;
  laser.isMuted = nextMuted;
  if (nextMuted && voice.synth) voice.synth.cancel();
  DOM.btnMute.setAttribute('aria-pressed', String(nextMuted));
  DOM.btnMute.textContent = nextMuted ? 'الصوت مكتوم' : 'الصوت يعمل';
  persistNow();
});

DOM.btnRepeatNow.addEventListener('click', () => {
  if (!appState.currentTarget || isRapidDuplicateTap()) return;
  laser.initAudio();
  handleDetectedObject(appState.currentTarget, { isDemo: !appState.cameraActive });
});

DOM.btnNextObject.addEventListener('click', () => {
  if (isRapidDuplicateTap()) return;
  laser.initAudio();
  cancelActiveCycle();
  appState.lastCompletedSignature = null;
  resumeScanning(true);
});

DOM.btnChildSaidRight.addEventListener('click', () => resolvePendingDecision('right'));
DOM.btnSkipRepeat.addEventListener('click', () => resolvePendingDecision('skip'));

DOM.demoButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    if (isRapidDuplicateTap()) return;
    laser.initAudio();
    const demoDetection = createDemoDetection(btn.dataset.demo);
    if (!demoDetection) return;
    if (!appState.rafId) renderOverlayLoop();
    handleDetectedObject(demoDetection, { isDemo: true });
  });
});

window.addEventListener('offline', () => {
  DOM.statusText.textContent = 'النت ضعيف، حاول تاني';
  voice.speak('النت ضعيف، حاول تاني.', 'kids');
});

window.addEventListener('online', () => {
  if (appState.cameraActive && appState.phase === 'SCANNING') {
    DOM.statusText.textContent = 'عاد الاتصال بالإنترنت، لمسة نور جاهزة';
  }
});

document.addEventListener('visibilitychange', () => {
  persistNow();
});
window.addEventListener('pagehide', persistNow);
window.addEventListener('beforeunload', () => {
  persistNow();
  if (appState.detectTimerId) clearInterval(appState.detectTimerId);
  if (appState.rafId) cancelAnimationFrame(appState.rafId);
  voice.stopAll();
  laser.stopCamera();
});

installAppSafetyGuards({
  onRecoverHome: () => {
    persistNow();
    showWelcomeScreen(true, true);
  },
  onWrongBackPress: () => {
    if (appState.screen !== 'welcome') {
      showWelcomeScreen(true, true);
    }
  },
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

restoreSavedState();
vision.init().catch(() => {});
