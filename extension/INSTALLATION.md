# Chrome Extension Installation Guide

## Quick Start

### 1. Install Extension

1. Open Chrome
2. Go to `chrome://extensions/`
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked**
5. Navigate to and select the `extension/` folder
6. Extension should appear in your extensions list

### 2. Get JWT Token from CRM

1. Open your CRM frontend (e.g., `http://localhost:3001`)
2. Login to your account
3. Open browser DevTools (F12)
4. Go to **Application** tab → **Local Storage**
5. Find the `token` key and copy its value
6. This is your JWT token

### 3. Configure Extension

1. Click the extension icon in Chrome toolbar
2. Enter:
   - **Backend URL**: `http://localhost:3000` (or your backend URL)
   - **JWT Token**: Paste the token you copied
   - **Consent**: Check the box (required for transcription)
3. Config is saved automatically

### 4. Login to Google Voice

1. Open new tab → `https://voice.google.com`
2. Login with: `taylor@ttmg.live`
3. Keep this tab open

### 5. Test It!

**Method 1: From CRM Frontend (Recommended)**
1. Go to Lead Detail page in CRM
2. Click "Call Opt-in" button next to phone number
3. Give consent → Click "Start Call"
4. Google Voice opens → Make the call
5. Extension automatically detects and transcribes!

**Method 2: From Extension Popup**
1. Click extension icon
2. Enter phone number
3. Enter Lead ID (optional)
4. Click "Open Voice & Dial"

## Verification

After making a call:
1. Go back to CRM Lead Detail page
2. Click "Call History" tab
3. You should see the call with transcript!

## Troubleshooting

**Extension not working?**
- Check `chrome://extensions/` → Extension details → Errors
- Open background page console to see logs
- Verify JWT token is not expired

**Calls not detected?**
- Ensure you're on Google Voice tab when making call
- Check browser console on Google Voice page
- Google Voice UI may have changed - selectors might need update

**Transcription not working?**
- Verify Whisper is installed on backend: `whisper --help`
- Check backend logs for errors
- Ensure consent checkbox is checked in extension

## Next Steps

Once installed and tested:
- Extension will automatically work with CRM frontend dialer
- All calls made through "Call Opt-in" will be tracked
- Transcripts will appear in "Call History" tab
