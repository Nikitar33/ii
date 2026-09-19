# Sieger AI

Modern AI chat application with a mobile-first PWA design for iPhone and web browsers.

## Features
- iPhone-friendly PWA install experience
- desktop and mobile responsive layout
- chat history in browser storage
- theme toggle
- editable system prompt
- OpenAI-compatible API support
- local Ollama fallback support

## Local run

1. Install dependencies:

```bash
npm install
```

2. Copy environment variables:

```bash
copy .env.example .env
```

3. Set at least one AI backend:

- For OpenAI:

```env
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-4o-mini
```

- For Ollama:

```env
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1
```

4. Start the app:

```bash
node server.js
```

Open:

- http://localhost:3001

## iPhone PWA install

Open the app in Safari and choose:
- Share
- Add to Home Screen

This installs the app-like shortcut on the home screen.

## Public deployment on Render

This repository includes `render.yaml` for a single public web service. The app and
backend are deployed together, so there is no separate frontend configuration.

1. Push this folder to a GitHub repository. Do not commit `.env`.
2. In Render, choose **New +** -> **Blueprint** and select the repository.
3. Render reads `render.yaml` and creates the free web service.
4. Set `OPENAI_API_KEY` in Render's environment variables.
5. Open the generated `onrender.com` URL in Safari and choose **Share** -> **Add to Home Screen**.

The public server cannot use `http://localhost:11434` for Ollama: that address points
to the hosting container itself. For a public deployment, use an OpenAI-compatible
remote provider by setting `OPENAI_BASE_URL` and `OPENAI_MODEL`, or host Ollama on a
public server with authentication and set `OLLAMA_BASE_URL` manually.

## Notes

This project is designed as a lightweight AI chat app. The hosting free tier and AI
provider may have usage limits, rate limits, or require billing depending on the
provider you choose.
