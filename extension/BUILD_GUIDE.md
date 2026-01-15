# Chrome Extension Build & Setup Guide

## Prerequisites

1. **Chrome Browser** (latest version)
2. **Backend API** running and accessible
3. **Whisper installed** on backend server (see backend docs)
4. **Google Voice account** credentials (`taylor@ttmg.live`)

## Step-by-Step Installation

### 1. Load Extension in Chrome

1. Open Chrome browser
2. Navigate to `chrome://extensions/`
3. Toggle **Developer mode** ON (top-right corner)
4. Click **Load unpacked** button
5. Navigate to: `D:\crmBackend\extension\`
6. Click **Select Folder**
7. Extension should appear in your extensions list ✅

### 2. Get JWT Token from CRM

**Method 1: From Browser DevTools**
1. Open your CRM frontend (e.g., `http://localhost:3001`)
2. Login to your account
3. Press `F12` to open DevTools
4. Go to **Application** tab (or **Storage** in Firefox)
5. Expand **Local Storage** → Click your domain
6. Find key `token` and copy its value
7. This is your JWT token

**Method 2: From Network Tab**
1. Open DevTools → **Network** tab
2. Make any API request in CRM
3. Click on the request
4. Go to **Headers** tab
5. Find `Authorization: Bearer <token>`
6. Copy the token value

### 3. Configure Extension

1. Click the **extension icon** in Chrome toolbar (puzzle piece icon)
2. If you don't see it, click the puzzle icon → pin the extension
3. In the popup, enter:
   - **Backend Base URL**: `http://localhost:3000` (or your backend URL)
   - **JWT**: Paste the token you copied
   - **Consent**: ✅ Check this box (required for transcription)
4. Config is **automatically saved**

### 4. Setup Google Voice

1. Open new Chrome tab
2. Go to `https://voice.google.com`
3. Login with: `taylor@ttmg.live`
4. Enter password (from credentials email)
5. Complete 2FA if prompted
6. Keep this tab open or bookmark it

### 5. Test the Extension

#### Test Method 1: From CRM Frontend (Recommended)

1. Go to CRM → Lead Detail page
2. Find a lead with phone number
3. Click **"Call Opt-in"** button next to phone number
4. In the dialer modal:
   - Check consent checkbox
   - Click **"Start Call"**
5. Google Voice tab should open automatically
6. Make the call in Google Voice
7. Extension will automatically:
   - Detect call start
   - Capture audio
   - Detect call end
   - Transcribe and save to CRM

#### Test Method 2: From Extension Popup

1. Click extension icon
2. Enter:
   - Phone number: `+13155551234` (example)
   - Lead ID: `123` (optional, from CRM)
3. Click **"Open Voice & Dial"**
4. Google Voice opens → Extension dials number
5. Make the call → Extension tracks it

### 6. Verify It Works

1. Go back to CRM Lead Detail page
2. Click **"Call History"** tab
3. You should see:
   - Call record with phone number
   - Duration
   - Status
   - **Transcript** (after transcription completes)

## Integration with Frontend Dialer

The extension automatically works with the CRM frontend dialer:

1. **Frontend** opens Google Voice with phone number
2. **Extension** detects the Google Voice tab
3. **Content script** monitors for call start/end
4. **Background worker** coordinates audio capture
5. **Offscreen document** records audio
6. **Backend** transcribes and stores transcript

**No additional setup needed!** Just ensure:
- Extension is loaded and configured
- JWT token is valid
- Google Voice is logged in

## Troubleshooting

### Extension Not Appearing

- Check `chrome://extensions/` → Ensure it's enabled
- Check for errors (red error badge)
- Try reloading the extension

### JWT Token Issues

- Token might be expired → Get new token from CRM
- Token format wrong → Should start with `eyJ...`
- Backend URL wrong → Check it matches your backend

### Calls Not Detected

**Check 1: Content Script**
- Open Google Voice page
- Press `F12` → Console tab
- Look for errors from content script
- Check if `VOICE_CRM_DIAL` message is received

**Check 2: DOM Selectors**
- Google Voice UI may have changed
- Open `content.js` and update selectors if needed
- Check `findDialInput()`, `findCallButton()`, `isInCallUI()`

**Check 3: Permissions**
- Go to `chrome://extensions/`
- Click extension → Details
- Ensure all permissions are granted

### Audio Not Capturing

**Check 1: Offscreen Document**
- Go to `chrome://extensions/`
- Extension details → Inspect views → `offscreen.html`
- Check console for errors

**Check 2: Tab Capture**
- Ensure you're on Google Voice tab when call starts
- Check Chrome permissions for tab capture
- Try refreshing the Google Voice tab

**Check 3: MediaRecorder**
- Check browser console for MediaRecorder errors
- Ensure browser supports MediaRecorder API
- Try different browser if issues persist

### Transcription Failing

**Check 1: Backend**
- Verify Whisper is installed: `whisper --help`
- Check backend logs for errors
- Test transcription endpoint manually

**Check 2: API Endpoint**
- Verify `POST /api/calls/:id/transcribe` works
- Check CORS settings
- Verify JWT token is valid

**Check 3: Consent**
- Ensure consent checkbox is checked in extension
- Check `callContext.consent` in content script

## Development Mode

### Reload Extension After Changes

1. Go to `chrome://extensions/`
2. Find your extension
3. Click **Reload** button (circular arrow)
4. Test again

### Debug Content Script

1. Open Google Voice page
2. Press `F12` → Console
3. Content script logs will appear here
4. Look for `VOICE_CRM_*` messages

### Debug Background Worker

1. Go to `chrome://extensions/`
2. Extension details → **Service worker** (or **background page**)
3. Opens DevTools for background worker
4. Check console for API calls and errors

### Debug Offscreen Document

1. Go to `chrome://extensions/`
2. Extension details → **Inspect views** → `offscreen.html`
3. Opens DevTools for offscreen document
4. Check console for audio capture logs

## Production Deployment

For production use:

1. **Update Backend URL** in extension config to production API
2. **Package Extension** (optional):
   - Go to `chrome://extensions/`
   - Click **Pack extension**
   - Creates `.crx` file for distribution
3. **Distribute** to team members
4. **Update JWT** when tokens expire

## Security Checklist

- ✅ JWT tokens stored locally (not synced)
- ✅ Audio never stored on disk
- ✅ Consent required before transcription
- ✅ HTTPS for production backend
- ✅ CORS properly configured
- ✅ Two-party consent laws considered

## Next Steps

Once extension is working:

1. Test with multiple calls
2. Verify transcripts appear in CRM
3. Check call history tab shows all calls
4. Test with different leads
5. Monitor backend logs for any issues

## Support

If you encounter issues:

1. Check all troubleshooting sections above
2. Review browser console errors
3. Check backend logs
4. Verify Whisper installation
5. Test API endpoints manually
