# Troubleshooting: Call Not Detected/Recorded

## Quick Debugging Steps

### Step 1: Check Extension is Running

1. Open Google Voice page (`voice.google.com`)
2. Press `F12` to open DevTools
3. Go to **Console** tab
4. Look for messages starting with `[Voice CRM]`
5. You should see: `[Voice CRM] Content script loaded on: ...`

**If you don't see this:**
- Extension might not be loaded
- Go to `chrome://extensions/` → Check extension is enabled
- Reload the extension

### Step 2: Check Call Context is Received

1. In Console, look for: `[Voice CRM] Found pending call in localStorage:`
2. This means extension picked up the call info from frontend

**If you don't see this:**
- Check if localStorage has the call info:
  - In Console, type: `localStorage.getItem("VOICE_CRM_PENDING_CALL")`
  - Should return JSON with phoneNumber, leadId, etc.
- If null, frontend didn't store it properly

### Step 3: Check Call Detection

1. Make a call in Google Voice
2. Watch Console for: `[Voice CRM] Call detected:`
3. Should see detection details

**If call is not detected:**
- Google Voice UI might have changed
- Check what buttons are visible during call
- Update `isInCallUI()` function in `content.js`

### Step 4: Check Call Record Creation

1. After call starts, look for: `[Voice CRM] Call started detected! Creating call record...`
2. Then: `[Voice CRM] Call record created:`

**If you see errors:**
- Check backend URL is correct in extension settings
- Check JWT token is valid
- Check backend API is accessible

### Step 5: Check Audio Capture

1. Look for: `[Voice CRM] Starting audio capture for call:`
2. Check offscreen document console:
   - Go to `chrome://extensions/`
   - Extension details → Inspect views → `offscreen.html`
   - Check console for: `[Voice CRM Offscreen] Starting recording...`

**If audio not capturing:**
- Check Chrome permissions for tab capture
- Check offscreen document console for errors
- Verify MediaRecorder is supported

### Step 6: Check Call End Detection

1. End the call
2. Look for: `[Voice CRM] Call ended detected!`
3. Then: `[Voice CRM] Stopping audio capture and uploading...`
4. Finally: `[Voice CRM Offscreen] Uploading audio for transcription...`

## Common Issues & Fixes

### Issue 1: Extension Not Detecting Call

**Symptoms:**
- No `[Voice CRM] Call detected:` messages
- Call happens but no record created

**Fix:**
1. Open Google Voice page
2. Make a call
3. In Console, check what buttons/elements are visible
4. Update `isInCallUI()` function with correct selectors

**Quick Test:**
```javascript
// In Console on Google Voice page during call:
Array.from(document.querySelectorAll("button"))
  .map(b => b.getAttribute("aria-label") || b.textContent)
  .filter(Boolean)
```
This shows all button labels - find the "hang up" or "end call" button label.

### Issue 2: Call Context Not Received

**Symptoms:**
- No `[Voice CRM] Found pending call in localStorage:` message

**Fix:**
1. Check frontend is storing call info:
   - In CRM page Console: `localStorage.getItem("VOICE_CRM_PENDING_CALL")`
2. If null, check DialerModal is calling `localStorage.setItem`
3. Ensure Google Voice page is in same browser (localStorage is per origin)

### Issue 3: Audio Not Capturing

**Symptoms:**
- Call detected but no audio recorded
- Offscreen console shows errors

**Fix:**
1. Check Chrome permissions:
   - `chrome://extensions/` → Extension details → Permissions
   - Ensure "Tab capture" is granted
2. Check offscreen document:
   - Inspect views → offscreen.html
   - Look for errors in console
3. Try refreshing Google Voice page

### Issue 4: Backend API Errors

**Symptoms:**
- Console shows: `Failed to POST /calls/start` or similar

**Fix:**
1. Check extension settings:
   - Backend URL correct?
   - JWT token valid?
2. Test API manually:
   ```bash
   curl -X POST http://localhost:3000/api/calls/start \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"phoneNumber":"1234567890","direction":"outgoing","consent":true}'
   ```

## Manual Testing

### Test 1: Check Extension is Loaded
1. Go to `chrome://extensions/`
2. Find "Google Voice → CRM Call..."
3. Should be enabled (toggle ON)
4. Click "Service worker" to open background console
5. Should see no errors

### Test 2: Check Content Script
1. Open Google Voice page
2. Press F12 → Console
3. Type: `console.log("[Voice CRM] Test")`
4. Should see extension logs

### Test 3: Check localStorage
1. In CRM page, click "Call Opt-in"
2. Give consent, click "Make Call"
3. In Console: `localStorage.getItem("VOICE_CRM_PENDING_CALL")`
4. Should return JSON object

### Test 4: Check Call Detection
1. Make a call in Google Voice
2. Watch Console for detection messages
3. Check if `isInCallUI()` returns true
4. Manually test: In Console type `isInCallUI()` (if function is accessible)

## Debugging Commands

### In Google Voice Page Console:

```javascript
// Check if extension is loaded
console.log("[Voice CRM] Extension check");

// Check pending call
localStorage.getItem("VOICE_CRM_PENDING_CALL");

// Check all buttons during call
Array.from(document.querySelectorAll("button"))
  .map(b => ({
    label: b.getAttribute("aria-label"),
    text: b.textContent,
    classes: b.className
  }));

// Check if call is detected
// (You'll need to access the function from content script)
```

### In Background Worker Console:

```javascript
// Check config
chrome.storage.local.get(["backendBaseUrl", "jwt"], console.log);

// Test API call
fetch("http://localhost:3000/api/calls", {
  headers: { "Authorization": "Bearer YOUR_TOKEN" }
}).then(r => r.json()).then(console.log);
```

## Next Steps if Still Not Working

1. **Check all console logs** - Look for error messages
2. **Verify extension permissions** - All required permissions granted
3. **Test backend API** - Ensure API is working independently
4. **Check Google Voice UI** - UI might have changed, update selectors
5. **Verify Whisper installation** - Backend should have Whisper installed

## Reporting Issues

When reporting issues, include:
1. Console logs from Google Voice page
2. Console logs from background worker
3. Console logs from offscreen document
4. Screenshot of Google Voice during call
5. Extension settings (backend URL, JWT status)
