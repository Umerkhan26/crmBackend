# Quick Setup Guide - Fix Extension Errors

## Error 1: Missing backendBaseUrl

**What it means:** The extension doesn't know where your backend API is located.

**How to fix:**
1. Click the **extension icon** in Chrome toolbar (top right)
2. You'll see a popup with configuration fields
3. Enter:
   - **Backend Base URL**: `http://localhost:3000` (or your backend URL)
   - **JWT**: Paste your authentication token from CRM
   - **Consent**: Check the box
4. Click **"Open Voice & Dial"** button (this saves the config)

**To get JWT token:**
1. Open your CRM in browser
2. Login
3. Press F12 → Console
4. Type: `localStorage.getItem("token")`
5. Copy the value
6. Paste it in extension popup

## Error 2: Missing phoneNumber in context

**What it means:** The extension can't find the phone number when trying to create a call record.

**Possible causes:**
1. Chrome storage doesn't have the call context
2. The call context was cleared before the call was detected
3. The bridge script didn't store the data properly

**How to verify:**
1. Open Google Voice page
2. Press F12 → Console
3. Run this command:
   ```javascript
   chrome.runtime.sendMessage({ type: "VOICE_CRM_GET_PENDING_CALL" }, (r) => {
     console.log("Pending call:", r);
   });
   ```
4. If it returns `{ ok: true, data: null }` or `{ ok: true, data: {...} }` without phoneNumber, the context is missing

**How to fix:**
1. Make sure you clicked "Call Opt-in" in CRM before opening Google Voice
2. Check CRM console for: `[Voice CRM Bridge] Successfully stored pending call`
3. If you don't see that message, the bridge script might not be running
4. Reload extension and refresh CRM page

## Step-by-Step Setup

### Step 1: Configure Extension
1. Click extension icon in Chrome toolbar
2. Enter Backend URL: `http://localhost:3000`
3. Get JWT token from CRM (see above)
4. Paste JWT token
5. Check consent checkbox
6. Click "Open Voice & Dial" (saves config)

### Step 2: Test Configuration
1. In Google Voice console, run:
   ```javascript
   chrome.storage.local.get(["backendBaseUrl", "jwt"], console.log);
   ```
2. Should show your backend URL and JWT

### Step 3: Make a Call
1. Go to CRM → Lead Detail page
2. Click "Call Opt-in" button
3. Give consent → Click "Make Call"
4. Check CRM console for: `[Voice CRM Bridge] Successfully stored...`
5. Make call in Google Voice
6. Check Google Voice console for call detection

## Troubleshooting

### Extension popup not opening?
- Go to `chrome://extensions/`
- Find your extension
- Make sure it's **enabled**
- Click the extension icon again

### JWT token expired?
- Get a fresh token from CRM
- Update it in extension popup
- Click "Open Voice & Dial" to save

### Still getting "Missing backendBaseUrl"?
- Make sure you clicked "Open Voice & Dial" button (this saves the config)
- Check extension storage:
  ```javascript
  chrome.storage.local.get(["backendBaseUrl"], console.log);
  ```

### Still getting "Missing phoneNumber"?
- Make sure you clicked "Call Opt-in" in CRM FIRST
- Check CRM console for bridge script messages
- Reload extension and refresh CRM page
- Try making a fresh call
