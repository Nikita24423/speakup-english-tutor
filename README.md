# SpeakUp — English Voice Tutor

Голосовой чат с ИИ для практики английского (собеседование / разговор / коррекции).

## Запуск

```bash
cd english-tutor
cp .env.example .env.local
# вставь OPENROUTER_API_KEY из https://openrouter.ai/keys
npm install
npm run dev
```

Открой http://localhost:3000 — лучше **Chrome** или **Edge** (нужен Web Speech API).

## Что внутри

- **Бесплатные модели OpenRouter**: `openrouter/free` + Gemma / Llama / Qwen / Nemotron / GPT-OSS
- **Голос**: микрофон → распознавание речи в браузере → ответ модели → озвучка `speechSynthesis`
- API-ключ только в `.env.local` (не коммить)

## Безопасность

Если ключ светился в чате или в текстовом файле — перевыпусти его на https://openrouter.ai/keys
