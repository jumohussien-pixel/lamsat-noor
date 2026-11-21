/**
 * لمسة نور — Task 5: Mobile Screen Wake Lock Manager
 * Prevents the mobile phone screen from dimming or locking while a blind child
 * holds objects in front of the camera hands-free.
 */

export class ScreenWakeLockManager {
  constructor() {
    this.sentinel = null;
    this.wanted = false;
    this._onVisibilityChange = () => {
      if (this.wanted && document.visibilityState === 'visible') {
        this.acquire();
      }
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this._onVisibilityChange);
    }
  }

  async acquire() {
    this.wanted = true;
    if (typeof navigator === 'undefined' || !navigator.wakeLock || !navigator.wakeLock.request) {
      return false;
    }
    try {
      if (this.sentinel && !this.sentinel.released) return true;
      this.sentinel = await navigator.wakeLock.request('screen');
      this.sentinel.addEventListener('release', () => {
        this.sentinel = null;
      });
      return true;
    } catch {
      return false;
    }
  }

  async release() {
    this.wanted = false;
    if (this.sentinel) {
      try {
        await this.sentinel.release();
      } catch {
        // ignore
      }
      this.sentinel = null;
    }
  }
}
