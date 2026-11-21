/**
 * لمسة نور — Task 4: Auto-Save Persistence & Crash-Recovery Shield
 * Persists stars, discoveries history, mode, mute setting, active screen, and last item
 * so closing and reopening the app restores everything exactly as it was.
 */

const STATE_STORAGE_KEY = 'lamsat_noor_state_v2';

const DEFAULT_SAVED_STATE = {
  stars: 0,
  history: [],
  muted: false,
  screen: 'welcome', // 'welcome' | 'main'
  lastTarget: null,
  savedAt: 0,
};

/**
 * Safely reads persisted app state from localStorage (never throws even in private mode).
 */
export function loadSavedAppState() {
  try {
    const raw = localStorage.getItem(STATE_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SAVED_STATE };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_SAVED_STATE };

    return {
      stars: Number.isFinite(parsed.stars) && parsed.stars >= 0 ? Math.floor(parsed.stars) : 0,
      history: Array.isArray(parsed.history) ? parsed.history.slice(0, 30) : [],
      muted: Boolean(parsed.muted),
      screen: parsed.screen === 'main' ? 'main' : 'welcome',
      lastTarget:
        parsed.lastTarget && typeof parsed.lastTarget === 'object' && parsed.lastTarget.sentence
          ? parsed.lastTarget
          : null,
      savedAt: Number(parsed.savedAt) || 0,
    };
  } catch {
    return { ...DEFAULT_SAVED_STATE };
  }
}

/**
 * Safely writes app state to localStorage (auto-save on every action & before closing).
 */
export function saveAppState(partial) {
  try {
    const current = loadSavedAppState();
    const next = {
      ...current,
      ...partial,
      savedAt: Date.now(),
    };
    localStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(next));
    return true;
  } catch {
    return false;
  }
}

/**
 * Retries an async operation up to maxAttempts times when network is weak
 * or Gemini does not respond, calling onRetry before each retry.
 */
export async function retrySafely(fn, { maxAttempts = 3, baseDelayMs = 1200, shouldRetry, onRetry } = {}) {
  let lastError = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastError = err;
      const canRetry = attempt < maxAttempts && (!shouldRetry || shouldRetry(err));
      if (!canRetry) {
        throw err;
      }
      if (onRetry) {
        await onRetry(err, attempt, maxAttempts);
      }
      await new Promise((resolve) => setTimeout(resolve, baseDelayMs * attempt));
    }
  }
  throw lastError;
}

/**
 * Installs global runtime crash protection and accidental mobile back-button protection.
 * If anything goes wrong or a child presses Back accidentally, the app safely returns
 * to the «لمسة نور» Home screen instead of closing or freezing.
 */
export function installAppSafetyGuards({ onRecoverHome, onWrongBackPress }) {
  // 1. Catch any unexpected synchronous error
  window.addEventListener('error', (event) => {
    event.preventDefault();
    try {
      if (onRecoverHome) onRecoverHome('error');
    } catch {
      // never throw inside guard
    }
  });

  // 2. Catch any unhandled promise rejection
  window.addEventListener('unhandledrejection', (event) => {
    event.preventDefault();
    try {
      if (onRecoverHome) onRecoverHome('rejection');
    } catch {
      // never throw inside guard
    }
  });

  // 3. Guard against accidental hardware/gesture Back press closing the mobile PWA
  try {
    window.history.replaceState({ lamsatNoor: 'guard' }, '');
    window.history.pushState({ lamsatNoor: 'active' }, '');
  } catch {
    // ignore restricted history environments
  }

  window.addEventListener('popstate', () => {
    try {
      window.history.pushState({ lamsatNoor: 'active' }, '');
      if (onWrongBackPress) onWrongBackPress();
    } catch {
      // ignore
    }
  });
}
