# Quick Debugging Guide - Call Not Detected

## Immediate Steps to Debug

### Step 1: Check Extension is Running
1. Open Google Voice page: `https://voice.google.com`
2. Press `F12` → **Console** tab
3. Look for: `[Voice CRM] Content script loaded on: ...`
4. If you DON'T see this → Extension is not loaded

### Step 2: Check Call Context
1. In Console, type: `localStorage.getItem("VOICE_CRM_PENDING_CALL")`
2. Should return JSON with phoneNumber, leadId, etc.
3. If `null` → Frontend didn't store it properly

### Step 3: Check Call Detection
1. Make a call in Google Voice
2. In Console, type: `window.voiceCrmManualDetect()`
3. This will manually try to detect and create call record
4. Check the response - it will tell you what's wrong

### Step 4: Check What Buttons Are Visible
During an active call, in Console type:
```javascript
Array.from(document.querySelectorAll("button"))
  .map(b => ({
    label: b.getAttribute("aria-label"),
    text: b.textContent,
    classes: b.className
  }))
  .filter(b => b.label || b.text)
```
This shows all buttons - look for "hang up", "end call", "mute" buttons.

### Step 5: Check Detection Function
In Console, type: `isInCallUI()`
- Should return `true` if in call
- Should return `false` if not in call
- If it returns wrong value, detection logic needs update

## Common Issues

### Issue: "No call context available"
**Fix:**
1. Go back to CRM page
2. Click "Call Opt-in" again
3. Give consent → Click "Make Call"
4. Check localStorage again: `localStorage.getItem("VOICE_CRM_PENDING_CALL")`

### Issue: "Not in call state" (but you are in a call)
**Fix:**
1. Detection selectors might be wrong
2. Check what buttons are visible (Step 4 above)
3. Update `isInCallUI()` function with correct selectors
4. Or use manual trigger: `window.voiceCrmManualDetect()`

### Issue: Extension not loaded
**Fix:**
1. Go to `chrome://extensions/`
2. Find your extension
3. Make sure it's **enabled**
4. Click **Reload** button
5. Refresh Google Voice page

### Issue: Backend API errors
**Fix:**
1. Check extension settings (click extension icon)
2. Verify Backend URL is correct
3. Verify JWT token is valid (not expired)
4. Test API manually:
   ```bash
   curl -X POST http://localhost:3000/api/calls/start \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"phoneNumber":"1234567890","direction":"outgoing","consent":true}'
   ```

## Manual Workaround

If automatic detection fails:

1. **Make the call in Google Voice**
2. **In Console, run:** `window.voiceCrmManualDetect()`
3. This will manually create the call record
4. Go back to CRM and click **"Refresh Status"** button

## What to Report

If still not working, provide:
1. Console logs from Google Voice page
2. Result of `window.voiceCrmManualDetect()`
3. Result of `localStorage.getItem("VOICE_CRM_PENDING_CALL")`
4. Screenshot of Google Voice during call
5. Extension settings (backend URL, JWT status)
