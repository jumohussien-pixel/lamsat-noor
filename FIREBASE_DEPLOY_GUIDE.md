# دليل رفع تطبيق «لمسة نور» على Firebase Hosting (خطوة بخطوة) 🚀

يمنحك **Firebase Hosting** رابطاً مجانياً سريعاً يعمل بـ **HTTPS** (وهو شرط أساسي لفتح كاميرا الموبايل الخلفية والميكروفون وتثبيت التطبيق PWA على شاشة الهاتف).

> 🔒 **أمان تام:** ملف `firebase.json` مُعدّ مسبقاً لتجاهل ملف `.env` وملفات الخادم المحلي؛ لذلك لن يُرفع مفتاحك السري أبداً على الإنترنت، وستدخله مرة واحدة من داخل التطبيق على موبايلك فقط.

---

## الخطوة 1: إنشاء مشروع مجاني على Firebase
1. افتح [console.firebase.google.com](https://console.firebase.google.com/) وسجّل الدخول بحساب Google.
2. اضغط **Add project (إضافة مشروع)** واكتب الاسم مثلاً: `lamsat-noor` ثم اضغط **Continue** حتى يُنشأ المشروع.
3. انسخ **Project ID** الظاهر أسفل اسم المشروع (مثلاً `lamsat-noor-12345`).

---

## الخطوة 2: تثبيت أداة Firebase على جهازك (مرة واحدة فقط)
افتح **PowerShell** أو **Terminal** وشغّل:
```powershell
npm install -g firebase-tools
```

---

## الخطوة 3: تسجيل الدخول وربط المشروع
انتقل إلى مجلد تطبيق **لمسة نور**:
```powershell
cd C:\Users\IT\.gemini\antigravity\scratch\noor-laser-scanner
```
ثم سجّل دخولك بحساب Google:
```powershell
firebase login
```
واربط المجلد بمشروعك على Firebase (استبدل `PROJECT_ID` بمعرف مشروعك من الخطوة 1):
```powershell
firebase use PROJECT_ID
```
*(أو افتح ملف `.firebaserc` واستبدل `lamsat-noor-app` بـ `PROJECT_ID` الخاص بك).*

---

## الخطوة 4: رفع التطبيق والحصول على الرابط!
شغّل أمر النشر:
```powershell
firebase deploy --only hosting
```
خلال ثوانٍ سيظهر لك رابط التطبيق المباشر مثل:
```
Hosting URL: https://PROJECT_ID.web.app
```

---

## الخطوة 5: فتح «لمسة نور» وتثبيته على الموبايل 📱
1. افتح الرابط `https://PROJECT_ID.web.app` من متصفح **Google Chrome** على الأندرويد (أو **Safari** على الآيفون).
2. اضغط على القائمة (**⋮**) ثم **Add to Home screen / تثبيت التطبيق** ليظهر تطبيق **«لمسة نور»** بأيقونته الخاصة على شاشة الموبايل!
3. افتح التطبيق، اضغط **«ابدأ»**، ثم اضغط **«أدخل مفتاح Gemini»** والصق مفتاحك مرة واحدة — وسيعمل مباشرة بالكاميرا الخلفية والميكروفون! 🌟
