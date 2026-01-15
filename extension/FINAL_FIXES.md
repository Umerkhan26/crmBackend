# Final Fixes for Duration & Transcript Issues

## Issues Found

1. **Duration Incorrect**: Actual call 21 seconds, recorded as 0:54 (54 seconds)
2. **No Transcript**: All calls show "No transcript"
3. **Multiple Pending Calls**: Extension storing/clearing pending calls multiple times

## Root Causes

### Duration Issue
- Extension detects call start/end based on UI changes, not actual call state
- Call might be detected as started too early (when dialer opens)
- Call might be detected as ended too late (after UI changes)
- Not using actual call duration from Google Voice timer

### Transcript Issue
- Offscreen document communication might be failing
- Audio might not be captured properly
- Transcription upload might be failing silently
- Timing issues with offscreen document creation

### Multiple Pending Calls
- Bridge script storing same call multiple times
- No throttling to prevent duplicate storage

## Fixes Applied

### 1. Read Actual Call Duration from Google Voice UI
- **Added**: Extracts actual call duration from Google Voice's timer (MM:SS format)
- **Added**: Uses actual duration if available, otherwise calculates from timestamps
- **Added**: Backend now accepts `durationSeconds` in end call request

### 2. Improved Call End Detection
- **Added**: Better logging of start/end timestamps
- **Added**: Logs actual vs calculated duration for debugging
- **Added**: Waits for transcription before ending call

### 3. Fixed Offscreen Communication
- **Added**: Proper timeout handling for offscreen messages
- **Added**: Better error handling and logging
- **Added**: Waits for offscreen document to load before sending messages
- **Added**: 30-second timeout for transcription upload

### 4. Fixed Multiple Pending Calls
- **Added**: Throttling (only store once every 2 seconds)
- **Added**: Checks if call is same before storing
- **Added**: Reduced polling frequency to prevent duplicates

### 5. Better Transcription Flow
- **Added**: Validates audio blob size before uploading
- **Added**: Better error messages if audio too small
- **Added**: Logs transcription status at each step

## How to Test

### Step 1: Reload Extension
1. Go to `chrome://extensions/`
2. Find your extension
3. Click **Reload**

### Step 2: Make a Test Call
1. Go to CRM → Lead Detail
2. Click "Call Opt-in" → Give consent → "Make Call"
3. Make call in Google Voice (let it run for at least 10 seconds)
4. Watch the call duration timer in Google Voice
5. End the call

### Step 3: Check Console Logs

**In Google Voice Console:**
```
[Voice CRM] Found call duration in UI: 00:21 (21 seconds)
[Voice CRM] Using actual call duration from UI: 21 seconds
[Voice CRM] Duration details: { actualFromUI: 21, calculated: X, final: 21, ... }
[Voice CRM] Transcription started: ...
[Voice CRM Offscreen] Recording stopped. Blob size: X bytes
[Voice CRM Offscreen] Uploading audio for transcription...
[Voice CRM Offscreen] ✅ Transcription completed and saved
```

**In Offscreen Console:**
- Go to `chrome://extensions/` → Extension details → Inspect views → `offscreen.html`
- Look for:
  ```
  [Voice CRM Offscreen] MediaRecorder started
  [Voice CRM Offscreen] Audio chunk received: X bytes
  [Voice CRM Offscreen] Recording stopped. Blob size: X bytes
  [Voice CRM Offscreen] Uploading audio for transcription...
  [Voice CRM Offscreen] ✅ Transcription completed and saved
  ```

### Step 4: Verify in CRM
1. Wait 30 seconds (for transcription to complete)
2. Go to Call History tab
3. Refresh
4. Should see:
   - ✅ Correct duration (matches actual call time)
   - ✅ Transcript available

## Troubleshooting

### Duration Still Wrong

**Check:**
1. In Google Voice console, look for: `Found call duration in UI:`
2. If you see this, duration should be correct
3. If you DON'T see this, the extension couldn't read the timer from UI
4. Check the logged duration details to see actual vs calculated

**If duration still wrong:**
- The call might be detected as started/ended at wrong times
- Check the start/end timestamps in console logs
- Calculate manually: `(endTime - startTime) / 1000`

### Transcript Still Missing

**Step 1: Check Consent**
```javascript
chrome.storage.local.get(["consent"], console.log);
// Should return: { consent: true }
```

**Step 2: Check Audio Capture**
- Open offscreen console (see Step 3 above)
- Look for: `[Voice CRM Offscreen] MediaRecorder started`
- Look for: `[Voice CRM Offscreen] Audio chunk received`
- If blob size < 1000 bytes, audio wasn't captured

**Step 3: Check Transcription Upload**
- Look for: `[Voice CRM Offscreen] Uploading audio for transcription...`
- Look for: `[Voice CRM Offscreen] ✅ Transcription completed and saved`
- If you see errors, check backend logs

**Step 4: Check Backend**
- Check backend console for Whisper errors
- Verify Whisper is installed: `whisper --help`
- Check database:
  ```sql
  SELECT transcript, sttProvider FROM calls WHERE id = [call_id];
  ```

### Multiple Pending Calls

**Fixed with throttling:**
- Bridge script now only stores once every 2 seconds
- Checks if call is same before storing
- Should see fewer "Stored pending call" messages

## Expected Behavior

### Duration
- Extension reads actual duration from Google Voice timer (if available)
- Falls back to calculated duration from timestamps
- Logs both for debugging
- Backend uses provided duration if available

### Transcript
1. Call starts → Extension detects → Starts audio capture
2. During call → Audio chunks collected every 1 second
3. Call ends → Stops recording → Creates blob
4. Uploads to backend → Backend transcribes → Stores transcript
5. Call record updated with transcript

## Key Changes

✅ **Reads actual duration from Google Voice UI**
✅ **Throttles pending call storage (prevents duplicates)**
✅ **Better offscreen communication (timeouts, error handling)**
✅ **Validates audio blob size before uploading**
✅ **Better logging at every step**

## Next Steps

1. **Reload extension** (required)
2. **Make a fresh call** (at least 10 seconds)
3. **Check console logs** (Google Voice + Offscreen)
4. **Wait 30 seconds** (for transcription)
5. **Verify in CRM** (duration + transcript)
