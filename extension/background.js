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
  // Ping handler to detect if extension is installed
  if (msg?.type === "VOICE_CRM_PING") {
    sendResponse({ ok: true, message: "Extension is active" });
    return true;
  }

  // Auto-configure extension from frontend
  if (msg?.type === "VOICE_CRM_SET_CONFIG") {
    (async () => {
      try {
        const { backendBaseUrl, jwt } = msg.payload || {};
        if (backendBaseUrl) {
          await chrome.storage.local.set({ backendBaseUrl });
          console.log("[Voice CRM Background] Backend URL configured:", backendBaseUrl);
        }
        if (jwt) {
          await chrome.storage.local.set({ jwt });
          console.log("[Voice CRM Background] JWT configured");
        }
        sendResponse({ ok: true, message: "Configuration updated successfully" });
      } catch (e) {
        console.error("[Voice CRM Background] Error setting config:", e);
        sendResponse({ ok: false, error: e?.message || String(e) });
      }
    })();
    return true; // Keep channel open for async response
  }

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

  // Open or reuse Google Voice tab
  if (msg?.type === "VOICE_CRM_OPEN_TAB") {
    (async () => {
      try {
        const url = msg.url || "https://voice.google.com/u/0/calls";
        
        // Get all tabs and filter for Google Voice tabs manually
        // This is more reliable than URL pattern matching
        const allTabs = await chrome.tabs.query({});
        
        // Filter for Google Voice tabs - check multiple conditions
        const voiceTabs = allTabs.filter(tab => {
          if (!tab) return false;
          const tabUrl = (tab.url || tab.pendingUrl || "").toLowerCase();
          const tabTitle = (tab.title || "").toLowerCase();
          
          // Check if URL contains voice.google.com
          const isVoiceUrl = tabUrl.includes("voice.google.com");
          
          // Also check title as backup (Google Voice pages often have "Google Voice" in title)
          const isVoiceTitle = tabTitle.includes("google voice") || tabTitle.includes("voice");
          
          return isVoiceUrl || (isVoiceTitle && tabUrl.includes("google.com"));
        });
        
        console.log("[Voice CRM Background] 🔍 Tab detection:", {
          totalTabs: allTabs.length,
          voiceTabsFound: voiceTabs.length,
          voiceTabDetails: voiceTabs.map(t => ({
            id: t.id,
            url: t.url || t.pendingUrl,
            title: t.title,
            active: t.active
          })),
          sampleTabUrls: allTabs.slice(0, 10).map(t => ({
            url: t.url || t.pendingUrl || "no-url",
            title: t.title || "no-title"
          }))
        });
        
        if (voiceTabs.length > 0) {
          // Prefer an active Google Voice tab, otherwise use the first one
          let existingTab = voiceTabs.find(t => t.active) || voiceTabs[0];
          
          console.log("[Voice CRM Background] ✅ Reusing existing Google Voice tab:", {
            id: existingTab.id,
            url: existingTab.url || existingTab.pendingUrl,
            wasActive: existingTab.active
          });
          
          // Update the tab URL to make the call and activate it
          await chrome.tabs.update(existingTab.id, { 
            url: url,
            active: true // Activate the tab
          });
          
          // Wait a moment for the tab to update
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Bring the window to front
          try {
            const tabInfo = await chrome.tabs.get(existingTab.id);
            if (tabInfo.windowId) {
              await chrome.windows.update(tabInfo.windowId, { focused: true });
            }
          } catch (winError) {
            console.warn("[Voice CRM Background] Could not focus window:", winError);
          }
          
          console.log("[Voice CRM Background] ✅ Reused existing tab and navigated to:", url);
          sendResponse({ 
            ok: true, 
            tabId: existingTab.id, 
            reused: true 
          });
        } else {
          // No existing tab, create a new one
          console.log("[Voice CRM Background] ⚠️ No existing Google Voice tab found, creating new tab");
          console.log("[Voice CRM Background] All tab URLs checked:", allTabs.map(t => ({
            url: t.url || t.pendingUrl || "no-url",
            title: t.title || "no-title"
          })));
          const newTab = await chrome.tabs.create({ 
            url: url,
            active: true 
          });
          
          console.log("[Voice CRM Background] ✅ Created new Google Voice tab:", newTab.id);
          sendResponse({ 
            ok: true, 
            tabId: newTab.id, 
            reused: false 
          });
        }
      } catch (e) {
        console.error("[Voice CRM Background] Error opening/reusing tab:", e);
        sendResponse({ 
          ok: false, 
          error: e?.message || String(e) 
        });
      }
    })();
    return true; // Keep channel open for async response
  }

  // Get tab audio stream ID for recording
  if (msg?.type === "VOICE_CRM_GET_TAB_AUDIO") {
    (async () => {
      try {
        const tabId = msg.tabId;
        if (!tabId) {
          // Try to find Google Voice tab
          const tabs = await chrome.tabs.query({ url: "*://voice.google.com/*" });
          if (tabs.length > 0) {
            const voiceTab = tabs[0];
            const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: voiceTab.id });
            console.log("[Voice CRM Background] Got tab audio stream ID for Google Voice tab:", streamId);
            sendResponse({ ok: true, streamId, tabId: voiceTab.id });
          } else {
            sendResponse({ ok: false, error: "Google Voice tab not found" });
          }
        } else {
          const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tabId });
          console.log("[Voice CRM Background] Got tab audio stream ID:", streamId);
          sendResponse({ ok: true, streamId, tabId });
        }
      } catch (e) {
        console.error("[Voice CRM Background] Error getting tab audio:", e);
        sendResponse({ ok: false, error: e?.message || String(e) });
      }
    })();
    return true; // Keep channel open for async response
  }
});


