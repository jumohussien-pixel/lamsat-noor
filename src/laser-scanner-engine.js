/**
 * NoorLaser - Task 5: Camera & Audio-Haptic Sonar Laser Engine
 * Handles live camera stream, optional torch, Web Audio API sonar pulses,
 * haptic vibration feedback, central Laser ROI analysis, and laser HUD drawing.
 */

export class LaserScannerEngine {
  constructor() {
    this.stream = null;
    this.videoTrack = null;
    this.torchEnabled = false;

    // Web Audio API context for calm sonar & feedback chimes
    this.audioCtx = null;
    this.sonarIntervalId = null;
    this.isMuted = false;

    // Offscreen canvas for frame brightness & motion analysis
    this.sampleCanvas = document.createElement('canvas');
    this.sampleCanvas.width = 64;
    this.sampleCanvas.height = 64;
    this.sampleCtx = this.sampleCanvas.getContext('2d', { willReadFrequently: true });
    this.prevFrameData = null;

    // Animation state for laser scanline
    this.scanlinePos = 0;
    this.scanlineDir = 1;
  }

  /**
   * Initializes AudioContext (must be called after a user gesture).
   */
  initAudio() {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  /**
   * Starts the rear mobile camera in portrait mode (exact 'environment' first,
   * then graceful fallback for laptops/devices with a single front camera).
   */
  async startCamera(videoEl, facingMode = 'environment') {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('المتصفح لا يدعم تشغيل الكاميرا.');
    }

    this.stopCamera();

    const attempts = [
      // 1. Force rear camera on mobile phones in vertical portrait orientation
      {
        video: {
          facingMode: { exact: facingMode },
          width: { ideal: 720 },
          height: { ideal: 1280 },
        },
        audio: false,
      },
      // 2. Prefer rear camera without strict exact constraint
      {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 720 },
          height: { ideal: 1280 },
        },
        audio: false,
      },
      // 3. Fallback to any available webcam
      { video: true, audio: false },
    ];

    let lastError = null;
    for (const constraints of attempts) {
      try {
        this.stream = await navigator.mediaDevices.getUserMedia(constraints);
        break;
      } catch (err) {
        lastError = err;
        // If user explicitly denied camera permission, don't loop further
        if (err && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')) {
          throw err;
        }
      }
    }

    if (!this.stream) {
      throw lastError || new Error('تعذر فتح الكاميرا الخلفية.');
    }

    this.videoTrack = this.stream.getVideoTracks()[0] || null;
    videoEl.srcObject = this.stream;
    await videoEl.play();
    return this.stream;
  }

  /**
   * Stops camera tracks and sonar loop cleanly.
   */
  stopCamera() {
    this.stopSonarLoop();
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
      this.videoTrack = null;
      this.torchEnabled = false;
    }
  }

  /**
   * Toggles camera flashlight/torch if supported by the device.
   */
  async toggleTorch(forceState = null) {
    if (!this.videoTrack) return false;
    const capabilities = this.videoTrack.getCapabilities ? this.videoTrack.getCapabilities() : {};
    if (!capabilities.torch) return false;

    const nextState = forceState !== null ? Boolean(forceState) : !this.torchEnabled;
    try {
      await this.videoTrack.applyConstraints({ advanced: [{ torch: nextState }] });
      this.torchEnabled = nextState;
      return this.torchEnabled;
    } catch {
      return false;
    }
  }

  /**
   * Triggers haptic vibration if supported (mobile devices).
   */
  vibrate(pattern) {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern);
    }
  }

  /**
   * Plays a calm sonar ping. Proximity (0..1) raises pitch slightly so a blind child
   * hears when an object moves into the center of the laser beam.
   */
  playSonarPulse(proximity = 0.15) {
    if (this.isMuted) return;
    this.initAudio();
    if (!this.audioCtx) return;

    const now = this.audioCtx.currentTime;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    const clamped = Math.max(0, Math.min(1, proximity));
    const freq = 340 + clamped * 320; // Calm 340Hz -> 660Hz

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.055, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);

    osc.start(now);
    osc.stop(now + 0.15);
  }

  /**
   * Starts periodic calm sonar pulses while scanning.
   */
  startSonarLoop(getProximityFn = () => 0.15, intervalMs = 1100) {
    this.stopSonarLoop();
    this.sonarIntervalId = setInterval(() => {
      const proximity = typeof getProximityFn === 'function' ? getProximityFn() : 0.15;
      this.playSonarPulse(proximity);
    }, intervalMs);
  }

  stopSonarLoop() {
    if (this.sonarIntervalId) {
      clearInterval(this.sonarIntervalId);
      this.sonarIntervalId = null;
    }
  }

  /**
   * Crisp two-tone lock chime + gentle vibration when the laser locks onto an object.
   */
  playLockSound() {
    this.vibrate([45, 30, 75]);
    if (this.isMuted) return;
    this.initAudio();
    if (!this.audioCtx) return;

    const now = this.audioCtx.currentTime;
    const notes = [523.25, 783.99]; // C5 -> G5
    notes.forEach((freq, idx) => {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.09);

      gain.gain.setValueAtTime(0.001, now + idx * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.11, now + idx * 0.09 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.09 + 0.16);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start(now + idx * 0.09);
      osc.stop(now + idx * 0.09 + 0.18);
    });
  }

  /**
   * Soft chime played right before opening the microphone for child repetition.
   */
  playListeningChime() {
    this.vibrate(35);
    if (this.isMuted) return;
    this.initAudio();
    if (!this.audioCtx) return;

    const now = this.audioCtx.currentTime;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(660, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.09, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  /**
   * Joyful ascending chime when the child repeats the object name & color.
   */
  playCelebrationSound() {
    this.vibrate([40, 40, 80]);
    if (this.isMuted) return;
    this.initAudio();
    if (!this.audioCtx) return;

    const now = this.audioCtx.currentTime;
    const chord = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
    chord.forEach((freq, idx) => {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);

      gain.gain.setValueAtTime(0.001, now + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.11, now + idx * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.24);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.26);
    });
  }

  /**
   * Gentle but unmistakable warning tone for sharp/unsafe objects (Child Safety Shield).
   */
  playSafetyAlertSound() {
    this.vibrate([120, 60, 120, 60, 120]);
    if (this.isMuted) return;
    this.initAudio();
    if (!this.audioCtx) return;

    const now = this.audioCtx.currentTime;
    [440, 349.23].forEach((freq, idx) => {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now + idx * 0.18);

      gain.gain.setValueAtTime(0.001, now + idx * 0.18);
      gain.gain.exponentialRampToValueAtTime(0.07, now + idx * 0.18 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.18 + 0.16);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start(now + idx * 0.18);
      osc.stop(now + idx * 0.18 + 0.17);
    });
  }

  /**
   * Computes the central Laser Target Zone (ROI) coordinates for a given frame size.
   */
  getLaserROI(width, height) {
    const size = Math.round(Math.min(width, height) * 0.48);
    return {
      x: Math.round((width - size) / 2),
      y: Math.round((height - size) / 2),
      width: size,
      height: size,
      centerX: Math.round(width / 2),
      centerY: Math.round(height / 2),
    };
  }

  /**
   * Samples the central laser zone of the video to measure brightness (0..255)
   * and motion delta (0..1) so we know when the light is too dim or when a new object enters.
   */
  analyzeCenterFrame(videoEl) {
    if (!videoEl || videoEl.readyState < 2 || !videoEl.videoWidth) {
      return { brightness: 128, isLowLight: false, motionLevel: 0 };
    }

    const roi = this.getLaserROI(videoEl.videoWidth, videoEl.videoHeight);
    this.sampleCtx.drawImage(
      videoEl,
      roi.x,
      roi.y,
      roi.width,
      roi.height,
      0,
      0,
      this.sampleCanvas.width,
      this.sampleCanvas.height
    );

    const { data } = this.sampleCtx.getImageData(
      0,
      0,
      this.sampleCanvas.width,
      this.sampleCanvas.height
    );

    let totalLum = 0;
    let diffSum = 0;
    const pixelCount = data.length / 4;

    for (let i = 0; i < data.length; i += 4) {
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      totalLum += lum;
      if (this.prevFrameData) {
        diffSum += Math.abs(data[i] - this.prevFrameData[i]);
      }
    }

    const avgBrightness = totalLum / pixelCount;
    const motionLevel = this.prevFrameData
      ? Math.min(1, diffSum / (pixelCount * 45))
      : 0;

    this.prevFrameData = new Uint8ClampedArray(data);

    return {
      brightness: Math.round(avgBrightness),
      isLowLight: avgBrightness < 55,
      motionLevel: Number(motionLevel.toFixed(3)),
    };
  }

  /**
   * Draws the glowing laser targeting HUD onto an overlay canvas.
   * state: 'SCANNING' | 'LOCKED' | 'LISTENING' | 'DANGER'
   */
  drawLaserOverlay(canvasEl, state = 'SCANNING', detectedBox = null) {
    if (!canvasEl) return;
    const ctx = canvasEl.getContext('2d');
    const { width, height } = canvasEl;
    ctx.clearRect(0, 0, width, height);

    const roi = this.getLaserROI(width, height);

    const palette = {
      SCANNING: { stroke: '#34d399', glow: 'rgba(52, 211, 153, 0.45)' },
      LOCKED: { stroke: '#38bdf8', glow: 'rgba(56, 189, 248, 0.55)' },
      LISTENING: { stroke: '#fbbf24', glow: 'rgba(251, 191, 36, 0.5)' },
      DANGER: { stroke: '#f87171', glow: 'rgba(248, 113, 113, 0.65)' },
    };
    const colors = palette[state] || palette.SCANNING;

    ctx.save();
    ctx.strokeStyle = colors.stroke;
    ctx.lineWidth = 3;
    ctx.shadowColor = colors.glow;
    ctx.shadowBlur = 14;

    // Corner brackets around central laser zone
    const corner = Math.max(20, Math.round(roi.width * 0.14));
    const { x, y, width: w, height: h } = roi;

    const corners = [
      // Top-left
      [[x, y + corner], [x, y], [x + corner, y]],
      // Top-right
      [[x + w - corner, y], [x + w, y], [x + w, y + corner]],
      // Bottom-right
      [[x + w, y + h - corner], [x + w, y + h], [x + w - corner, y + h]],
      // Bottom-left
      [[x + corner, y + h], [x, y + h], [x, y + h - corner]],
    ];

    corners.forEach((pts) => {
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      ctx.lineTo(pts[1][0], pts[1][1]);
      ctx.lineTo(pts[2][0], pts[2][1]);
      ctx.stroke();
    });

    // Moving laser scanline inside the ROI during SCANNING
    if (state === 'SCANNING') {
      this.scanlinePos += 0.018 * this.scanlineDir;
      if (this.scanlinePos >= 1) {
        this.scanlinePos = 1;
        this.scanlineDir = -1;
      } else if (this.scanlinePos <= 0) {
        this.scanlinePos = 0;
        this.scanlineDir = 1;
      }

      const lineY = y + this.scanlinePos * h;
      ctx.beginPath();
      ctx.moveTo(x + 8, lineY);
      ctx.lineTo(x + w - 8, lineY);
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }

    // Center crosshair dot
    ctx.beginPath();
    ctx.arc(roi.centerX, roi.centerY, 5, 0, Math.PI * 2);
    ctx.fillStyle = colors.stroke;
    ctx.fill();

    // Optional bounding box of detected object
    if (detectedBox && Array.isArray(detectedBox) && detectedBox.length === 4) {
      const [bx, by, bw, bh] = detectedBox;
      ctx.setLineDash([8, 6]);
      ctx.lineWidth = 2;
      ctx.strokeRect(bx, by, bw, bh);
    }

    ctx.restore();
  }
}
