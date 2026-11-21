/**
 * NoorLaser - Child-friendly Arabic speech matching.
 * Understands Modern Standard Arabic AND Egyptian everyday words
 * (e.g. "معلقة" for ملعقة, "كوباية" for كوب, "سودا" for سوداء).
 */

import { normalizeArabicText } from './arabic-speech-config.js';

// Every spoken form we accept for each color (masculine, feminine, Egyptian everyday forms)
export const COLOR_SPOKEN_VARIANTS = {
  silver: ['فضي', 'فضية', 'فضيه', 'سيلفر', 'سلفر'],
  gold: ['ذهبي', 'ذهبية', 'دهبي', 'دهبية', 'جولد'],
  red: ['أحمر', 'حمراء', 'حمرا', 'حمره', 'احمر'],
  blue: ['أزرق', 'زرقاء', 'زرقا', 'زرقه', 'لبني'],
  green: ['أخضر', 'خضراء', 'خضرا', 'خضره'],
  yellow: ['أصفر', 'صفراء', 'صفرا', 'صفره'],
  orange: ['برتقالي', 'برتقالية', 'برتقاني', 'اورنج'],
  purple: ['بنفسجي', 'بنفسجية', 'موف', 'موفي'],
  pink: ['وردي', 'وردية', 'بمبي', 'بينك', 'روز'],
  brown: ['بني', 'بنية', 'بنى'],
  white: ['أبيض', 'بيضاء', 'بيضا', 'ابيض'],
  black: ['أسود', 'سوداء', 'سودا', 'اسود', 'سوده'],
  gray: ['رمادي', 'رمادية', 'رصاصي', 'سكني', 'جراي'],
};

function stripPrefixes(word) {
  if ((word.startsWith('وال') || word.startsWith('بال')) && word.length > 5) return word.slice(3);
  if (word.startsWith('ال') && word.length > 4) return word.slice(2);
  return word;
}

export function tokenizeArabic(text) {
  return normalizeArabicText(text).split(' ').filter(Boolean).map(stripPrefixes);
}

export function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = curr;
  }
  return prev[b.length];
}

// Short words (3 letters) must match exactly; longer words tolerate small pronunciation slips
function wordsSimilar(spoken, target) {
  if (spoken === target) return true;
  if (Math.min(spoken.length, target.length) < 4) return false;
  const d = levenshtein(spoken, target);
  return d <= 1 || (Math.max(spoken.length, target.length) >= 7 && d <= 2);
}

export function phraseMatches(spokenText, alias) {
  const spokenWords = tokenizeArabic(spokenText);
  const aliasWords = tokenizeArabic(alias);
  if (!spokenWords.length || !aliasWords.length) return false;
  return aliasWords.every((aw) => spokenWords.some((sw) => wordsSimilar(sw, aw)));
}

export function matchesAny(spokenText, aliases = []) {
  return aliases.some((alias) => phraseMatches(spokenText, alias));
}

/**
 * Evaluates everything the recognizer heard (all alternatives) against the target.
 * Returns: 'exact' (object + color) | 'object' | 'color' | 'wrong' | 'none'
 */
export function evaluateChildRepetition(texts = [], objectAliases = [], colorAliases = []) {
  const heard = texts.map((t) => (t || '').trim()).filter(Boolean);
  if (!heard.length) return 'none';

  let hasObject = false;
  let hasColor = false;
  for (const text of heard) {
    if (!hasObject && matchesAny(text, objectAliases)) hasObject = true;
    if (!hasColor && matchesAny(text, colorAliases)) hasColor = true;
  }

  if (hasObject && hasColor) return 'exact';
  if (hasObject) return 'object';
  if (hasColor) return 'color';
  return 'wrong';
}
