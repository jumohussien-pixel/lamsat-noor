<div dir="rtl">

# لمسة نور (Lamsat Noor) 🌟

**رفيق ذكي بالصوت والليزر الناطق للأطفال المكفوفين وضعاف البصر لاكتشاف الطعام والأشياء وألوانها بأمان ومتعة.**

[![التطبيق المباشر](https://img.shields.io/badge/التجربة_المباشرة-lamsat--noor.web.app-f5a623?style=for-the-badge)](https://lamsat-noor.web.app)
[![فيديو العرض](https://img.shields.io/badge/فيديو_العرض_بالعربية-2:03_Full_HD-2dd4bf?style=for-the-badge)](./video/lamsat-noor-demo-ar.mp4)
[![PWA](https://img.shields.io/badge/Mobile_PWA-Android_%26_iOS-121820?style=for-the-badge)](https://lamsat-noor.web.app)

---

## 🔗 الروابط المباشرة (Live Demo & Showcase Video)

- **التطبيق المباشر على الموبايل (Live Mobile PWA):** **[https://lamsat-noor.web.app](https://lamsat-noor.web.app)**
- **فيديو العرض الرسمي بالذكاء الاصطناعي (العربية — `1920x1080` Full HD، المدة `2:03`):** **[`video/lamsat-noor-demo-ar.mp4`](./video/lamsat-noor-demo-ar.mp4)**

> لمشاهدة الفيديو مباشرة من GitHub، اضغط على الرابط أعلاه أو افتح الملف [`video/lamsat-noor-demo-ar.mp4`](./video/lamsat-noor-demo-ar.mp4) (بدقة `1920x1080` وتعليق صوتي عربي واضح).

---

## 💡 فكرة المشروع (عن «لمسة نور»)

يواجه الأطفال المكفوفون وضعاف البصر تحدياً يومياً في التعرّف السريع على الطعام والأدوات المحيطة بهم، وفهم مفهوم **الألوان** بطريقة قريبة من حواسهم، مع الحاجة إلى حماية فورية من الأشياء الخطرة.

**«لمسة نور»** يحوّل الهاتف المحمول إلى **ليزر ناطق لطيف ومُشجّع** يرافق الطفل خطوة بخطوة: يوجّه الكاميرا الخلفية بنبضات صوتية واهتزازية هادئة، يتعرّف فورياً على الطعام والأشياء، يشرح اللون بوصف حسّي محبب (مثل دفء الشمس أو برودة الماء)، ثم يستمع بصبر لتكرار الطفل للكلمة ويكافئه بالنجوم.

---

## ✨ أبرز المميزات

- **📱 تطبيق موبايل PWA عمودي مُصمم للأطفال:**
  - واجهة عربية كاملة (`RTL`) بألوان داكنة عالية التباين (`WCAG AAA`)، أزرار كبيرة سهلة اللمس، وقابل للتثبيت المباشر على الشاشة الرئيسية في Android وiOS مع عمل الواجهة دون اتصال عبر Service Worker.
  - ميزة **منع إطفاء الشاشة (Screen Wake Lock)** ودعم **الكشاف (Torch)** للتصوير الواضح في الإضاءة الضعيفة.
- **🔦 الكاميرا الخلفية + شعاع الليزر الصوتي الاهتزازي (Audio-Haptic Sonar Laser):**
  - مسح ضوئي حي عبر الكاميرا الخلفية مع نغمات سونار إرشادية واهتزاز لمسي يساعد الطفل على تثبيت الشيء أمام العدسة دون الحاجة للنظر إلى الشاشة.
- **🍎 التعرّف الفوري على الطعام والأشياء + الوصف الحسّي للألوان:**
  - يلتقط أنواع الطعام والأدوات اليومية (مثل التفاح، الشطائر، الأكواب، الملاعق وغيرها) وينطق الاسم واللون بجملة عربية بسيطة، مع وصف حسّي يقرّب معنى اللون لحواس الطفل.
- **🎙️ الاستماع الصبور للنطق العربي ونظام النجوم التحفيزي:**
  - يستمع لتكرار الطفل بصبر ومرونة ذكية في مطابقة النطق العربي، يشجّعه صوتياً، ويمنحه نجوماً تُضاف إلى رصيده اليومي.
  - يتضمن أزرار مساعدة سريعة للمعلّم أو ولي الأمر وأمثلة جاهزة للتجربة المباشرة أثناء العرض والتحكيم.
- **🛡️ درع الأمان للأطفال (Child Safety Shield):**
  - رصد استباقي للأشياء الحادة أو الساخنة أو غير الآمنة (مثل المقص أو السكين أو المواد الخطرة) مع تنبيه صوتي واهتزازي فوري يطلب من الطفل الابتعاد وطلب مساعدة الكبار.
- **💾 حماية ضد الأعطال وحفظ تلقائي فوري (Crash-Proof & Auto-Save):**
  - حفظ تلقائي محلي لرصيد النجوم، سجل اكتشافات اليوم، وإعدادات الصوت بحيث يعود الطفل إلى تقدّمه بالضبط حتى عند إغلاق التطبيق أو انقطاع الشبكة مؤقتاً.

---

## 🏗️ البنية التقنية والهيكلية (Architecture & Project Structure)

يعتمد التطبيق على بنية ويب حديثة وخفيفة بدون أطر ثقيلة لضمان استجابة سريعة على الهواتف المتوسطة:
- **الذكاء البصري السحابي (Cloud Visual AI):** لتحليل اللقطات الملتقطة من الكاميرا وتحديد الأشياء والأطعمة والألوان ومستوى الأمان بدقة عالية.
- **Web Speech API & Audio/Haptics API:** للنطق العربي الطبيعي، الاستماع التفاعلي لتكرار الطفل، وتوليد نبضات السونار والاهتزاز.
- **Firebase Hosting + PWA Service Worker:** لاستضافة آمنة وسريعة مع تخزين مؤقت ذكي للواجهة.

```text
noor-laser-scanner/
├── index.html                        # الصفحة الرئيسية (شاشة الترحيب + واجهة المسح العمودية)
├── styles.css                        # تصميم عالي التباين مخصص للموبايل والوصولية
├── manifest.webmanifest              # إعدادات تطبيق الموبايل PWA
├── sw.js                             # Service Worker للتشغيل السريع والعمل بدون اتصال
├── server.mjs                        # خادم التطوير والتشغيل المحلي (Node.js)
├── firebase.json                     # إعدادات الاستضافة على Firebase Hosting
├── assets/                           # أيقونات وهوية «لمسة نور» (SVG / PNG)
├── video/
│   └── lamsat-noor-demo-ar.mp4       # فيديو العرض الرسمي بالذكاء الاصطناعي (1920x1080 - 2:03)
├── src/
│   ├── app.js                        # المنسّق الرئيسي لتجربة الطفل وحالات المسح
│   ├── laser-scanner-engine.js       # محرك الكاميرا الخلفية، شعاع الليزر، السونار والاهتزاز
│   ├── vision-engine.js              # محرك التحليل البصري والوصف الحسّي ودرع الأمان
│   ├── arabic-voice-coach.js         # المدرب الصوتي العربي والاستماع التفاعلي الصبور
│   ├── safety-storage.js             # الحفظ التلقائي للنجوم وسجل الاكتشافات والحماية من الأعطال
│   ├── screen-wake-lock.js           # إبقاء شاشة الهاتف مضاءة أثناء الاستخدام
│   └── gemini-vision-server.mjs      # طبقة الخادم المحلي لتحليل الصور
└── agent_skills/
    └── arabic-web-speech/            # قواعد تهيئة ومطابقة النطق العربي للأطفال
```

---

## 🚀 التشغيل المحلي (Local Run Instructions)

لتشغيل المشروع محلياً على جهازك (يتطلب **Node.js 18+**):

```bash
# 1. استنساخ المستودع
git clone https://github.com/jumohussien-pixel/lamsat-noor.git
cd lamsat-noor

# 2. تثبيت الاعتماديات
npm install

# 3. (اختياري للتشغيل المحلي مع خادم التحليل) نسخ ملف البيئة وإضافة المفتاح
cp .env.example .env

# 4. تشغيل التطبيق محلياً
npm start
```

بعد التشغيل، افتح الرابط: `http://localhost:8080` في المتصفح (ولأفضل تجربة على الموبايل، افتح النسخة المنشورة عبر HTTPS على **[https://lamsat-noor.web.app](https://lamsat-noor.web.app)** لتفعيل الكاميرا والميكروفون الكاملين).

</div>

---

## 🌍 Concise English Summary (For Competition Judges)

**Lamsat Noor (لمسة نور — "Touch of Light")** is an accessible, child-first Arabic Mobile PWA designed for blind and visually impaired children to independently explore food, everyday objects, and colors through voice, sound, and touch.

- **Live Mobile PWA:** [https://lamsat-noor.web.app](https://lamsat-noor.web.app)
- **2-Minute Arabic AI Showcase Video (`1920x1080`, `2:03`):** [`video/lamsat-noor-demo-ar.mp4`](./video/lamsat-noor-demo-ar.mp4)
- **Core Capabilities:**
  - **Portrait Mobile PWA:** High-contrast RTL Arabic UI, installable on Android/iOS, screen wake lock, torch toggle, and offline shell caching.
  - **Audio-Haptic Sonar Laser:** Rear-camera live scanning guided by sonar audio cues and gentle haptic vibration.
  - **Instant Food, Object & Sensory Color Recognition:** Names food and everyday items aloud in friendly Arabic while translating colors into relatable sensory imagery.
  - **Patient Arabic Speech Coach & Star Rewards:** Listens patiently as the child repeats the word, celebrates progress with stars, and includes teacher/parent fallback controls and quick-demo buttons.
  - **Child Safety Shield:** Immediately warns the child away from sharp, hot, or hazardous items (e.g., scissors, knives).
  - **Crash-Proof Resilience & Auto-Save:** Automatically saves stars, daily discovery history, and audio preferences across sessions.
- **Architecture:** Vanilla ES Modules PWA + Cloud Visual AI + Web Speech & Haptics APIs + Firebase Hosting.
- **Run Locally:** `npm install` then `npm start` (serves on `http://localhost:8080`).
