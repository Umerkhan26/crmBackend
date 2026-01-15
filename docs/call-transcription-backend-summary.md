# Call Transcription Backend Implementation Summary

## Overview
Backend implementation for Google Voice CRM Chrome Extension with self-hosted Whisper transcription (no audio recording, only transcripts stored).

## What Was Implemented

### 1. Self-Hosted Whisper Integration
- **File**: `src/services/stt.service.ts`
- Added `transcribeWithSelfHostedWhisper()` function
- Uses Python Whisper library via command-line execution
- Automatically cleans up temporary files
- Falls back to OpenAI API if `USE_OPENAI_WHISPER=true` is set

### 2. Updated Transcription Controller
- **File**: `src/controllers/transcription.controller.ts`
- Now uses `transcribeAudio()` which automatically selects self-hosted or OpenAI based on env config
- Stores transcript with proper STT provider metadata

### 3. Database Model
- **File**: `src/models/call.model.ts` (already existed)
- Call model with fields:
  - `transcript` (TEXT) - stores transcription text only
  - `sttProvider` - tracks which service was used
  - `durationSeconds` - call duration
  - `consent` - recording consent flag
  - Links to `userId`, `leadId`, `clientLeadId`

### 4. Model Associations
- **File**: `src/models/associations.ts`
- Added associations:
  - User ↔ Call (one-to-many)
  - Lead ↔ Call (one-to-many)
  - ClientLead ↔ Call (one-to-many)

### 5. API Endpoints (Already Existed)
- **File**: `src/routes/call.routes.ts`
- `POST /api/calls/start` - Start a call
- `PATCH /api/calls/:id/end` - End a call
- `POST /api/calls/:id/transcribe` - Upload audio and transcribe
- `PATCH /api/calls/:id/transcript` - Update transcript manually
- `GET /api/calls/:id` - Get call details
- `GET /api/calls` - List calls with pagination

### 6. Services
- **File**: `src/services/call.service.ts` (already existed)
- Complete CRUD operations for calls
- Handles call lifecycle (start, end, update transcript)

## Environment Configuration

Add to `.env`:
```env
# Self-Hosted Whisper (Default)
WHISPER_MODEL=base
WHISPER_COMMAND=whisper

# Optional: Use OpenAI API instead
USE_OPENAI_WHISPER=false
# OPENAI_API_KEY=sk-xxxxxxxxxxxxx
```

## Installation Requirements

1. **Install Python Whisper:**
   ```bash
   pip install openai-whisper
   ```

2. **Verify installation:**
   ```bash
   whisper --help
   ```

See `docs/whisper-installation.md` for detailed setup instructions.

## How It Works

1. **Chrome Extension** captures audio stream from Google Voice call
2. **Extension** sends audio to backend via `POST /api/calls/:id/transcribe`
3. **Backend** receives audio file (multipart/form-data)
4. **Backend** writes audio to temporary file
5. **Backend** executes Whisper command-line tool
6. **Whisper** transcribes audio to text
7. **Backend** reads transcript from Whisper output
8. **Backend** stores transcript in database (text only, no audio)
9. **Backend** cleans up temporary files
10. **Response** returns transcript to extension

## Key Features

✅ **No Audio Storage** - Audio is processed in memory/temp files and immediately deleted
✅ **Self-Hosted** - Free, no API costs
✅ **Configurable** - Can switch to OpenAI API if needed
✅ **Consent Tracking** - Requires explicit consent before transcription
✅ **Linked to CRM** - Calls linked to Users, Leads, ClientLeads

## Next Steps (Frontend/Extension)

1. Build Chrome Extension to:
   - Detect Google Voice calls
   - Capture audio stream
   - Send to backend endpoints
   - Display transcripts in CRM UI

2. Frontend integration:
   - Add "Call" button to Lead/Contact pages
   - Display call history with transcripts
   - Show transcript viewer

## Testing

Test transcription endpoint:
```bash
curl -X POST http://localhost:3000/api/calls/:id/transcribe \
  -H "Authorization: Bearer <token>" \
  -F "audio=@test-audio.webm" \
  -F "consent=true" \
  -F "language=en"
```

## Notes

- Audio files are never stored in database
- Only transcript text is persisted
- Temporary files are automatically cleaned up
- Supports multiple audio formats (webm, mp3, wav, etc.)
- Model size affects accuracy vs speed tradeoff
