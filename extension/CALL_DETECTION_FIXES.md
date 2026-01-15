# Call Detection & Recording Fixes

## Issues Found

1. **Phone Number Mismatch**: Call was found but had different phone number (`732-474-7378` vs `+13153332077`)
2. **Duration Showing N/A**: Frontend was looking for `duration` but backend returns `durationSeconds`
3. **No Transcript**: Transcript might not have been processed or uploaded
4. **Call Not Linked to Lead**: Call was found but `leadId` didn't match

## Fixes Applied

### 1. Extension - Phone Number Validation
- **Fixed**: Extension now always uses `phoneNumber` from call context (localStorage), not from Google Voice UI
- **Added**: Validation to ensure `phoneNumber` exists before creating call record
- **Added**: Better logging to show what phone number and leadId are being used

### 2. Frontend - Duration Display
- **Fixed**: Changed from `latestCall.duration` to `latestCall.durationSeconds`
- **Added**: Proper formatting: `MM:SS` format
- **Added**: Shows transcript status in toast message

### 3. Frontend - Better Error Messages
- **Added**: Phone number mismatch detection and warning
- **Added**: LeadId mismatch detection and warning
- **Added**: Transcript status indicator

### 4. Extension - Context Validation
- **Added**: Validates `phoneNumber` exists before creating call
- **Added**: Ensures `leadId` is properly parsed as integer
- **Added**: Stores original phone number in metadata for debugging

## How to Test

### Step 1: Clear Old Data
1. Go to CRM → Lead Detail page
2. Check "Call History" tab - note any existing calls
3. These might be from previous tests

### Step 2: Make a New Call
1. Click "Call Opt-in" button next to phone number
2. Give consent → Click "Make Call"
3. Google Voice opens
4. Make the call

### Step 3: Check Extension Logs
In Google Voice console (F12), you should see:
```
[Voice CRM] Using context: { phoneNumber: "+13153332077", leadId: 45151, consent: true }
[Voice CRM] Sending call data to backend: { phoneNumber: "+13153332077", leadId: 45151, ... }
```

### Step 4: Verify Call Record
1. Go back to CRM modal
2. Click "Refresh Status"
3. Should find call with:
   - ✅ Correct phone number
   - ✅ Correct leadId
   - ✅ Duration (not N/A)
   - ✅ Transcript (if processing completed)

## Troubleshooting

### Issue: Phone Number Still Wrong
**Check:**
1. In Google Voice console: `localStorage.getItem("VOICE_CRM_PENDING_CALL")`
2. Verify `phoneNumber` field matches the lead's number
3. If wrong, go back to CRM and click "Call Opt-in" again

### Issue: Duration Still N/A
**Check:**
1. Call must have `endedAt` timestamp
2. Backend calculates: `durationSeconds = (endedAt - startedAt) / 1000`
3. If `startedAt` or `endedAt` is missing, duration will be null

### Issue: No Transcript
**Possible Reasons:**
1. **Transcription not started**: Check if consent was given
2. **Audio not captured**: Check offscreen document console
3. **Transcription failed**: Check backend logs for Whisper errors
4. **Still processing**: Wait a few seconds and refresh

**Check Transcript Status:**
- In backend, check `calls` table: `SELECT id, transcript, sttProvider FROM calls WHERE id = 2;`
- If `transcript` is NULL, transcription didn't complete
- If `sttProvider` is NULL, transcription wasn't attempted

### Issue: Call Not Linked to Lead
**Check:**
1. Extension logs should show: `leadId: 45151`
2. Backend should store: `leadId = 45151` in call record
3. If `leadId` is NULL, extension didn't receive it from context

**Fix:**
- Go back to CRM
- Click "Call Opt-in" again (ensures localStorage is updated)
- Make call again

## Expected Database Record

After a successful call, the `calls` table should have:
```sql
SELECT 
  id,
  phoneNumber,        -- Should match lead's number
  leadId,             -- Should match lead ID (45151)
  status,             -- Should be "completed"
  durationSeconds,    -- Should be > 0
  transcript,         -- Should have text (or NULL if failed)
  sttProvider,        -- Should be "self_hosted_whisper" or "openai_whisper_api"
  startedAt,
  endedAt
FROM calls 
WHERE id = [call_id];
```

## Next Steps

1. **Test with a new call** - Don't use old calls, start fresh
2. **Check console logs** - Both Google Voice and CRM
3. **Verify database** - Check call record has correct data
4. **Check transcript** - Wait for transcription to complete (can take 10-30 seconds)

## Manual Verification

### Check Call in Database
```sql
-- Find most recent call
SELECT * FROM calls ORDER BY id DESC LIMIT 1;

-- Check if linked to lead
SELECT c.*, l.id as lead_id, l.phone as lead_phone 
FROM calls c
LEFT JOIN leads l ON c.leadId = l.id
WHERE c.id = [call_id];
```

### Check Extension Context
In Google Voice console:
```javascript
// Check pending call
localStorage.getItem("VOICE_CRM_PENDING_CALL")

// Check if call is active
isInCallUI()

// Manual trigger (if needed)
window.voiceCrmManualDetect()
```

### Check Backend Logs
Look for:
- `POST /api/calls/start` - Call creation
- `PATCH /api/calls/:id/end` - Call end
- `POST /api/calls/:id/transcribe` - Transcription request
- Whisper errors (if any)
