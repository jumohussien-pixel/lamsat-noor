/**
 * NoorLaser - Server-side Gemini Vision Engine (@google/genai)
 * Uses gemini-2.5-flash with strict JSON structured output so the app can recognize
 * ANY food, household object, color, and safety hazard in clear Modern Standard Arabic.
 */

import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';
import { GoogleGenAI, Type } from '@google/genai';

const DEFAULT_MODEL = 'gemini-3-flash-preview';
const FALLBACK_MODELS = [
  'gemini-3-flash-preview',
  'gemini-flash-lite-latest',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
];

// Zod runtime validator guarantees Gemini output never breaks the app even if a field is missing
const VisionResponseValidator = z.object({
  hasObject: z.boolean().catch(false),
  guidance: z.string().catch(''),
  objectKey: z.string().catch('object'),
  objectName: z.string().catch('شيء'),
  category: z.string().catch('everyday'),
  colorKey: z.string().catch('gray'),
  colorName: z.string().catch('رمادي'),
  colorHex: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .catch('#94A3B8'),
  isDanger: z.boolean().catch(false),
  sentence: z.string().catch(''),
  repeatTarget: z.string().catch(''),
  objectAliases: z.array(z.string()).catch([]),
  colorAliases: z.array(z.string()).catch([]),
  sensoryHint: z.string().catch(''),
  funFact: z.string().catch(''),
});

const IDENTIFICATION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    hasObject: {
      type: Type.BOOLEAN,
      description:
        'true ONLY if a clear object, food item, drink, utensil, toy, or tool is presented in the center foreground. false if the image is just an empty wall, ceiling, floor, blurry motion, or only a person face without holding an object.',
    },
    guidance: {
      type: Type.STRING,
      description:
        'Short calm Arabic guidance if hasObject is false (e.g. "قرّب الشيء نحو منتصف شعاع الليزر."). Empty string when hasObject is true.',
    },
    objectKey: {
      type: Type.STRING,
      description: 'Short lowercase English slug for deduplication (e.g. "silver_spoon", "cheese_sandwich", "red_apple").',
    },
    objectName: {
      type: Type.STRING,
      description: 'Clear, accurate Modern Standard Arabic name of the object or food item (e.g. "ملعقة", "شطيرة جبن", "خيار", "بطاطس مقلية", "مفتاح").',
    },
    category: {
      type: Type.STRING,
      description: 'One of: food, drink, utensil, everyday, toy, danger.',
    },
    colorKey: {
      type: Type.STRING,
      description: 'One of: silver, gold, red, blue, green, yellow, orange, purple, pink, brown, white, black, gray, multicolor.',
    },
    colorName: {
      type: Type.STRING,
      description: 'Masculine Arabic color name for the object itself — NOT the background (e.g. "فضي", "أحمر", "أخضر", "أصفر", "متعدد الألوان").',
    },
    colorHex: {
      type: Type.STRING,
      description: 'Representative CSS hex color of the object itself (e.g. "#C4CCD4" for silver, "#EF4444" for red).',
    },
    isDanger: {
      type: Type.BOOLEAN,
      description: 'true if the object is sharp, hot, medicinal, chemical, or hazardous for a blind child (knife, scissors, razor, needle, lighter, pills/medicine bottle, cleaning chemical).',
    },
    sentence: {
      type: Type.STRING,
      description:
        'Natural Modern Standard Arabic sentence matching Arabic gender: e.g. "هذه ملعقة، ولونها فضي." or "هذا خيار، ولونه أخضر." or "هذه شطيرة جبن، ولونها أصفر.". If isDanger is true, write a calm urgent safety warning: "انتبه يا بطل! هذا سكين حاد، ضعه بهدوء على الطاولة فوراً ونادِ أحد الكبار."',
    },
    repeatTarget: {
      type: Type.STRING,
      description:
        'Short 2-word easy Arabic phrase matching gender for a child to repeat aloud (e.g. "ملعقة فضية", "شوكة فضية", "كوب أزرق", "تفاحة حمراء", "خيار أخضر"). Empty string if isDanger is true.',
    },
    objectAliases: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: '3 to 6 Arabic and Egyptian everyday spoken variants a child might say for this object/food (e.g. ["ملعقة", "معلقة", "معلأة"] or ["شطيرة", "سندوتش", "ساندوتش", "جبنة", "جبن"]).',
    },
    colorAliases: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: '3 to 5 Arabic and Egyptian spoken variants of the color (e.g. ["فضي", "فضية", "فضيه", "سيلفر"]).',
    },
    sensoryHint: {
      type: Type.STRING,
      description: 'One short warm Arabic sentence describing the color or feel for a blind child using touch, warmth, smell, or nature (e.g. "اللون الفضي لامع وبارد الملمس مثل المعادن.").',
    },
    funFact: {
      type: Type.STRING,
      description: 'One short joyful Arabic sentence suitable for a child about this food or object (e.g. "الخيار خضار منعش ومقرمش ومفيد لجسمنا.").',
    },
  },
  required: [
    'hasObject',
    'guidance',
    'objectKey',
    'objectName',
    'category',
    'colorKey',
    'colorName',
    'colorHex',
    'isDanger',
    'sentence',
    'repeatTarget',
    'objectAliases',
    'colorAliases',
    'sensoryHint',
    'funFact',
  ],
};

const SYSTEM_PROMPT = `أنت عين تطبيق "لمسة نور"، وهو تطبيق موبايل ذكي بالليزر الناطق للأطفال المكفوفين وضعاف البصر لاكتشاف الطعام والأشياء وألوانها بالصوت.

قواعد مهمة جداً:
1. تعرّف دائماً على أبرز شيء أو طعام ظاهر أمام الكاميرا (سواء كان ممسوكاً باليد أو موضوعاً على الطاولة أو المكتب أمام الكاميرا).
2. اجعل hasObject = true دائماً طالما يظهر في الصورة أي طعام أو مشروب أو فاكهة أو خضار أو أداة منزلية أو مكتبية أو جهاز أو لعبة أو ملابس أو أثاث (مثل: ملعقة، شوكة، كوب، طبق، زجاجة، خبز، سندوتش، أرز، مكرونة، بطاطس، شيبسي، بسكويت، شوكولاتة، جبن، تفاحة، موزة، برتقالة، خيار، طماطم، قلم، كتاب، كراسة، هاتف، حاسوب، فأرة، لوحة مفاتيح، جهاز تحكم/ريموت، نظارة، مفاتيح، ساعة، حقيبة، مناديل، كرسي، لعبة...).
3. لا تجعل hasObject = false إلا إذا كانت الكاميرا مغطاة تماماً (صورة سوداء) أو موجهة إلى حائط فارغ تماماً بلا أي شيء.
4. حدد اللون الحقيقي للشيء نفسه بدقة (وإذا كان معدنياً كالملعقة أو الشوكة الاستيل فاذكر لونه "فضي").
5. درع الأمان: إذا كان الشيء حاداً أو خطراً على الطفل (سكين، مقص، شفرة، إبرة، ولاعة، دواء/أقراص)، اجعل isDanger = true واكتب تحذيراً هادئاً في sentence.
6. استخدم اللغة العربية الفصحى السهلة مع مراعاة التذكير والتأنيث:
   - للمؤنث: "هذه ملعقة، ولونها فضي." و repeatTarget: "ملعقة فضية"
   - للمذكر: "هذا كوب، ولونه أزرق." و repeatTarget: "كوب أزرق"
7. في objectAliases و colorAliases أضف الكلمات الفصحى والمصرية اليومية التي قد ينطقها الطفل المصري.`;

/**
 * Parses KEY=VALUE lines from a local .env file reliably using dotenv.
 */
function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  try {
    return dotenv.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return {};
  }
}

export class GeminiVisionServer {
  constructor(projectDir) {
    this.projectDir = projectDir;
    this.envPath = path.join(projectDir, '.env');
    this.apiKey = '';
    this.model = DEFAULT_MODEL;
    this.client = null;
    this.reloadConfig();
  }

  reloadConfig() {
    const fileEnv = parseEnvFile(this.envPath);
    const key = (fileEnv.GEMINI_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();
    const model = (fileEnv.GEMINI_MODEL || process.env.GEMINI_MODEL || DEFAULT_MODEL).trim();

    this.apiKey = key && !key.includes('ضع_مفتاح') ? key : '';
    this.model = model || DEFAULT_MODEL;
    this.client = this.apiKey ? new GoogleGenAI({ apiKey: this.apiKey }) : null;
  }

  getStatus() {
    return {
      configured: Boolean(this.client),
      model: this.model,
    };
  }

  /**
   * Saves the user's Gemini API key locally to .env (gitignored, never sent back to browser).
   */
  saveConfig({ apiKey, model }) {
    const cleanKey = String(apiKey || '').trim();
    const cleanModel = String(model || this.model || DEFAULT_MODEL).trim();
    if (!cleanKey || cleanKey.length < 15) {
      throw new Error('مفتاح Gemini غير صحيح. تأكد من نسخه كاملاً من Google AI Studio.');
    }

    const content = `# NoorLaser local configuration (saved locally, never shared)\nGEMINI_API_KEY=${cleanKey}\nGEMINI_MODEL=${cleanModel}\n`;
    fs.writeFileSync(this.envPath, content, 'utf8');
    this.reloadConfig();
    return this.getStatus();
  }

  async _callModel(modelName, base64Data, mimeType, userText) {
    const config = {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: 'application/json',
      responseSchema: IDENTIFICATION_SCHEMA,
      temperature: 0.15,
    };

    // Minimize thinking latency for near-instant live camera recognition (~1.4s instead of ~16s)
    if (modelName.startsWith('gemini-3')) {
      config.thinkingConfig = { thinkingLevel: 'minimal' };
    } else if (modelName.startsWith('gemini-2.5')) {
      config.thinkingConfig = { thinkingBudget: 0 };
    }

    const response = await this.client.models.generateContent({
      model: modelName,
      contents: [
        {
          inlineData: {
            data: base64Data,
            mimeType,
          },
        },
        { text: userText },
      ],
      config,
    });

    const rawText = (response.text || '').trim();
    if (!rawText) {
      throw new Error('لم يرد Gemini بنتيجة واضحة.');
    }
    return JSON.parse(rawText);
  }

  /**
   * Identifies the object/food in a base64 camera snapshot using Gemini Vision.
   */
  async identifyImage({ imageBase64, mimeType = 'image/jpeg', mode = 'kids' }) {
    if (!this.client) {
      const err = new Error('لم يتم إدخال مفتاح Gemini API بعد. اضغط على «إعداد مفتاح Gemini» بالأعلى لإدخاله.');
      err.code = 'NO_API_KEY';
      throw err;
    }

    const cleanBase64 = String(imageBase64 || '').replace(/^data:image\/[a-zA-Z+]+;base64,/, '').trim();
    if (!cleanBase64 || cleanBase64.length < 100) {
      throw new Error('الصورة الملتقطة غير صالحة.');
    }

    const userText =
      mode === 'adults'
        ? 'تعرّف بدقة وسرعة على الشيء أو الطعام الموجود في منتصف الصورة ولونه الحقيقي.'
        : 'تعرّف بدقة على الشيء أو الطعام الذي يضعه الطفل في منتصف شعاع الليزر، ولونه الحقيقي، وهل هو آمن أم حاد.';

    const modelsToTry = [this.model, ...FALLBACK_MODELS.filter((m) => m !== this.model)];
    let lastErr = null;

    for (const modelName of modelsToTry) {
      try {
        const rawParsed = await this._callModel(modelName, cleanBase64, mimeType, userText);
        const parsed = VisionResponseValidator.parse(rawParsed);
        return {
          hasObject: parsed.hasObject,
          guidance: parsed.guidance,
          className: parsed.objectKey || 'object',
          objectName: parsed.objectName || 'شيء',
          category: parsed.category || 'everyday',
          colorKey: parsed.colorKey || 'gray',
          colorName: parsed.colorName || 'رمادي',
          colorHex: parsed.colorHex,
          isDanger: parsed.isDanger,
          sentence: parsed.sentence,
          repeatTarget: parsed.repeatTarget || `${parsed.objectName || ''} ${parsed.colorName || ''}`.trim(),
          objectAliases: parsed.objectAliases.length ? parsed.objectAliases : [parsed.objectName || ''],
          colorAliases: parsed.colorAliases.length ? parsed.colorAliases : [parsed.colorName || ''],
          sensoryHint: parsed.sensoryHint,
          funFact: parsed.funFact,
          modelUsed: modelName,
        };
      } catch (err) {
        lastErr = err;
        const msg = String(err?.message || '');
        const status = err?.status || err?.statusCode;
        // Stop retrying if the key is invalid or quota exceeded
        if (status === 401 || status === 403 || msg.includes('API_KEY_INVALID') || msg.includes('API key not valid')) {
          const authErr = new Error('مفتاح Gemini API غير صالح. يرجى التأكد من المفتاح وإدخاله مجدداً.');
          authErr.code = 'INVALID_API_KEY';
          throw authErr;
        }
        if (status === 429 || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota')) {
          const quotaErr = new Error('تم استنفاد الحد المجاني المؤقت لـ Gemini. انتظر بضع ثوانٍ ثم حاول مجدداً.');
          quotaErr.code = 'QUOTA_EXCEEDED';
          throw quotaErr;
        }
        // Retry next fallback model on 404 (deprecated) or 503/500 (temporary high demand)
        const retryable =
          status === 404 ||
          status === 503 ||
          status === 500 ||
          msg.includes('not found') ||
          msg.includes('NOT_FOUND') ||
          msg.includes('UNAVAILABLE') ||
          msg.includes('high demand');
        if (!retryable) {
          break;
        }
      }
    }

    throw new Error(lastErr?.message || 'حدث خطأ أثناء الاتصال بـ Gemini Vision.');
  }
}
