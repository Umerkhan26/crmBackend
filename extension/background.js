// MV3 Service Worker (module)
// Background worker performs backend API calls to avoid content-script CORS limitations.

async function ensureOffscreen() {
  const exists = await chrome.offscreen.hasDocument?.();
  if (exists) {
    console.log("[Voice CRM Background] Offscreen document already exists");
    return;
  }
  console.log("[Voice CRM Background] Creating offscreen document...");
  await chrome.offscreen.createDocument({
    url: "offscreen.html",
    reasons: ["USER_MEDIA"],
    justification: "Capture tab audio during call for transcription without storing audio.",
  });
  console.log("[Voice CRM Background] ✅ Offscreen document created");
  // Give it a moment to load
  await new Promise(resolve => setTimeout(resolve, 500));
}

async function getConfig() {
  const { backendBaseUrl, jwt } = await chrome.storage.local.get(["backendBaseUrl", "jwt"]);
  return {
    backendBaseUrl: (backendBaseUrl || "").replace(/\/+$/, ""),
    jwt: jwt || "",
  };
}

async function doRequest(method, path, body) {
  const cfg = await getConfig();
  if (!cfg.backendBaseUrl) {
    const errorMsg = "Missing backendBaseUrl in extension config. Please click extension icon and configure Backend URL.";
    console.error("[Voice CRM Background]", errorMsg);
    throw new Error(errorMsg);
  }
  if (!cfg.jwt) {
    const errorMsg = "Missing JWT in extension config. Please click extension icon and configure JWT token.";
    console.error("[Voice CRM Background]", errorMsg);
    throw new Error(errorMsg);
  }

  const res = await fetch(`${cfg.backendBaseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.jwt}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.message || `HTTP ${res.status}`);
  }
  return data;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "VOICE_CRM_API") {
    (async () => {
      try {
        const data = await doRequest(msg.method, msg.path, msg.body);
        sendResponse({ ok: true, data });
      } catch (e) {
        sendResponse({ ok: false, error: e?.message || String(e) });
      }
    })();
    return true; // keep channel open for async sendResponse
  }

  // Store pending call context from frontend
  if (msg?.type === "VOICE_CRM_STORE_PENDING_CALL") {
    (async () => {
      try {
        if (msg.payload === null) {
          // Clear the stored call
          await chrome.storage.local.remove(["VOICE_CRM_PENDING_CALL"]);
          console.log("[Voice CRM Background] Cleared pending call");
          sendResponse({ ok: true });
        } else {
          const callData = msg.payload || {};
          callData.metadata = { ...(callData.metadata || {}), storedAt: Date.now() };
          await chrome.storage.local.set({ VOICE_CRM_PENDING_CALL: callData });
          console.log("[Voice CRM Background] Stored pending call:", callData);
          sendResponse({ ok: true });
        }
      } catch (e) {
        sendResponse({ ok: false, error: e?.message || String(e) });
      }
    })();
    return true;
  }

  // Get pending call context
  if (msg?.type === "VOICE_CRM_GET_PENDING_CALL") {
    (async () => {
      try {
        const result = await chrome.storage.local.get(["VOICE_CRM_PENDING_CALL"]);
        const pendingCall = result.VOICE_CRM_PENDING_CALL;
        if (pendingCall) {
          // Check if it's recent (within 5 minutes)
          const timestamp = pendingCall.metadata?.timestamp || pendingCall.metadata?.storedAt || 0;
          const age = Date.now() - timestamp;
          if (age < 5 * 60 * 1000) {
            sendResponse({ ok: true, data: pendingCall });
          } else {
            // Too old, remove it
            await chrome.storage.local.remove(["VOICE_CRM_PENDING_CALL"]);
            sendResponse({ ok: true, data: null });
          }
        } else {
          sendResponse({ ok: true, data: null });
        }
      } catch (e) {
        sendResponse({ ok: false, error: e?.message || String(e) });
      }
    })();
    return true;
  }

  if (msg?.type === "VOICE_CRM_START_TRANSCRIPTION") {
    (async () => {
      try {
        console.log("[Voice CRM Background] Starting transcription for call:", msg.callId);
        await ensureOffscreen();
        const tabId = sender?.tab?.id;
        if (!tabId) throw new Error("Missing tabId");

        console.log("[Voice CRM Background] Getting media stream for tab:", tabId);
        const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tabId });
        console.log("[Voice CRM Background] Got stream ID:", streamId);
        
        // Send message to offscreen document
        // In MV3, offscreen documents receive messages via chrome.runtime.onMessage
        // We need to send the message and wait for response
        let responded = false;
        const timeout = setTimeout(() => {
          if (!responded) {
            responded = true;
            console.error("[Voice CRM Background] Timeout waiting for offscreen response");
            sendResponse({ ok: false, error: "Timeout waiting for offscreen document" });
          }
        }, 10000); // 10 second timeout
        
        chrome.runtime.sendMessage({
          type: "OFFSCREEN_START",
          streamId,
          callId: msg.callId,
        }, (resp) => {
          if (responded) return;
          responded = true;
          clearTimeout(timeout);
          
          if (chrome.runtime.lastError) {
            console.error("[Voice CRM Background] Error sending to offscreen:", chrome.runtime.lastError);
            sendResponse({ ok: false, error: chrome.runtime.lastError.message });
          } else if (!resp?.ok) {
            console.error("[Voice CRM Background] Offscreen start failed:", resp?.error);
            sendResponse({ ok: false, error: resp?.error || "Offscreen start failed" });
          } else {
            console.log("[Voice CRM Background] ✅ Transcription started successfully");
            sendResponse({ ok: true });
          }
        });
      } catch (e) {
        console.error("[Voice CRM Background] Transcription start error:", e);
        sendResponse({ ok: false, error: e?.message || String(e) });
      }
    })();
    return true; // Keep channel open for async response
  }

  if (msg?.type === "VOICE_CRM_STOP_TRANSCRIPTION") {
    (async () => {
      try {
        console.log("[Voice CRM Background] Stopping transcription and uploading audio...");
        await ensureOffscreen();
        
        // Send message to offscreen document to stop recording and upload
        let responded = false;
        const timeout = setTimeout(() => {
          if (!responded) {
            responded = true;
            console.error("[Voice CRM Background] Timeout waiting for offscreen stop response");
            sendResponse({ ok: false, error: "Timeout waiting for offscreen document" });
          }
        }, 30000); // 30 second timeout (transcription upload can take time)
        
        chrome.runtime.sendMessage({ type: "OFFSCREEN_STOP" }, (resp) => {
          if (responded) return;
          responded = true;
          clearTimeout(timeout);
          
          if (chrome.runtime.lastError) {
            console.error("[Voice CRM Background] Error sending to offscreen:", chrome.runtime.lastError);
            sendResponse({ ok: false, error: chrome.runtime.lastError.message });
          } else if (!resp?.ok) {
            console.error("[Voice CRM Background] Offscreen stop failed:", resp?.error);
            sendResponse({ ok: false, error: resp?.error || "Offscreen stop failed" });
          } else {
            console.log("[Voice CRM Background] ✅ Transcription stopped and uploaded:", resp);
            sendResponse({ ok: true, data: resp.data, skipped: resp.skipped });
          }
        });
      } catch (e) {
        console.error("[Voice CRM Background] Transcription stop error:", e);
        sendResponse({ ok: false, error: e?.message || String(e) });
      }
    })();
    return true; // Keep channel open for async response
  }
});


