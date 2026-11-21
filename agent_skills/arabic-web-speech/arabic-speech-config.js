/**
 * NoorLaser - Modern Standard Arabic (الفصحى) Web Speech API Configuration
 * Prepares SpeechSynthesis (TTS) and SpeechRecognition (STT) for blind children & adults.
 */

export const ARABIC_SPEECH_CONFIG = {
  // Voice output: prefer Modern Standard Arabic voices first
  preferredLangs: ['ar-SA', 'ar-001', 'ar-EG', 'ar-AE', 'ar'],
  // Listening: Egyptian children speak with Egyptian pronunciation, so ar-EG understands them best
  recognitionLang: 'ar-EG',
  kidsVoice: {
    rate: 0.85, // Slow and clear for children
    pitch: 1.05,
    volume: 1.0,
  },
  adultsVoice: {
    rate: 1.0,
    pitch: 1.0,
    volume: 1.0,
  },
  // Calm pause between spoken sentences
  pauseBetweenSentencesMs: 450,
  // Wait after the app stops talking (and after the chime) before opening the mic
  micStartDelayMs: 550,
  // How long we patiently wait for the child to START speaking
  waitForSpeechMs: 10000,
  // After the child starts speaking, this much silence means they finished
  silenceAfterSpeechMs: 1600,
  // How many times we invite the child to repeat before gently moving on
  maxRepeatAttempts: 3,
};

/**
 * Picks the best available Arabic voice installed on the device/browser.
 * Prefers natural/online voices (e.g. Microsoft Natural voices in Edge, Google voices in Chrome).
 */
export function selectBestArabicVoice(voices = []) {
  const normLang = (v) => (v.lang || '').toLowerCase().replace('_', '-');
  const arabic = voices.filter((v) => normLang(v).startsWith('ar'));
  if (!arabic.length) return null;

  const prefs = ARABIC_SPEECH_CONFIG.preferredLangs.map((l) => l.toLowerCase());
  const langRank = (v) => {
    const idx = prefs.indexOf(normLang(v));
    return idx === -1 ? prefs.length : idx;
  };
  const quality = (v) => {
    const n = (v.name || '').toLowerCase();
    let score = 0;
    if (n.includes('natural')) score += 3;
    if (n.includes('online')) score += 2;
    if (n.includes('google')) score += 2;
    return score;
  };

  return [...arabic].sort((a, b) => quality(b) - quality(a) || langRank(a) - langRank(b))[0];
}

/**
 * Normalizes Arabic text for fuzzy child-speech matching (removes diacritics,
 * unifies alef/taa marbuta/yaa/hamza forms).
 */
export function normalizeArabicText(text = '') {
  return String(text)
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '') // Remove tashkeel & tatweel
    .replace(/[أإآ]/g, 'ا')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[^\u0621-\u064A0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
