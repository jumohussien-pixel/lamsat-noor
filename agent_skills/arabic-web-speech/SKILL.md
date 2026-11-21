---
name: arabic-web-speech
description: Modern Standard Arabic (الفصحى) SpeechSynthesis and SpeechRecognition setup for NoorLaser.
---

# Arabic Web Speech API Setup (الفصحى)

- **TTS (`window.speechSynthesis`)**: Uses `ar-SA` / `ar-001` priority via `selectBestArabicVoice()` in `arabic-speech-config.js`, with calm child-friendly rate (`0.92`) and adult mode rate (`1.02`).
- **STT (`SpeechRecognition` / `webkitSpeechRecognition`)**: Configured for `ar-SA` with `micStartDelayMs: 320` so the mic never captures the app's own voice.
- **Fuzzy Matching**: `normalizeArabicText()` strips diacritics and normalizes `أ/إ/آ`, `ة/ه`, and `ى/ي` to accurately understand young children's pronunciation.
