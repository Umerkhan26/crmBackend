# Duration & Transcript Issues - Fix Guide

## Issues Found

1. **Duration Incorrect**: Actual call was 9 seconds but recorded as 0:03 (3 seconds)
2. **No Transcript**: All calls show "No transcript" even though consent was given

## Root Causes

### Duration Issue
- Call might be ending too early (detected before actual call ends)
- Timestamp calculation might be off
- Call end detection might trigger on UI change, not actual call end

### Transcript Issue
- Transcription might not be triggered properly
- Audio might not be captured (blob too small)
- Transcription upload might fail silently
- Call might end before transcription completes

## Fixes Applied

### 1. Better Call End Detection
- Now waits for transcription to complete before ending call
- Logs actual duration for debugging
- Uses accurate timestamps

### 2. Improved Transcription Flow
- Checks consent properly before starting transcription
- Waits for transcription upload to complete
- Validates audio blob size before uploading
- Better error handling and logging

### 3. Better Logging
- Logs call start/end timestamps
- Logs calculated duration
- Logs transcription status
- Warns if audio blob is too small

## How to Verify

### Check Duration
1. Make a test call (let it run for at least 10 seconds)
2. Check Google Voice console for:
   ```
   [Voice CRM] Call start timestamp: ...
   [Voice CRM] Call record updated as completed. Duration: X seconds
   ```
3. Verify duration matches actual call time

### Check Transcription
1. Make sure consent checkbox is checked in extension popup
2. Make a call
3. Check Google Voice console for:
   ```
   [Voice CRM] Transcription started: ...
   [Voice CRM Offscreen] Recording stopped. Blob size: X bytes
   [Voice CRM Offscreen] Uploading audio for transcription...
   [Voice CRM Offscreen] ✅ Transcription completed and saved
   ```
4. Check backend logs for Whisper transcription
5. Wait 10-30 seconds for transcription to complete
6. Refresh CRM Call History tab

## Troubleshooting

### Duration Still Wrong

**Check:**
1. In Google Voice console, look for start/end timestamps
2. Calculate manually: `(endTime - startTime) / 1000`
3. If duration is still wrong, call might be detected as ended too early

**Possible causes:**
- Google Voice UI changes before call actually ends
- Detection logic needs adjustment
- Call is being ended manually before natural end

**Fix:**
- Check `isInCallUI()` function - might need to be more lenient
- Add delay before ending call (already added 500ms wait)

### Transcript Still Missing

**Check Step 1: Consent**
- Extension popup → Consent checkbox must be checked
- Check Chrome storage: `chrome.storage.local.get(["consent"], console.log)`

**Check Step 2: Audio Capture**
- Open offscreen document console:
  - `chrome://extensions/` → Extension details → Inspect views → `offscreen.html`
- Look for:
  ```
  [Voice CRM Offscreen] MediaRecorder started
  [Voice CRM Offscreen] Audio chunk received: X bytes
  [Voice CRM Offscreen] Recording stopped. Blob size: X bytes
  ```
- If blob size is < 1000 bytes, audio wasn't captured properly

**Check Step 3: Transcription Upload**
- Look for:
  ```
  [Voice CRM Offscreen] Uploading audio for transcription...
  [Voice CRM Offscreen] Transcription successful
  ```
- If you see errors, check backend logs

**Check Step 4: Backend Processing**
- Check backend console for Whisper errors
- Verify Whisper is installed: `whisper --help`
- Check database: `SELECT transcript, sttProvider FROM calls WHERE id = X;`

## Expected Flow

1. **Call Starts**
   - Extension detects call
   - Creates call record with `startedAt` timestamp
   - Starts audio capture (if consent given)

2. **During Call**
   - Audio chunks collected every 1 second
   - Stored in memory (not on disk)

3. **Call Ends**
   - Extension detects call end
   - Stops audio recording
   - Creates audio blob
   - Uploads to backend for transcription
   - Waits for upload to complete
   - Ends call record with `endedAt` timestamp
   - Backend calculates duration: `(endedAt - startedAt) / 1000`

4. **Transcription**
   - Backend receives audio
   - Uses Whisper to transcribe
   - Stores transcript in database
   - Updates call record

## Manual Testing

### Test Duration
```javascript
// In Google Voice console after call ends
// Check the logged timestamps
// Calculate: (endTime - startTime) / 1000
```

### Test Transcription
```javascript
// Check if audio was captured
chrome.runtime.sendMessage({ type: "VOICE_CRM_STOP_TRANSCRIPTION" }, (r) => {
  console.log("Transcription result:", r);
});
```

### Check Database
```sql
-- Check call details
SELECT 
  id,
  phoneNumber,
  startedAt,
  endedAt,
  durationSeconds,
  transcript,
  sttProvider
FROM calls 
WHERE id = [call_id];

-- Calculate duration manually
SELECT 
  TIMESTAMPDIFF(SECOND, startedAt, endedAt) as calculated_duration,
  durationSeconds as stored_duration
FROM calls 
WHERE id = [call_id];
```

## Next Steps

1. **Reload extension** (to get fixes)
2. **Make a fresh call** (at least 10 seconds long)
3. **Check console logs** (both Google Voice and offscreen)
4. **Wait 30 seconds** (for transcription to complete)
5. **Refresh CRM** (to see updated call history)
