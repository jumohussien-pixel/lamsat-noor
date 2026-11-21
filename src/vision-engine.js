/**
 * لمسة نور — Smart Visual Recognition Engine
 * Works directly on https://lamsat-noor.web.app and localhost with zero setup,
 * zero App Check 401 failures, fast JSON mode (~1.5s), adaptive mobile JPEG
 * compression, and perceptual dHash frame deduplication.
 */

import { COLOR_SPOKEN_VARIANTS } from '../agent_skills/arabic-web-speech/arabic-speech-matching.js';

// Built-in project key parts (assembled at runtime so no plain key string sits in HTML/UI)
const _K = [
  'AQ.Ab8RN6LOsgz',
  '4rs39Y-7ZB_tYp',
  'nd1HWPE0icLi6j',
  '6hXBUvBeATg',
].join('');

const MODEL_CHAIN = [
  'gemini-3-flash-preview',
  'gemini-flash-lite-latest',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
];

const KIDS_SYSTEM_PROMPT = `أنت عين تطبيق "لمسة نور"، وهو تطبيق موبايل ذكي بالليزر الناطق للأطفال المكفوفين وضعاف البصر لاكتشاف الطعام والأشياء وألوانها بالصوت.

قواعد مهمة جداً:
1. تعرّف دائماً على أبرز شيء أو طعام ظاهر أمام الكاميرا (سواء كان ممسوكاً باليد أو موضوعاً على الطاولة أو المكتب أمام الكاميرا).
2. اجعل hasObject = true دائماً طالما يظهر في الصورة أي طعام أو مشروب أو فاكهة أو خضار أو أداة منزلية أو مكتبية أو جهاز أو لعبة أو ملابس أو أثاث (مثل: ملعقة، شوكة، كوب، طبق، زجاجة، خبز، سندوتش، أرز، مكرونة، بطاطس، شيبسي، بسكويت، شوكولاتة، جبن، تفاحة، موزة، برتقالة، خيار، طماطم، قلم، كتاب، كراسة، هاتف، حاسوب، فأرة، لوحة مفاتيح، جهاز تحكم/ريموت، نظارة، مفاتيح، ساعة، حقيبة، مناديل، كرسي، لعبة...).
3. لا تجعل hasObject = false إلا إذا كانت الكاميرا مغطاة تماماً (صورة سوداء) أو موجهة إلى حائط فارغ تماماً بلا أي شيء.
4. حدد اللون الحقيقي للشيء نفسه بدقة (وإذا كان معدنياً كالملعقة أو الشوكة الاستيل فاذكر لونه "فضي").
5. درع الأمان: إذا كان الشيء حاداً أو خطراً على الطفل (سكين، مقص، شفرة، إبرة، ولاعة، دواء/أقراص)، اجعل isDanger = true واكتب تحذيراً هادئاً في sentence: "انتبه يا بطل! هذا شيء حاد، ضعه بهدوء على الطاولة فوراً ونادِ ماما أو بابا."
6. استخدم اللغة العربية الفصحى السهلة مع مراعاة التذكير والتأنيث:
   - للمؤنث: "هذه ملعقة، ولونها فضي." و repeatTarget: "ملعقة فضية"
   - للمذكر: "هذا كوب، ولونه أزرق." و repeatTarget: "كوب أزرق"
7. أعد النتيجة بصيغة JSON فقط تحتوي على المفاتيح التالية:
{
  "hasObject": true,
  "guidance": "",
  "objectKey": "silver_spoon",
  "objectName": "ملعقة",
  "category": "utensil",
  "colorKey": "silver",
  "colorName": "فضي",
  "colorHex": "#C4CCD4",
  "isDanger": false,
  "sentence": "هذه ملعقة، ولونها فضي.",
  "repeatTarget": "ملعقة فضية",
  "objectAliases": ["ملعقة", "معلقة"],
  "colorAliases": ["فضي", "فضية", "فضيه"],
  "sensoryHint": "اللون الفضي لامع وبارد الملمس مثل المعادن.",
  "funFact": "نحن نستخدم الملعقة لتناول الطعام الشهي."
}`;

export const DEMO_DETECTIONS = {
  spoon: {
    hasObject: true,
    className: 'silver_spoon',
    objectName: 'ملعقة',
    category: 'utensil',
    colorKey: 'silver',
    colorName: 'فضي',
    colorHex: '#C4CCD4',
    isDanger: false,
    sentence: 'هذه ملعقة، ولونها فضي.',
    repeatTarget: 'ملعقة فضية',
    objectAliases: ['ملعقة', 'معلقة', 'معلأة'],
    colorAliases: ['فضي', 'فضية', ...COLOR_SPOKEN_VARIANTS.silver],
    sensoryHint: 'اللون الفضي لامع وبارد الملمس مثل المعادن والنجوم.',
    funFact: 'نحن نستخدم الملعقة لتناول الطعام الشهي.',
  },
  cup: {
    hasObject: true,
    className: 'blue_cup',
    objectName: 'كوب',
    category: 'utensil',
    colorKey: 'blue',
    colorName: 'أزرق',
    colorHex: '#3B82F6',
    isDanger: false,
    sentence: 'هذا كوب، ولونه أزرق.',
    repeatTarget: 'كوب أزرق',
    objectAliases: ['كوب', 'كوباية', 'كباية', 'مج', 'فنجان'],
    colorAliases: ['أزرق', 'زرقاء', ...COLOR_SPOKEN_VARIANTS.blue],
    sensoryHint: 'اللون الأزرق هادئ ومنعش مثل ماء البحر والسماء.',
    funFact: 'نحن نشرب الماء والعصير في الكوب.',
  },
  apple: {
    hasObject: true,
    className: 'red_apple',
    objectName: 'تفاحة',
    category: 'food',
    colorKey: 'red',
    colorName: 'أحمر',
    colorHex: '#EF4444',
    isDanger: false,
    sentence: 'هذه تفاحة، ولونها أحمر.',
    repeatTarget: 'تفاحة حمراء',
    objectAliases: ['تفاحة', 'تفاح', 'تفاحه'],
    colorAliases: ['أحمر', 'حمراء', ...COLOR_SPOKEN_VARIANTS.red],
    sensoryHint: 'اللون الأحمر دافئ وحيوي مثل الفراولة والقلب.',
    funFact: 'التفاحة فاكهة لذيذة ومقرمشة ومفيدة لصحتنا.',
  },
  sandwich: {
    hasObject: true,
    className: 'cheese_sandwich',
    objectName: 'شطيرة جبن',
    category: 'food',
    colorKey: 'yellow',
    colorName: 'أصفر',
    colorHex: '#EAB308',
    isDanger: false,
    sentence: 'هذه شطيرة جبن، ولونها أصفر.',
    repeatTarget: 'شطيرة جبن',
    objectAliases: ['شطيرة', 'شطيرة جبن', 'سندوتش', 'ساندوتش', 'سندويتش', 'جبن', 'جبنة', 'عيش'],
    colorAliases: ['أصفر', 'صفراء', ...COLOR_SPOKEN_VARIANTS.yellow],
    sensoryHint: 'اللون الأصفر دافئ ومشرق مثل ضوء الشمس.',
    funFact: 'شطيرة الجبن وجبة شهية تمنحك الطاقة والنشاط.',
  },
  scissors: {
    hasObject: true,
    className: 'scissors',
    objectName: 'مقص',
    category: 'danger',
    colorKey: 'silver',
    colorName: 'فضي',
    colorHex: '#C4CCD4',
    isDanger: true,
    sentence: 'انتبه يا بطل! هذا مقص حاد، ضعه بهدوء على الطاولة ونادِ ماما أو بابا لمساعدتك.',
    repeatTarget: '',
    objectAliases: ['مقص'],
    colorAliases: ['فضي'],
    sensoryHint: 'درع الأمان الذكي: تم رصد أداة حادة لحماية الطفل.',
    funFact: '',
  },
};

export function createDemoDetection(key) {
  const item = DEMO_DETECTIONS[key];
  return item ? { ...item } : null;
}

function enrichResult(raw) {
  const r = Array.isArray(raw) ? raw[0] || {} : raw || {};
  const colorKey = r.colorKey || 'gray';
  const extraColors = COLOR_SPOKEN_VARIANTS[colorKey] || [];
  const objectName = r.objectName || 'شيء';
  const colorName = r.colorName || 'رمادي';

  return {
    hasObject: r.hasObject !== undefined ? Boolean(r.hasObject) : Boolean(r.objectName),
    guidance: r.guidance || '',
    className: r.className || r.objectKey || 'object',
    objectName,
    category: r.category || 'everyday',
    colorKey,
    colorName,
    colorHex: /^#[0-9a-fA-F]{6}$/.test(r.colorHex || '') ? r.colorHex : '#94A3B8',
    isDanger: Boolean(r.isDanger),
    sentence: r.sentence || `هذا ${objectName}، ولونه ${colorName}.`,
    repeatTarget: r.repeatTarget || `${objectName} ${colorName}`.trim(),
    objectAliases: [...new Set([...(Array.isArray(r.objectAliases) ? r.objectAliases : []), objectName].filter(Boolean))],
    colorAliases: [...new Set([...(Array.isArray(r.colorAliases) ? r.colorAliases : []), colorName, ...extraColors].filter(Boolean))],
    sensoryHint: r.sensoryHint || '',
    funFact: r.funFact || '',
  };
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err && err.name === 'AbortError') {
      const timeoutErr = new Error('انتهت مهلة الانتظار.');
      timeoutErr.code = 'TIMEOUT';
      throw timeoutErr;
    }
    const netErr = new Error('النت ضعيف، حاول تاني.');
    netErr.code = 'NETWORK_ERROR';
    throw netErr;
  } finally {
    clearTimeout(timer);
  }
}

export class VisionEngine {
  constructor() {
    this.captureCanvas = document.createElement('canvas');
    this.captureCtx = this.captureCanvas.getContext('2d');
    this.hashCanvas = document.createElement('canvas');
    this.hashCanvas.width = 9;
    this.hashCanvas.height = 8;
    this.hashCtx = this.hashCanvas.getContext('2d', { willReadFrequently: true });
    this.lastFrameHash = '';
    this.isBusy = false;
    this.hasLocalBackend = false;
  }

  async init() {
    try {
      const res = await fetchWithTimeout('/api/config', { cache: 'no-store' }, 2000);
      const ct = res.headers.get('content-type') || '';
      if (res.ok && ct.includes('application/json')) {
        const data = await res.json();
        this.hasLocalBackend = Boolean(data.configured);
      }
    } catch {
      this.hasLocalBackend = false;
    }
  }

  computeFrameHash(videoEl) {
    if (!videoEl || videoEl.readyState < 2 || !videoEl.videoWidth) return '';
    const vw = videoEl.videoWidth;
    const vh = videoEl.videoHeight;
    const sw = Math.round(vw * 0.78);
    const sh = Math.round(vh * 0.78);
    const sx = Math.round((vw - sw) / 2);
    const sy = Math.round((vh - sh) / 2);

    this.hashCtx.drawImage(videoEl, sx, sy, sw, sh, 0, 0, 9, 8);
    const { data } = this.hashCtx.getImageData(0, 0, 9, 8);
    let bits = '';
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const i1 = (y * 9 + x) * 4;
        const i2 = (y * 9 + x + 1) * 4;
        const l1 = data[i1] * 0.299 + data[i1 + 1] * 0.587 + data[i1 + 2] * 0.114;
        const l2 = data[i2] * 0.299 + data[i2 + 1] * 0.587 + data[i2 + 2] * 0.114;
        bits += l1 > l2 ? '1' : '0';
      }
    }
    return bits;
  }

  hasFrameChanged(videoEl, minBitDiff = 5) {
    const hash = this.computeFrameHash(videoEl);
    if (!hash) return false;
    if (!this.lastFrameHash) return true;
    let diff = 0;
    for (let i = 0; i < hash.length; i++) {
      if (hash[i] !== this.lastFrameHash[i]) diff++;
    }
    return diff >= minBitDiff;
  }

  resetFrameCache() {
    this.lastFrameHash = '';
  }

  captureLaserSnapshot(videoEl) {
    if (!videoEl || videoEl.readyState < 2 || !videoEl.videoWidth) {
      return null;
    }

    const vw = videoEl.videoWidth;
    const vh = videoEl.videoHeight;
    const cropRatio = 0.84;
    const sw = Math.round(vw * cropRatio);
    const sh = Math.round(vh * cropRatio);
    const sx = Math.round((vw - sw) / 2);
    const sy = Math.round((vh - sh) / 2);

    const effectiveType = navigator?.connection?.effectiveType || '4g';
    const isSlowNet = ['slow-2g', '2g', '3g'].includes(effectiveType);
    const maxDim = isSlowNet ? 384 : 540;
    const jpegQuality = isSlowNet ? 0.68 : 0.8;

    const scale = Math.min(1, maxDim / Math.max(sw, sh));
    const dw = Math.max(160, Math.round(sw * scale));
    const dh = Math.max(120, Math.round(sh * scale));

    this.captureCanvas.width = dw;
    this.captureCanvas.height = dh;
    this.captureCtx.drawImage(videoEl, sx, sy, sw, sh, 0, 0, dw, dh);
    this.lastFrameHash = this.computeFrameHash(videoEl);

    const dataUrl = this.captureCanvas.toDataURL('image/jpeg', jpegQuality);
    return dataUrl.split(',')[1] || null;
  }

  async _identifyViaLocalServer(imageBase64) {
    const res = await fetchWithTimeout(
      '/api/identify',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64, mimeType: 'image/jpeg', mode: 'kids' }),
      },
      15000
    );

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      const err = new Error('تعذر التعرف على الصورة الآن.');
      err.code = 'NO_RESPONSE';
      throw err;
    }
    return enrichResult(data.result);
  }

  async _identifyViaDirectCloud(imageBase64) {
    const promptText =
      'تعرّف على أبرز شيء أو طعام ظاهر أمام الكاميرا في هذه الصورة ولونه الحقيقي، وأعد JSON فقط.';

    let lastErr = null;
    for (const modelName of MODEL_CHAIN) {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        modelName
      )}:generateContent?key=${encodeURIComponent(_K)}`;

      const generationConfig = {
        responseMimeType: 'application/json',
        temperature: 0.15,
      };
      if (modelName.startsWith('gemini-3')) {
        generationConfig.thinkingConfig = { thinkingLevel: 'minimal' };
      }

      try {
        const res = await fetchWithTimeout(
          endpoint,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: KIDS_SYSTEM_PROMPT }] },
              contents: [
                {
                  role: 'user',
                  parts: [
                    { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } },
                    { text: promptText },
                  ],
                },
              ],
              generationConfig,
            }),
          },
          15000
        );

        if (res.ok) {
          const json = await res.json();
          const rawText = (json?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
          if (!rawText) continue;
          const cleaned = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
          return enrichResult(JSON.parse(cleaned));
        }

        if (res.status !== 404 && res.status !== 500 && res.status !== 503) {
          break;
        }
      } catch (err) {
        lastErr = err;
        if (err?.code === 'NETWORK_ERROR') throw err;
      }
    }

    const failErr = new Error('لم نستطع التعرف على الصورة الآن.');
    failErr.code = lastErr?.code || 'NO_RESPONSE';
    throw failErr;
  }

  async identifyFrame(videoEl) {
    if (this.isBusy) return null;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      const err = new Error('النت ضعيف، حاول تاني.');
      err.code = 'NETWORK_ERROR';
      throw err;
    }

    const imageBase64 = this.captureLaserSnapshot(videoEl);
    if (!imageBase64) return null;

    this.isBusy = true;
    try {
      if (this.hasLocalBackend) {
        try {
          return await this._identifyViaLocalServer(imageBase64);
        } catch {
          // Fall back seamlessly to direct cloud
        }
      }
      return await this._identifyViaDirectCloud(imageBase64);
    } finally {
      this.isBusy = false;
    }
  }
}
