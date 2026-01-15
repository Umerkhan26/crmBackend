# Google Voice CRM Integration - System Explanation

## Overview
This system integrates Google Voice with your CRM to automatically track calls, record them (in memory only), transcribe using AI, and store transcripts linked to leads.

## What Was Built

### 1. Backend (Node.js/TypeScript)
- **Call Tracking API** - Stores call records with lead information
- **Speech-to-Text Service** - Uses self-hosted Whisper AI to transcribe audio
- **Database** - MySQL/Sequelize to store calls and transcripts

### 2. Frontend (React)
- **Dialer Modal** - Embedded dialer UI in Lead Detail page
- **Call History Tab** - Shows all calls with transcripts for each lead
- **Call Opt-in Button** - Appears next to phone numbers

### 3. Chrome Extension (Manifest V3)
- **Content Script** - Monitors Google Voice page for call events
- **Background Worker** - Coordinates API calls and audio capture
- **Offscreen Document** - Captures tab audio using MediaRecorder API

## How It Works - Step by Step

### Step 1: User Initiates Call
1. User opens Lead Detail page in CRM
2. Clicks "Call Opt-in" button next to phone number
3. Modal opens with dialer UI showing the phone number
4. User gives consent for recording
5. Clicks "Make Call" button

### Step 2: Google Voice Opens
1. Frontend opens Google Voice in popup window
2. Phone number is pre-filled in Google Voice
3. User logs into Google Voice (if needed) - uses `taylor@ttmg.live` account
4. User makes the call through Google Voice interface

### Step 3: Extension Detects Call
1. Chrome Extension content script monitors Google Voice page
2. Watches DOM for call indicators (call buttons, hang up buttons)
3. When call starts → Extension detects it automatically
4. Extension sends `POST /api/calls/start` to backend
5. Backend creates call record with:
   - Lead ID
   - Phone number
   - User ID
   - Timestamp
   - Status: "in_progress"

### Step 4: Audio Capture
1. Extension background worker creates offscreen document
2. Uses Chrome's `tabCapture` API to capture audio stream
3. MediaRecorder records audio in memory (NOT saved to disk)
4. Audio chunks stored temporarily in memory

### Step 5: Call Ends
1. Extension detects call end (hang up button disappears)
2. Stops audio recording
3. Sends `PATCH /api/calls/:id/end` to backend
4. Backend calculates call duration

### Step 6: Transcription
1. Extension uploads audio blob to `POST /api/calls/:id/transcribe`
2. Backend receives audio file
3. Backend uses self-hosted Whisper AI to transcribe
4. Whisper converts audio to text
5. Transcript text is stored in database
6. Audio file is immediately deleted (not stored)

### Step 7: Display in CRM
1. User goes to Lead Detail page → "Call History" tab
2. Sees all calls for that lead
3. Each call shows:
   - Phone number
   - Duration
   - Date/Time
   - Full transcript

## Technologies Used

### Backend
- **Node.js + TypeScript** - Server runtime
- **Express.js** - API framework
- **Sequelize** - Database ORM
- **MySQL** - Database
- **Whisper AI** - Self-hosted speech-to-text (Python library)
- **Multer** - File upload handling

### Frontend
- **React** - UI framework
- **Reactstrap** - UI components
- **React Router** - Navigation
- **Axios/Fetch** - API calls

### Chrome Extension
- **Manifest V3** - Extension format
- **Content Scripts** - DOM monitoring
- **Service Worker** - Background processing
- **Offscreen API** - Audio capture
- **Tab Capture API** - Audio stream access
- **MediaRecorder API** - Audio recording

## Chrome Extension Architecture

### Files Structure
```
extension/
├── manifest.json      # Extension configuration
├── background.js      # Service worker (API calls, coordination)
├── content.js         # Content script (monitors Google Voice)
├── offscreen.html     # Offscreen document HTML
├── offscreen.js       # Audio capture logic
├── popup.html         # Extension settings UI
└── popup.js           # Settings logic
```

### How Extension Works

**1. Content Script (content.js)**
- Injected into Google Voice pages
- Watches DOM for call lifecycle events
- Detects when call starts/ends
- Communicates with background worker

**2. Background Worker (background.js)**
- Runs in background (service worker)
- Handles API calls to backend
- Coordinates audio capture
- Manages offscreen document

**3. Offscreen Document (offscreen.js)**
- Hidden page for audio capture
- Uses MediaRecorder to record audio
- Uploads audio to backend when call ends
- Audio never saved to disk

## Data Flow

```
User Action
    ↓
Frontend (React)
    ↓
Opens Google Voice
    ↓
Chrome Extension (Content Script)
    ↓
Detects Call Start
    ↓
Background Worker
    ↓
Creates Offscreen Document
    ↓
Captures Audio Stream
    ↓
Call Ends
    ↓
Upload Audio to Backend
    ↓
Backend (Node.js)
    ↓
Whisper AI Transcription
    ↓
Store Transcript in Database
    ↓
Frontend Displays in Call History
```

## Security & Privacy

✅ **Audio Never Stored** - Only processed in memory, deleted immediately
✅ **Only Transcripts Saved** - Database stores text only, no audio files
✅ **Consent Required** - User must explicitly consent before recording
✅ **JWT Authentication** - All API calls require valid token
✅ **HTTPS** - Secure communication (in production)

## Installation Requirements

### Backend
- Node.js installed
- Python 3.8+ installed
- Whisper installed: `pip install openai-whisper`
- MySQL database
- Environment variables configured

### Frontend
- Node.js installed
- React app running
- Backend API accessible

### Chrome Extension
- Chrome browser
- Extension loaded (unpacked mode)
- JWT token configured
- Google Voice account logged in

## Key Features

1. **Automatic Call Detection** - No manual intervention needed
2. **Real-time Transcription** - AI converts speech to text
3. **Lead Linking** - Calls automatically linked to CRM leads
4. **Call History** - Complete record of all calls per lead
5. **No Audio Storage** - Privacy-friendly, only text stored
6. **Self-Hosted AI** - No external API costs (Whisper is free)

## Limitations

- Requires Chrome browser
- Google Voice UI changes may break detection (selectors need updates)
- Works only with Google Voice web interface
- Requires user to be logged into Google Voice
- Extension must be installed and configured

## How to Explain to Client

**Simple Explanation:**
"We built a Chrome Extension that watches Google Voice calls, records the audio temporarily, sends it to our server where AI transcribes it to text, and saves the text in your CRM linked to the lead. The audio is never stored - only the transcript."

**Technical Explanation:**
"The system uses a Chrome Extension (Manifest V3) with content scripts that monitor Google Voice's DOM for call events. When a call is detected, the extension captures the audio stream using Chrome's Tab Capture API, records it in memory using MediaRecorder, and uploads it to our Node.js backend. The backend uses self-hosted OpenAI Whisper (Python) to transcribe the audio to text, which is then stored in MySQL database linked to the lead record. The audio file is immediately discarded - only the transcript text is persisted."

## Files Modified/Created

### Backend
- `src/services/stt.service.ts` - Whisper transcription service
- `src/controllers/transcription.controller.ts` - Transcription endpoint
- `src/services/call.service.ts` - Call filtering by leadId
- `src/controllers/call.controller.ts` - Call API endpoints
- `src/models/associations.ts` - Call model associations

### Frontend
- `src/components/Modals/DialerModal.js` - Dialer UI component
- `src/components/Modals/LeadDetailPage.js` - Added Call History tab
- `src/services/callService.js` - API service for calls

### Chrome Extension
- `extension/manifest.json` - Extension configuration
- `extension/background.js` - Background worker
- `extension/content.js` - Google Voice monitoring
- `extension/offscreen.js` - Audio capture
- `extension/popup.html/js` - Settings UI
