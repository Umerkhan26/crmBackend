# Immediate Fix for Call Detection Issue

## Problem
Call is active in Google Voice but not detected by extension.

## Quick Fix Steps

### Step 1: Reload Extension
1. Go to `chrome://extensions/`
2. Find "Google Voice → CRM Call..." extension
3. Click **Reload** button
4. Refresh Google Voice page

### Step 2: Try Manual Detection
1. **While call is active** in Google Voice
2. Press `F12` → **Console** tab
3. Type: `window.voiceCrmManualDetect()`
4. Press Enter
5. Check the response - it will tell you what happened

### Step 3: Check Console Logs
Look for these messages in Google Voice console:
- `[Voice CRM] Content script loaded`
- `[Voice CRM] Call detection check:`
- `[Voice CRM] Call started detected!`

### Step 4: If Manual Detection Works
If `window.voiceCrmManualDetect()` returns `{ success: true }`:
1. Go back to CRM modal
2. Click **"Refresh Status"** button
3. Call should now appear!

## What Was Fixed

### 1. Better Call Detection
- Now detects: Transfer, Hold, Mute, Record, Keypad buttons
- Detects call duration timer (00:14 format)
- More aggressive detection logic

### 2. Faster Detection
- Checks every 1 second (was 2 seconds)
- Immediate check when page loads
- Periodic fallback check

### 3. Manual Trigger
- `window.voiceCrmManualDetect()` function
- Loads context from localStorage automatically
- Better error messages

### 4. Better Refresh
- Checks all recent calls as fallback
- Better error messages
- More detailed logging

## Still Not Working?

### Check Extension is Running
In Google Voice console, you should see:
```
[Voice CRM] Content script loaded on: https://voice.google.com/...
```

If you DON'T see this:
- Extension not loaded → Reload extension
- Extension disabled → Enable it

### Check Call Context
In Google Voice console, type:
```javascript
localStorage.getItem("VOICE_CRM_PENDING_CALL")
```

Should return JSON with phoneNumber, leadId, etc.

If `null`:
- Go back to CRM
- Click "Call Opt-in" again
- Give consent → Click "Make Call"

### Check Detection
During active call, in console type:
```javascript
isInCallUI()
```

Should return `true` if in call.

If returns `false` but you ARE in call:
- Detection selectors need update
- Use manual trigger: `window.voiceCrmManualDetect()`

## Expected Flow

1. **CRM**: Click "Call Opt-in" → Give consent → "Make Call"
2. **Google Voice**: Opens with number pre-filled
3. **User**: Makes the call
4. **Extension**: Detects call (within 1-2 seconds)
5. **Backend**: Creates call record
6. **CRM**: Polling detects call → Shows "Call in Progress"

## Debugging Commands

### In Google Voice Console:
```javascript
// Check if extension loaded
console.log("[Voice CRM] Test")

// Check call context
localStorage.getItem("VOICE_CRM_PENDING_CALL")

// Check detection
isInCallUI()

// Manual trigger
window.voiceCrmManualDetect()

// See all buttons
Array.from(document.querySelectorAll("button"))
  .map(b => ({
    label: b.getAttribute("aria-label"),
    text: b.textContent
  }))
```

### In CRM Console:
```javascript
// Check polling
console.log("[DialerModal] Test")

// Check localStorage
localStorage.getItem("VOICE_CRM_PENDING_CALL")
```

## Next Steps

1. **Reload extension** (Step 1)
2. **Make a test call**
3. **Run manual detection** (Step 2)
4. **Check console logs** (Step 3)
5. **Report results** if still not working
