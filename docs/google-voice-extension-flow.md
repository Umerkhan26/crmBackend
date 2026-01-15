## Simple explanation (what your PDF proposes)

Because Google Voice has **no public API** for call tracking, we use a Chrome Extension that:

- Opens Google Voice web page (where you are already logged in)
- Watches the page to detect call **start/end**
- (Optional) captures call audio with consent and sends it to Speech-to-Text
- Saves call data + transcript into CRM via backend APIs

## What you can do right now with this repo

This backend now exposes:

- `POST /api/calls/start`
- `PATCH /api/calls/:id/end`
- `PATCH /api/calls/:id/transcript`
- `GET /api/calls` (list)
- `GET /api/calls/:id` (details)

Auth is the same as other endpoints: `Authorization: Bearer <JWT>`.

## Local dev steps

### 1) Run backend

- Set `.env` DB values (same as your current setup)
- Start your server (whatever you use: `npm run dev`, `nodemon`, etc.)
- Backend will auto-create/alter a `calls` table on startup via Sequelize `sync({ alter: true })`

### 2) Load the Chrome extension scaffold

- Chrome → Extensions → enable Developer Mode
- Load unpacked → select `extension/`
- Login to Google Voice in that Chrome profile

### 3) Test the flow

- Click extension icon
- Set backend base URL (example `http://localhost:3000`)
- Paste JWT (from your CRM login)
- Enter a phone number
- Click **Open Voice & Dial**

The content script will attempt to:

- Type the number in the Voice dial box
- Click the call button (best-effort)
- Observe the DOM for call start/end and post to backend

## Next step (to match the PDF fully: live transcript)

To get a **live transcript** like the PDF:

- Extension uses `tabCapture` to capture the call audio stream (with explicit consent)
- Audio is streamed/chunked to an STT service (Whisper/cloud)
- The returned transcript text is then saved via `PATCH /api/calls/:id/transcript`

This repo now includes an MVP transcription path:

- Extension captures tab audio **in memory only** (no DB storage)
- Extension uploads to `POST /api/calls/:id/transcribe`
- Backend calls OpenAI Whisper (`OPENAI_API_KEY` required)
- Backend saves transcript text into the call record

Notes:
- This is not a perfect “live subtitles” experience yet; it uploads at call end in the MVP.

