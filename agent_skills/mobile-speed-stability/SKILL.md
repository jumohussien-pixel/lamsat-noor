---
name: mobile-speed-stability
description: Speed and stability enhancements for Lamsat Noor (لمسة نور) mobile PWA — Zod schema sanitization, dotenv config, Gzip compression, Screen Wake Lock, adaptive JPEG bandwidth scaling, and perceptual frame deduplication (dHash).
---

# Mobile Speed & Stability Skill (لمسة نور)

1. **Zod Runtime Validation (`zod`)**: Validates and sanitizes every Gemini Vision JSON response on the server so partial or malformed outputs can never crash the app.
2. **Dotenv Configuration (`dotenv`)**: Reliable cross-platform `.env` loading for local Gemini API keys.
3. **HTTP Gzip Compression (`node:zlib`)**: Compresses HTML, CSS, JS, SVG, and JSON responses by ~70% for fast mobile loading.
4. **Screen Wake Lock (`src/screen-wake-lock.js`)**: Keeps the mobile phone screen awake while the camera is active so the device never locks while a blind child uses it hands-free.
5. **Adaptive Mobile Compression + Perceptual dHash (`src/gemini-vision-client.js`)**: Automatically lowers snapshot size on slow 2G/3G networks and skips duplicate identical frames so scanning stays fast and never wastes API quota.
