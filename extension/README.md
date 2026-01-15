# Google Voice → CRM Chrome Extension

Chrome Extension that integrates Google Voice with your CRM to automatically track calls and transcribe them.

## Features

✅ **Automatic Call Detection** - Detects when calls start/end on Google Voice  
✅ **Audio Capture** - Captures call audio in memory (not stored)  
✅ **Transcription** - Sends audio to backend for transcription using self-hosted Whisper  
✅ **CRM Integration** - Links calls to leads and stores transcripts  
✅ **No Audio Storage** - Only transcript text is stored, audio is discarded immediately  

## Architecture

- **Content Script** (`content.js`) - Monitors Google Voice page for call lifecycle
- **Background Worker** (`background.js`) - Handles API calls and coordinates audio capture
- **Offscreen Document** (`offscreen.js`) - Captures tab audio using MediaRecorder API
- **Popup** (`popup.html/js`) - Configuration UI for backend URL and JWT

## Installation

### Step 1: Load Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right)
3. Click **Load unpacked**
4. Select the `extension/` folder from this project
5. The extension should appear in your extensions list

### Step 2: Configure Extension

1. Click the extension icon in Chrome toolbar
2. Enter your **Backend URL** (e.g., `http://localhost:3000` or `https://your-api.com`)
3. Enter your **JWT Token** (get this from your CRM after logging in)
4. Check **Consent** checkbox if you want transcription enabled
5. Config is saved automatically

### Step 3: Login to Google Voice

1. Open a new tab and go to `https://voice.google.com`
2. Login with the Google Voice account (`taylor@ttmg.live`)
3. Keep this tab open (or use the same Chrome profile)

### Step 4: Test Integration

**Option A: Use Frontend Dialer (Recommended)**
1. Go to your CRM Lead Detail page
2. Click "Call Opt-in" button next to phone number
3. Give consent and click "Start Call"
4. Extension will automatically detect the call and transcribe it

**Option B: Use Extension Popup**
1. Click extension icon
2. Enter phone number
3. Enter Lead ID (optional)
4. Click "Open Voice & Dial"
5. Extension will open Google Voice and dial the number

## How It Works

1. **Call Start Detection**
   - Content script watches Google Voice DOM for call indicators
   - When call starts, sends `POST /api/calls/start` to backend
   - Backend creates call record with `leadId`

2. **Audio Capture**
   - Background worker creates offscreen document
   - Captures tab audio stream using `chrome.tabCapture` API
   - Records audio in memory (MediaRecorder)

3. **Call End Detection**
   - Content script detects call end (hang up button disappears)
   - Sends `PATCH /api/calls/:id/end` to backend
   - Stops audio recording

4. **Transcription**
   - Offscreen document uploads audio blob to `POST /api/calls/:id/transcribe`
   - Backend uses self-hosted Whisper to transcribe
   - Transcript text is stored in database (audio is discarded)
   - Call record is updated with transcript

## Configuration

### Environment Variables (Backend)

```env
# Self-Hosted Whisper (Default)
WHISPER_MODEL=base
WHISPER_COMMAND=whisper

# Optional: Use OpenAI API instead
USE_OPENAI_WHISPER=false
# OPENAI_API_KEY=sk-xxxxxxxxxxxxx
```

### Extension Storage

The extension stores configuration in `chrome.storage.local`:
- `backendBaseUrl` - Your backend API URL
- `jwt` - Authentication token from CRM
- `consent` - User consent preference

## Troubleshooting

### Extension not detecting calls

1. **Check Google Voice UI** - Google Voice UI changes frequently. If selectors don't match:
   - Open browser console on Google Voice page
   - Check for errors from content script
   - Update selectors in `content.js` if needed

2. **Verify permissions** - Ensure extension has:
   - `tabs` permission
   - `tabCapture` permission
   - `host_permissions` for `voice.google.com`

### Audio not capturing

1. **Check offscreen document** - Open `chrome://extensions/` → Extension details → Inspect views → offscreen.html
2. **Verify tab capture** - Ensure you're on the Google Voice tab when call starts
3. **Check console errors** - Look for MediaRecorder or getUserMedia errors

### Transcription failing

1. **Check backend logs** - Verify Whisper is installed: `whisper --help`
2. **Check API endpoint** - Verify `POST /api/calls/:id/transcribe` is working
3. **Check JWT token** - Ensure token is valid and not expired
4. **Check consent** - Ensure consent checkbox is checked

### JWT Token Expired

1. Login to your CRM
2. Get new JWT token (check localStorage or network requests)
3. Update token in extension popup

## Development

### File Structure

```
extension/
├── manifest.json      # Extension manifest (MV3)
├── background.js      # Service worker (API calls, coordination)
├── content.js         # Content script (Google Voice page monitoring)
├── offscreen.html     # Offscreen document HTML
├── offscreen.js       # Audio capture logic
├── popup.html         # Extension popup UI
├── popup.js           # Popup logic
├── README.md          # This file
└── INSTALLATION.md    # Detailed installation guide
```

### Updating Selectors

If Google Voice UI changes, update selectors in `content.js`:
- `findDialInput()` - Finds phone number input field
- `findCallButton()` - Finds call button
- `isInCallUI()` - Detects if call is active

## Security Notes

- ✅ Audio is captured in memory only, never stored on disk
- ✅ Audio is sent directly to backend and discarded immediately
- ✅ Only transcript text is stored in database
- ✅ JWT token is stored in extension's local storage (not synced)
- ⚠️ Consent is required before transcription
- ⚠️ Two-party consent laws may apply in your jurisdiction

## Support

For issues or questions:
1. Check browser console for errors
2. Check extension background page console
3. Verify backend API is accessible
4. Ensure Whisper is installed on backend server
