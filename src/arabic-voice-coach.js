/**
 * NoorLaser - Modern Standard Arabic Voice Coach (TTS + patient STT)
 *
 * Key behaviour (fixes the "it never waits for the child" problem):
 *  - speak() resolves ONLY after the browser has truly finished talking.
 *  - listen() waits patiently (up to waitForSpeechMs) for the child to START talking,
 *    auto-restarts the recognizer if the browser stops early, and ends only after
 *    the child has been silent for silenceAfterSpeechMs.
 *  - Errors are reported clearly ('denied', 'network', 'unsupported') instead of
 *    silently skipping ahead.
 */

import {
  ARABIC_SPEECH_CONFIG,
  selectBestArabicVoice,
} from '../agent_skills/arabic-web-speech/arabic-speech-config.js';
import { evaluateChildRepetition } from '../agent_skills/arabic-web-speech/arabic-speech-matching.js';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class ArabicVoiceCoach {
  constructor() {
    this.synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
    this.RecognitionClass =
      typeof window !== 'undefined'
        ? window.SpeechRecognition || window.webkitSpeechRecognition || null
        : null;

    this.selectedVoice = null;
    this.isMuted = false;
    this.micPermission = 'unknown'; // unknown | granted | denied

    this._speakToken = 0;
    this._currentUtterance = null; // keep a reference (Chrome bug: GC'd utterances never fire onend)
    this._cancelListen = null;

    this._initVoices();
  }

  _initVoices() {
    if (!this.synth) return;
    const load = () => {
      this.selectedVoice = selectBestArabicVoice(this.synth.getVoices());
    };
    load();
    if (typeof this.synth.onvoiceschanged !== 'undefined') {
      this.synth.onvoiceschanged = load;
    }
  }

  /**
   * Asks for microphone permission once, up front, so listening never fails silently.
   */
  async ensureMicPermission() {
    if (this.micPermission === 'granted') return true;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.micPermission = 'denied';
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      this.micPermission = 'granted';
      return true;
    } catch {
      this.micPermission = 'denied';
      return false;
    }
  }

  supportsListening() {
    return Boolean(this.RecognitionClass);
  }

  cancelListening() {
    if (this._cancelListen) this._cancelListen();
  }

  /**
   * Stops any ongoing speech or microphone listening cleanly.
   */
  stopAll() {
    this._speakToken += 1;
    if (this.synth) this.synth.cancel();
    this.cancelListening();
  }

  /**
   * Speaks text sentence by sentence and resolves only when speaking has really finished.
   */
  async speak(text, mode = 'kids') {
    if (!text || this.isMuted || !this.synth) return;
    const token = ++this._speakToken;
    this.synth.cancel();
    await delay(60);

    const sentences = String(text)
      .split(/(?<=[.!؟?])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);

    for (let i = 0; i < sentences.length; i++) {
      if (token !== this._speakToken) return;
      await this._speakOne(sentences[i], mode, token);
      if (i < sentences.length - 1) {
        await delay(ARABIC_SPEECH_CONFIG.pauseBetweenSentencesMs);
      }
    }
  }

  _speakOne(text, mode, token) {
    return new Promise((resolve) => {
      const profile =
        mode === 'adults' ? ARABIC_SPEECH_CONFIG.adultsVoice : ARABIC_SPEECH_CONFIG.kidsVoice;

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = this.selectedVoice?.lang || 'ar-SA';
      if (this.selectedVoice) utterance.voice = this.selectedVoice;
      utterance.rate = profile.rate;
      utterance.pitch = profile.pitch;
      utterance.volume = profile.volume;
      this._currentUtterance = utterance;

      const startedAt = Date.now();
      let started = false;
      let settled = false;

      const finish = () => {
        if (settled) return;
        settled = true;
        clearInterval(poll);
        clearTimeout(hardTimer);
        resolve();
      };

      utterance.onstart = () => {
        started = true;
      };
      utterance.onend = () => {
        // Wait until the engine is really silent before continuing
        const check = () => {
          if (!this.synth.speaking || token !== this._speakToken) finish();
          else setTimeout(check, 80);
        };
        check();
      };
      utterance.onerror = finish;

      const poll = setInterval(() => {
        if (token !== this._speakToken) return finish();
        const silent = !this.synth.speaking && !this.synth.pending;
        if (started && silent) finish();
        // No Arabic voice ever started on this device
        if (!started && silent && Date.now() - startedAt > 2500) finish();
      }, 250);

      // Generous safety net only (never cuts speech short in normal conditions)
      const hardTimer = setTimeout(finish, 4000 + text.length * 220);

      this.synth.speak(utterance);
    });
  }

  /**
   * Patiently listens to the child.
   * Resolves { status, transcript, candidates } where status is one of:
   * 'ok' | 'no-speech' | 'denied' | 'network' | 'unsupported' | 'cancelled' | 'error'
   */
  listen({ onInterim = null, onSpeechStart = null } = {}) {
    this.cancelListening();

    return new Promise((resolve) => {
      if (!this.RecognitionClass) {
        resolve({ status: 'unsupported', transcript: '', candidates: [] });
        return;
      }

      const cfg = ARABIC_SPEECH_CONFIG;
      const startedAt = Date.now();
      const candidates = new Set();
      let latestText = '';
      let heard = false;
      let settled = false;
      let restarts = 0;
      let recognition = null;
      let silenceTimer = null;

      const finish = (status) => {
        if (settled) return;
        settled = true;
        clearTimeout(waitTimer);
        clearTimeout(hardTimer);
        clearTimeout(silenceTimer);
        if (this._cancelListen === cancel) this._cancelListen = null;
        if (recognition) {
          recognition.onresult = null;
          recognition.onerror = null;
          recognition.onend = null;
          try {
            recognition.abort();
          } catch {
            // ignore
          }
        }
        resolve({
          status,
          transcript: latestText.trim(),
          candidates: [...candidates].filter(Boolean),
        });
      };

      const cancel = () => finish('cancelled');
      this._cancelListen = cancel;

      // Nobody spoke within the patient waiting window
      const waitTimer = setTimeout(() => {
        if (!heard) finish('no-speech');
      }, cfg.micStartDelayMs + cfg.waitForSpeechMs);

      // Absolute safety cap
      const hardTimer = setTimeout(
        () => finish(heard ? 'ok' : 'no-speech'),
        cfg.micStartDelayMs + cfg.waitForSpeechMs + 9000
      );

      const armSilenceTimer = () => {
        clearTimeout(silenceTimer);
        silenceTimer = setTimeout(() => finish('ok'), cfg.silenceAfterSpeechMs);
      };

      const startRecognizer = () => {
        if (settled) return;
        recognition = new this.RecognitionClass();
        recognition.lang = cfg.recognitionLang;
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 5;

        recognition.onresult = (event) => {
          let finals = '';
          let interim = '';
          for (let i = 0; i < event.results.length; i++) {
            const res = event.results[i];
            for (let a = 0; a < res.length; a++) {
              candidates.add((res[a].transcript || '').trim());
            }
            if (res.isFinal) finals += ` ${res[0].transcript}`;
            else interim += ` ${res[0].transcript}`;
          }
          latestText = `${finals} ${interim}`.replace(/\s+/g, ' ').trim();
          if (!latestText) return;

          candidates.add(latestText);
          if (!heard) {
            heard = true;
            if (onSpeechStart) onSpeechStart();
          }
          if (onInterim) onInterim(latestText);
          armSilenceTimer();
        };

        recognition.onerror = (event) => {
          const err = event.error;
          if (err === 'not-allowed' || err === 'service-not-allowed' || err === 'audio-capture') {
            finish('denied');
          } else if (err === 'network') {
            finish('network');
          }
          // 'no-speech' / 'aborted' are handled by onend (we restart and keep waiting)
        };

        recognition.onend = () => {
          if (settled) return;
          if (heard) {
            finish('ok');
            return;
          }
          // Browser stopped early: keep waiting patiently for the child
          const elapsed = Date.now() - startedAt;
          if (elapsed < cfg.micStartDelayMs + cfg.waitForSpeechMs - 300 && restarts < 15) {
            restarts += 1;
            setTimeout(startRecognizer, 150);
          } else {
            finish('no-speech');
          }
        };

        try {
          recognition.start();
        } catch {
          finish('error');
        }
      };

      setTimeout(startRecognizer, cfg.micStartDelayMs);
    });
  }

  /**
   * Evaluates the child's repetition against the detected object & color.
   * Returns 'exact' | 'object' | 'color' | 'wrong' | 'none'
   */
  evaluate(listenResult, detection) {
    const texts = [listenResult.transcript, ...(listenResult.candidates || [])];
    return evaluateChildRepetition(texts, detection.objectAliases, detection.colorAliases);
  }
}
