# Cross-Origin Storage Fix - Complete Solution

## Problem
The extension couldn't access localStorage from the CRM page because they're on different origins:
- CRM: `http://localhost:3001` (or your domain)
- Google Voice: `https://voice.google.com`

localStorage is origin-scoped, so the extension on Google Voice couldn't read the call context stored in CRM's localStorage.

## Solution Implemented

### 1. CRM Bridge Script (`crm-bridge.js`)
- **Runs on**: CRM pages (localhost, 127.0.0.1, and any https://*)
- **Purpose**: Watches localStorage and automatically stores it in Chrome storage
- **How it works**:
  - Checks localStorage every 1 second
  - When `VOICE_CRM_PENDING_CALL` is found, stores it in Chrome storage
  - Chrome storage works across all origins

### 2. Updated Content Script (`content.js`)
- **Runs on**: Google Voice pages
- **Changes**:
  - Now reads from Chrome storage (primary method)
  - Falls back to localStorage (for same-origin cases)
  - Tries Chrome storage in multiple places:
    - Initial page load
    - Periodic check (every 1 second)
    - DOM observer (when call is detected)
    - Manual detection function

### 3. Background Worker (`background.js`)
- **Added handlers**:
  - `VOICE_CRM_STORE_PENDING_CALL` - Stores call context
  - `VOICE_CRM_GET_PENDING_CALL` - Retrieves call context
  - Automatically expires old data (5 minutes)

## How to Verify It's Working

### Step 1: Check CRM Bridge is Running
1. Open CRM page (Lead Detail)
2. Press F12 → Console
3. Look for: `[Voice CRM Bridge] Content script loaded on: ...`
4. If you DON'T see this → Extension not loaded or bridge script not running

### Step 2: Make a Call
1. Click "Call Opt-in" → Give consent → "Make Call"
2. In CRM console, you should see:
   ```
   [Voice CRM Bridge] Detected pending call in localStorage, storing in Chrome storage: {...}
   [Voice CRM Bridge] Successfully stored pending call in Chrome storage
   ```

### Step 3: Check Google Voice Console
1. Open Google Voice page
2. Press F12 → Console
3. Look for:
   ```
   [Voice CRM] ✅ Found pending call in Chrome storage: {...}
   [Voice CRM] Context details: { phoneNumber: "+13153332077", leadId: 45151, ... }
   ```

### Step 4: Verify Call Creation
When call is detected, you should see:
```
[Voice CRM] ✅ Call record created
[Voice CRM] Call details: { id: X, phoneNumber: "+13153332077", leadId: 45151, ... }
```

## Troubleshooting

### Issue: Bridge Script Not Running
**Symptoms:**
- No `[Voice CRM Bridge]` messages in CRM console
- Calls still have wrong phone number/leadId

**Fix:**
1. Go to `chrome://extensions/`
2. Find your extension
3. Click **Reload**
4. Refresh CRM page
5. Check console again

### Issue: Chrome Storage Not Working
**Symptoms:**
- Bridge script runs but Chrome storage messages fail
- Extension can't read from Chrome storage

**Check:**
1. In Google Voice console, run:
   ```javascript
   chrome.runtime.sendMessage({ type: "VOICE_CRM_GET_PENDING_CALL" }, console.log);
   ```
2. Should return: `{ ok: true, data: {...} }`
3. If error, check extension permissions

### Issue: Context Still Wrong
**Symptoms:**
- Bridge script works
- Chrome storage has correct data
- But call still created with wrong phone number

**Check:**
1. In Google Voice console, look for:
   ```
   [Voice CRM] Using context: { phoneNumber: "...", leadId: ... }
   ```
2. Verify the phone number and leadId are correct
3. If wrong, check what's in Chrome storage:
   ```javascript
   chrome.runtime.sendMessage({ type: "VOICE_CRM_GET_PENDING_CALL" }, console.log);
   ```

## Expected Flow

1. **CRM Page**: User clicks "Call Opt-in" → "Make Call"
   - Frontend stores in localStorage: `VOICE_CRM_PENDING_CALL`
   - Bridge script detects it → Stores in Chrome storage

2. **Google Voice Page Opens**:
   - Content script loads
   - Reads from Chrome storage → Sets `pendingCallContext`
   - Starts observing for call

3. **User Makes Call**:
   - Extension detects call
   - Uses `pendingCallContext` (from Chrome storage)
   - Creates call record with correct phone number and leadId

4. **Call Record Created**:
   - Backend stores call with correct data
   - Extension clears Chrome storage
   - CRM can now find the call

## Manual Testing

### Test Chrome Storage
In Google Voice console:
```javascript
// Get pending call
chrome.runtime.sendMessage({ type: "VOICE_CRM_GET_PENDING_CALL" }, (r) => {
  console.log("Pending call:", r);
});

// Check what's stored
chrome.storage.local.get(["VOICE_CRM_PENDING_CALL"], (result) => {
  console.log("Stored data:", result);
});
```

### Test Bridge Script
In CRM console:
```javascript
// Check if bridge is running
console.log("[Voice CRM Bridge] Test");

// Manually trigger storage
localStorage.setItem("VOICE_CRM_PENDING_CALL", JSON.stringify({
  phoneNumber: "+13153332077",
  leadId: 45151,
  consent: true,
  direction: "outgoing",
  metadata: { timestamp: Date.now() }
}));
// Bridge should detect and store in Chrome storage
```

## Key Points

✅ **Chrome storage works across origins** - This is the key fix
✅ **Bridge script automatically syncs** - No manual intervention needed
✅ **Multiple fallbacks** - Extension tries Chrome storage, then localStorage
✅ **Better logging** - Easy to debug what's happening

## Next Steps

1. **Reload extension** (required for new bridge script)
2. **Refresh CRM page** (to load bridge script)
3. **Make a fresh call** (don't use old calls)
4. **Check console logs** (both CRM and Google Voice)
5. **Verify call has correct phone number and leadId**
