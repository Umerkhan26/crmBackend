# Whisper Installation Guide

This guide explains how to set up self-hosted Whisper for call transcription in the CRM backend.

## Overview

The backend uses OpenAI Whisper (self-hosted) for transcribing call audio. By default, it uses self-hosted Whisper, but you can switch to OpenAI API by setting `USE_OPENAI_WHISPER=true`.

## Self-Hosted Whisper Setup

### Prerequisites

- Python 3.8 or higher
- pip (Python package manager)

### Installation Steps

1. **Install Whisper via pip:**
   ```bash
   pip install openai-whisper
   ```

2. **Verify Installation:**
   ```bash
   whisper --help
   ```

3. **Download Models (Optional - done automatically on first use):**
   - Models: `tiny`, `base`, `small`, `medium`, `large`
   - Larger models = better accuracy but slower
   - Default: `base` (good balance)

### Environment Variables

Add to your `.env` file:

```env
# Whisper Configuration (Self-Hosted)
WHISPER_MODEL=base
WHISPER_COMMAND=whisper

# Optional: Use OpenAI API instead
# USE_OPENAI_WHISPER=true
# OPENAI_API_KEY=your-api-key-here
```

### Model Options

- `tiny` - Fastest, least accurate (~39M parameters)
- `base` - Good balance (default) (~74M parameters)
- `small` - Better accuracy (~244M parameters)
- `medium` - High accuracy (~769M parameters)
- `large` - Best accuracy, slowest (~1550M parameters)

### System Requirements

- **CPU**: Multi-core recommended
- **RAM**: 
  - `tiny/base`: ~1GB
  - `small`: ~2GB
  - `medium`: ~5GB
  - `large`: ~10GB
- **Disk**: ~3-6GB for model storage (first download)

### Troubleshooting

1. **"whisper: command not found"**
   - Ensure Python and pip are in your PATH
   - Try: `python -m pip install openai-whisper`
   - Use full path: `WHISPER_COMMAND=/usr/local/bin/whisper`

2. **Slow transcription**
   - Use smaller model (`tiny` or `base`)
   - Consider GPU acceleration (requires CUDA)

3. **Out of memory**
   - Use smaller model
   - Reduce audio file size
   - Increase server RAM

4. **Audio format issues**
   - Whisper supports: mp3, wav, m4a, webm, etc.
   - If issues occur, convert audio first

## Using OpenAI Whisper API (Alternative)

If you prefer cloud-based transcription:

1. Get API key from https://platform.openai.com/
2. Set in `.env`:
   ```env
   USE_OPENAI_WHISPER=true
   OPENAI_API_KEY=sk-xxxxxxxxxxxxx
   ```

**Note:** OpenAI API has usage costs, while self-hosted Whisper is free.

## Testing

Test the transcription endpoint:
```bash
POST /api/calls/:id/transcribe
Content-Type: multipart/form-data
Authorization: Bearer <token>

Form data:
- audio: <audio file>
- consent: true
- language: en (optional)
```
