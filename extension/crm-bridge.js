// Content script that runs on CRM pages to bridge localStorage to Chrome storage
// This allows the extension to access call context across different origins

console.log("[Voice CRM Bridge] Content script loaded on:", window.location.href);

// Listen for localStorage changes
let lastPendingCall = null;
let lastStoreTime = 0;
const STORE_THROTTLE_MS = 2000; // Only store once every 2 seconds to prevent duplicates

function checkAndStorePendingCall() {
  try {
    const pendingCallStr = localStorage.getItem("VOICE_CRM_PENDING_CALL");
    
    if (pendingCallStr) {
      const payload = JSON.parse(pendingCallStr);
      
      // Normalize field names (fix case sensitivity issues)
      if (payload.LeadId !== undefined && payload.leadId === undefined) {
        payload.leadId = payload.LeadId;
        delete payload.LeadId;
      }
      if (payload.ClientLeadId !== undefined && payload.clientLeadId === undefined) {
        payload.clientLeadId = payload.ClientLeadId;
        delete payload.ClientLeadId;
      }
      
      // Only store if it's different from last one AND enough time has passed (throttle)
      const payloadStr = JSON.stringify(payload);
      const now = Date.now();
      const timeSinceLastStore = now - lastStoreTime;
      
      if (payloadStr !== lastPendingCall && timeSinceLastStore >= STORE_THROTTLE_MS) {
        lastPendingCall = payloadStr;
        lastStoreTime = now;
        
        console.log("[Voice CRM Bridge] Detected pending call in localStorage, storing in Chrome storage:", payload);
        
        // Store in Chrome storage via background
        chrome.runtime.sendMessage(
          {
            type: "VOICE_CRM_STORE_PENDING_CALL",
            payload: payload,
          },
          (response) => {
            if (chrome.runtime.lastError) {
              console.error("[Voice CRM Bridge] Error storing in Chrome storage:", chrome.runtime.lastError);
            } else if (response?.ok) {
              console.log("[Voice CRM Bridge] Successfully stored pending call in Chrome storage");
            }
          }
        );
      } else if (payloadStr === lastPendingCall) {
        // Same call, don't store again (already stored)
        // console.log("[Voice CRM Bridge] Same pending call, skipping storage (throttled)");
      } else {
        // Too soon since last store, skip
        // console.log("[Voice CRM Bridge] Throttled, skipping storage");
      }
    } else {
      // If localStorage is cleared, also clear Chrome storage (but throttle this too)
      if (lastPendingCall && (now - lastStoreTime) >= STORE_THROTTLE_MS) {
        lastPendingCall = null;
        lastStoreTime = now;
        chrome.runtime.sendMessage(
          {
            type: "VOICE_CRM_STORE_PENDING_CALL",
            payload: null,
          },
          () => {}
        );
      }
    }
  } catch (e) {
    console.error("[Voice CRM Bridge] Error checking localStorage:", e);
  }
}

// Check immediately
checkAndStorePendingCall();

// Check periodically (less frequently to reduce duplicate storage)
setInterval(checkAndStorePendingCall, 2000);

// Also listen for storage events (in case localStorage changes in another tab/window)
window.addEventListener("storage", (e) => {
  if (e.key === "VOICE_CRM_PENDING_CALL") {
    checkAndStorePendingCall();
  }
});

// Listen for custom events from the page
window.addEventListener("message", (event) => {
  // Only accept messages from same origin
  if (event.origin !== window.location.origin) return;
  
  if (event.data?.type === "VOICE_CRM_STORE_CALL") {
    const payload = event.data.payload;
    console.log("[Voice CRM Bridge] Received store call message:", payload);
    
    // Store in localStorage (for compatibility)
    if (payload) {
      localStorage.setItem("VOICE_CRM_PENDING_CALL", JSON.stringify(payload));
    } else {
      localStorage.removeItem("VOICE_CRM_PENDING_CALL");
    }
    
    // Also store in Chrome storage
    chrome.runtime.sendMessage(
      {
        type: "VOICE_CRM_STORE_PENDING_CALL",
        payload: payload,
      },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error("[Voice CRM Bridge] Error storing:", chrome.runtime.lastError);
        } else {
          console.log("[Voice CRM Bridge] Stored in Chrome storage");
        }
      }
    );
  }
});
