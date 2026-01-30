let activeCall = null;
let observer = null;
let durationStored = false; // Flag to ensure duration is only stored once
let callEndedFlag = false; // Flag to prevent duplicate call end updates
let callAttendedAt = null; // Timestamp when call was answered/attended (duration starts from here)
let callAttendedFlag = false; // Flag to track if call has been marked as attended
let lastCallId = null; // Track last call ID to prevent mixing calls
let isProcessingCall = false; // Flag to prevent concurrent call processing

function nowIso() {
  return new Date().toISOString();
}

async function apiRequest(method, path, body) {
  return await new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { type: "VOICE_CRM_API", method, path, body },
      (resp) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (!resp?.ok) {
          reject(new Error(resp?.error || "Request failed"));
          return;
        }
        resolve(resp.data);
      }
    );
  });
}

async function apiPost(path, body) {
  return await apiRequest("POST", path, body);
}

async function apiPatch(path, body) {
  return await apiRequest("PATCH", path, body);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function findDialInput() {
  return (
    document.querySelector('input[aria-label*="Enter a name or number"]') ||
    document.querySelector('input[placeholder*="name or number"]') ||
    document.querySelector('input[type="text"]')
  );
}

function findCallButton() {
  // Heuristic: the call button near the dial input is often a button element.
  // We look for a button that is enabled and contains an SVG icon.
  const buttons = Array.from(document.querySelectorAll("button"));
  const enabled = buttons.filter((b) => !b.disabled);
  const likely = enabled.find((b) => (b.getAttribute("aria-label") || "").toLowerCase().includes("call"));
  if (likely) return likely;
  return enabled.find((b) => b.querySelector("svg")) || null;
}

function isInCallUI() {
  // Aggressive detection - check for multiple indicators of active call
  const buttons = Array.from(document.querySelectorAll("button"));
  const allText = document.body.innerText || "";
  const buttonLabels = buttons
    .map((b) => (b.getAttribute("aria-label") || b.textContent || "").toLowerCase())
    .filter(Boolean);
  
  // Method 1: Check for call control buttons (Transfer, Hold, Mute, Record, Keypad)
  const hasCallControls = buttonLabels.some((l) => 
    l.includes("transfer") || 
    l.includes("hold") ||
    l.includes("mute") || 
    l.includes("unmute") ||
    l.includes("record") ||
    l.includes("keypad") ||
    l.includes("add")
  );
  
  // Method 2: Check for call duration timer (format: 00:14, 01:23, etc.)
  // Also try to extract the actual duration value for more accurate timing
  let actualCallDuration = null;
  let isCallAttended = false; // Call is attended when duration > 00:00
  const durationElements = Array.from(document.querySelectorAll('*')).filter(el => {
    const text = el.textContent?.trim() || '';
    return /^\d{2}:\d{2}$/.test(text);
  });
  
  if (durationElements.length > 0) {
    const durationText = durationElements[0].textContent.trim();
    const [minutes, seconds] = durationText.split(':').map(Number);
    actualCallDuration = minutes * 60 + seconds;
    
    // Call is "attended" (answered) when duration > 00:00
    isCallAttended = actualCallDuration > 0;
    
    if (isCallAttended) {
      console.log("[Voice CRM] Call is ATTENDED - duration:", durationText, "(" + actualCallDuration + " seconds)");
    } else {
      console.log("[Voice CRM] Call is RINGING - duration:", durationText);
    }
  }
  
  const hasCallDuration = durationElements.length > 0 || 
                          document.querySelector('[class*="duration"]') || 
                          document.querySelector('[class*="timer"]') ||
                          document.querySelector('text[class*="time"]');
  
  // Method 3: Check for hang up/end call buttons
  const hasEndButton = buttonLabels.some((l) => 
    l.includes("end") || 
    l.includes("hang up") || 
    l.includes("hangup") ||
    l.includes("hang up call") ||
    l.includes("end call")
  );
  
  // Method 4: Check URL for call indicators
  const urlHasCall = window.location.href.includes("/calls") && 
                     !window.location.href.includes("/messages");
  
  // Method 5: Check for phone number display with call controls (active call UI)
  const hasPhoneNumberWithControls = /\(\d{3}\)\s\d{3}-\d{4}/.test(allText) && hasCallControls;
  
  // Method 6: Check for specific call-related text
  const hasCallText = allText.toLowerCase().includes("transfer") && 
                      allText.toLowerCase().includes("hold") &&
                      allText.toLowerCase().includes("mute");
  
  // Combine all methods - if ANY strong indicator is present
  // BUT: Require duration > 0 OR call controls to be more reliable
  const isInCall = (hasCallDuration && actualCallDuration !== null && actualCallDuration > 0) || 
                   (hasCallControls && hasEndButton) || 
                   (hasCallDuration && hasEndButton) ||
                   (hasCallControls && actualCallDuration !== null && actualCallDuration > 0);
  
  // Store actual duration if found (for more accurate call timing)
  if (isInCall && actualCallDuration !== null && actualCallDuration > 0) {
    window.voiceCrmActualDuration = actualCallDuration;
    window.voiceCrmIsCallAttended = isCallAttended; // Store attended status
  } else {
    // Clear stored duration if not in call
    window.voiceCrmActualDuration = null;
    window.voiceCrmIsCallAttended = false;
  }
  
  // Always log detection attempt for debugging
  if (isInCall || Math.random() < 0.05) { // Log 5% of checks even when not in call
    console.log("[Voice CRM] Call detection check:", {
      hasCallControls,
      hasCallDuration: !!hasCallDuration,
      actualDuration: actualCallDuration,
      isCallAttended,
      hasEndButton,
      urlHasCall,
      hasPhoneNumberWithControls,
      hasCallText,
      isInCall,
      url: window.location.href
    });
  }
  
  return { isInCall, isCallAttended, actualDuration: actualCallDuration };
}

async function dialNumber(phoneNumber) {
  // Retry because Voice is an SPA; elements appear asynchronously.
  for (let i = 0; i < 30; i++) {
    const input = findDialInput();
    if (input) {
      input.focus();
      input.value = phoneNumber;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      await sleep(200);
      const callBtn = findCallButton();
      if (callBtn) callBtn.click();
      return true;
    }
    await sleep(500);
  }
  return false;
}

function startObservingCallLifecycle(callContext) {
  if (observer) observer.disconnect();

  let lastInCall = false;
  let periodicCheckInterval = null;
  
  console.log("[Voice CRM] Starting call lifecycle observer", callContext);

  // Periodic check as fallback (every 500ms for faster detection)
  const performPeriodicCheck = async () => {
    const callState = isInCallUI();
    const inCall = callState.isInCall;
    const isCallAttended = callState.isCallAttended;
    const callStateDuration = callState.actualDuration;
    
    // Track when call is attended (answered) - duration starts from here
    if (isCallAttended && !callAttendedFlag && activeCall?.id) {
      callAttendedAt = nowIso();
      callAttendedFlag = true;
      console.log("[Voice CRM] ✅ Call ATTENDED at:", callAttendedAt, "- Duration tracking started");
    }
    
    // If we're in a call but haven't created a record yet
    // Prevent concurrent processing
    if (inCall && !activeCall && !isProcessingCall) {
      isProcessingCall = true; // Set flag to prevent concurrent processing
      // ALWAYS try to get fresh context from Chrome storage first
      let contextToUse = null;
      
      // Try Chrome storage first (always, even if we have cached context)
      try {
        const storageResponse = await new Promise((resolve) => {
          chrome.runtime.sendMessage(
            { type: "VOICE_CRM_GET_PENDING_CALL" },
            (response) => {
              if (chrome.runtime.lastError) {
                resolve({ ok: false, error: chrome.runtime.lastError.message });
              } else {
                resolve(response);
              }
            }
          );
        });
        
        if (storageResponse?.ok && storageResponse.data) {
          contextToUse = storageResponse.data;
          
          // Normalize field names
          if (contextToUse.LeadId !== undefined && contextToUse.leadId === undefined) {
            contextToUse.leadId = contextToUse.LeadId;
            delete contextToUse.LeadId;
          }
          if (contextToUse.ClientLeadId !== undefined && contextToUse.clientLeadId === undefined) {
            contextToUse.clientLeadId = contextToUse.ClientLeadId;
            delete contextToUse.ClientLeadId;
          }
          
          pendingCallContext = contextToUse; // Cache it
          console.log("[Voice CRM] ✅ Got FRESH context from Chrome storage in periodic check:", contextToUse);
        }
      } catch (e) {
        console.warn("[Voice CRM] Error getting from Chrome storage in periodic check:", e);
      }
      
      // Fallback to cached context
      if (!contextToUse) {
        contextToUse = pendingCallContext || callContext;
        console.log("[Voice CRM] Using cached context in periodic check:", contextToUse);
      }
      
      // If still no context, try localStorage
      if (!contextToUse) {
        try {
          const storageResponse = await new Promise((resolve) => {
            chrome.runtime.sendMessage(
              { type: "VOICE_CRM_GET_PENDING_CALL" },
              (response) => {
                if (chrome.runtime.lastError) {
                  resolve({ ok: false, error: chrome.runtime.lastError });
                } else {
                  resolve(response);
                }
              }
            );
          });
          
          if (storageResponse?.ok && storageResponse.data) {
            contextToUse = storageResponse.data;
            
            // Normalize field names
            if (contextToUse.LeadId !== undefined && contextToUse.leadId === undefined) {
              contextToUse.leadId = contextToUse.LeadId;
              delete contextToUse.LeadId;
            }
            if (contextToUse.ClientLeadId !== undefined && contextToUse.clientLeadId === undefined) {
              contextToUse.clientLeadId = contextToUse.ClientLeadId;
              delete contextToUse.ClientLeadId;
            }
            
            pendingCallContext = contextToUse; // Cache it
            console.log("[Voice CRM] Loaded context from Chrome storage in periodic check:", contextToUse);
            console.log("[Voice CRM] Normalized context:", {
              phoneNumber: contextToUse.phoneNumber,
              leadId: contextToUse.leadId,
              consent: contextToUse.consent
            });
          }
        } catch (e) {
          console.warn("[Voice CRM] Error getting from Chrome storage in periodic check:", e);
        }
      }
      
      // Fallback to localStorage if still no context
      if (!contextToUse) {
        try {
          const pendingCallStr = localStorage.getItem("VOICE_CRM_PENDING_CALL");
          if (pendingCallStr) {
            contextToUse = JSON.parse(pendingCallStr);
            pendingCallContext = contextToUse; // Cache it
            console.log("[Voice CRM] Loaded context from localStorage in periodic check:", contextToUse);
          }
        } catch (e) {
          console.warn("[Voice CRM] Error getting from localStorage in periodic check:", e);
        }
      }
      
      if (contextToUse) {
        console.log("[Voice CRM] Periodic check detected call! Creating record...");
        console.log("[Voice CRM] Using context:", {
          phoneNumber: contextToUse.phoneNumber,
          leadId: contextToUse.leadId,
          consent: contextToUse.consent
        });
        
        // Validate required fields
        if (!contextToUse || !contextToUse.phoneNumber) {
          console.error("[Voice CRM] ❌ Missing phoneNumber in context!");
          console.log("[Voice CRM] Context object:", contextToUse);
          console.log("[Voice CRM] Available context keys:", contextToUse ? Object.keys(contextToUse) : "context is null/undefined");
          console.log("[Voice CRM] ⚠️ TROUBLESHOOTING: Check Chrome storage:");
          chrome.runtime.sendMessage({ type: "VOICE_CRM_GET_PENDING_CALL" }, (r) => {
            console.log("[Voice CRM] Chrome storage check:", r);
          });
          return;
        }
        
        // Final validation
        if (!contextToUse.phoneNumber || contextToUse.phoneNumber === "undefined" || contextToUse.phoneNumber === "") {
          console.error("[Voice CRM] ❌ Invalid phoneNumber in context:", contextToUse.phoneNumber);
          return;
        }
        
        try {
          const startedAt = nowIso();
          const callData = {
            phoneNumber: contextToUse.phoneNumber, // Use phoneNumber from context, not from UI
            direction: contextToUse.direction || "outgoing",
            consent: Boolean(contextToUse.consent),
            leadId: contextToUse.leadId ? parseInt(contextToUse.leadId) : null,
            clientLeadId: contextToUse.clientLeadId ? parseInt(contextToUse.clientLeadId) : null,
            startedAt,
            status: "in_progress",
            metadata: { 
              ...(contextToUse.metadata || {}), 
              detectedBy: "periodic_check",
              originalPhoneNumber: contextToUse.phoneNumber, // Store original for debugging
              contextSource: "chrome_storage_periodic"
            },
          };
          
          console.log("[Voice CRM] ⚠️ VERIFY: Sending call data to backend:", callData);
          console.log("[Voice CRM] ⚠️ VERIFY: Phone number:", callData.phoneNumber, "LeadId:", callData.leadId);
          const resp = await apiPost("/api/calls/start", callData);
          activeCall = { id: resp?.data?.id, startedAt };
          lastCallId = resp?.data?.id; // Track this call ID
          durationStored = false; // Reset flag for new call
          callEndedFlag = false; // Reset flag for new call
          callAttendedAt = null; // Reset attended timestamp
          callAttendedFlag = false; // Reset attended flag
          isProcessingCall = false; // Reset processing flag
          console.log("[Voice CRM] ✅ Call record created via periodic check:", activeCall);
          console.log("[Voice CRM] Call start timestamp:", startedAt, "(" + new Date(startedAt).toISOString() + ")");
          console.log("[Voice CRM] Call details:", {
            id: activeCall.id,
            phoneNumber: callData.phoneNumber,
            leadId: callData.leadId,
            status: callData.status
          });
          
          // Clear pending context and Chrome storage after successful creation
          pendingCallContext = null;
          chrome.runtime.sendMessage(
            { type: "VOICE_CRM_STORE_PENDING_CALL", payload: null },
            () => {}
          );

          // DON'T start recording yet - wait for call to be attended (answered)
          // Recording will start when call is detected as attended (duration > 0)
          console.log("[Voice CRM] ⏸️ Call detected but not attended yet - waiting for call to be answered before starting recording");
        } catch (e) {
          console.error("[Voice CRM] Periodic check failed to create call:", e);
          isProcessingCall = false; // Reset on error
        }
      } else if (inCall && !activeCall && isProcessingCall) {
        // Already processing, skip
        return;
      }
    }
    
    // If call ended - check flag to prevent duplicate updates
    if (!inCall && activeCall?.id && !callEndedFlag) {
      console.log("[Voice CRM] Periodic check detected call end");
      callEndedFlag = true; // Set flag immediately to prevent duplicate updates
      try {
        // Get fresh context to check consent
        let contextToUse = pendingCallContext || callContext;
        if (!contextToUse) {
          try {
            const storageResponse = await new Promise((resolve) => {
              chrome.runtime.sendMessage(
                { type: "VOICE_CRM_GET_PENDING_CALL" },
                (response) => {
                  if (chrome.runtime.lastError) {
                    resolve({ ok: false });
                  } else {
                    resolve(response);
                  }
                }
              );
            });
            if (storageResponse?.ok && storageResponse.data) {
              contextToUse = storageResponse.data;
            }
          } catch (e) {
            console.warn("[Voice CRM] Error getting context for transcription:", e);
          }
        }
        
        // Stop transcription BEFORE ending call
        if (contextToUse?.consent) {
          console.log("[Voice CRM] Stopping audio capture and uploading...");
          const transcriptionResult = await new Promise((resolve) => {
            chrome.runtime.sendMessage({ type: "VOICE_CRM_STOP_TRANSCRIPTION" }, (response) => {
              if (chrome.runtime.lastError) {
                console.error("[Voice CRM] Error stopping transcription:", chrome.runtime.lastError);
                resolve({ ok: false, error: chrome.runtime.lastError.message });
              } else {
                console.log("[Voice CRM] Transcription stopped:", response);
                resolve(response);
              }
            });
          });
          
          if (!transcriptionResult?.ok && !transcriptionResult?.skipped) {
            console.warn("[Voice CRM] Transcription upload may have failed:", transcriptionResult);
          }
          
          // Wait for transcription upload to complete
          await sleep(500);
        } else {
          console.log("[Voice CRM] No consent given, skipping transcription");
        }

        // Try to get actual call duration from Google Voice UI if available
        // Duration should be from when call was ATTENDED (answered), not from when call started
        let actualDuration = null;
        if (callStateDuration !== null && callStateDuration > 0) {
          actualDuration = callStateDuration;
          console.log("[Voice CRM] Using actual call duration from UI:", actualDuration, "seconds (from attended time)");
        } else if (window.voiceCrmActualDuration) {
          actualDuration = window.voiceCrmActualDuration;
          console.log("[Voice CRM] Using stored call duration from UI:", actualDuration, "seconds");
        }
        
        // Now end the call with accurate timestamp
        const endedAt = nowIso();
        
        // Calculate duration from when call was ATTENDED (answered), not from when call started
        let calculatedDuration = null;
        if (callAttendedAt) {
          // Duration is from attended time to end time
          const attendedTime = new Date(callAttendedAt);
          const endTime = new Date(endedAt);
          calculatedDuration = Math.floor((endTime.getTime() - attendedTime.getTime()) / 1000);
          console.log("[Voice CRM] Calculated duration from ATTENDED time:", calculatedDuration, "seconds");
        } else {
          // Fallback: use call start time if attended time not available
          const startedAt = activeCall.startedAt ? new Date(activeCall.startedAt) : null;
          if (startedAt) {
            calculatedDuration = Math.floor((new Date(endedAt).getTime() - startedAt.getTime()) / 1000);
            console.log("[Voice CRM] Calculated duration from START time (fallback):", calculatedDuration, "seconds");
          }
        }
        
        // Use actual duration from UI if available, otherwise use calculated from attended time
        const finalDuration = actualDuration || calculatedDuration;
        
        // Only store duration ONCE at the end - check flag
        if (!durationStored) {
          durationStored = true; // Set flag to prevent duplicate duration storage
          
          await apiPatch(`/api/calls/${activeCall.id}/end`, {
            endedAt,
            status: "completed",
            ...(finalDuration !== null && finalDuration >= 0 && { durationSeconds: finalDuration }), // Store duration only once
          });
          
          // Log duration for debugging
          console.log("[Voice CRM] ✅ Call ENDED automatically - record updated as completed (duration stored once).");
          console.log("[Voice CRM] Duration details:", {
            actualFromUI: actualDuration,
            calculatedFromAttended: calculatedDuration,
            final: finalDuration,
            callAttendedAt: callAttendedAt,
            startedAt: activeCall.startedAt,
            endedAt: new Date(endedAt).toISOString(),
            storedOnce: true
          });
        } else {
          console.log("[Voice CRM] ⚠️ Duration already stored, skipping duplicate update");
        }
      } catch (e) {
        console.error("[Voice CRM] Periodic check failed to end call:", e);
      } finally {
        activeCall = null;
        lastCallId = null; // Clear call ID tracking
        callAttendedAt = null; // Clear attended timestamp
        callAttendedFlag = false; // Reset attended flag
        durationStored = false; // Reset duration stored flag
        callEndedFlag = false; // Reset ended flag
      }
    }
  };

  // Start periodic check (every 500ms for faster detection and more reliable call end detection)
  periodicCheckInterval = setInterval(performPeriodicCheck, 500);
  
  // Also perform immediate check
  performPeriodicCheck();

  observer = new MutationObserver(async () => {
    const callState = isInCallUI();
    const inCall = callState.isInCall;
    const isCallAttended = callState.isCallAttended;
    const callStateDuration = callState.actualDuration;
    
    // Track when call is attended (answered) - duration starts from here
    if (isCallAttended && !callAttendedFlag && activeCall?.id) {
      callAttendedAt = nowIso();
      callAttendedFlag = true;
      console.log("[Voice CRM] ✅ Call ATTENDED at:", callAttendedAt, "- Duration tracking started");
      
      // NOW start recording - only when call is attended (answered)
      // Get context to check consent
      let contextToUse = pendingCallContext || callContext;
      if (!contextToUse) {
        try {
          const storageResponse = await new Promise((resolve) => {
            chrome.runtime.sendMessage(
              { type: "VOICE_CRM_GET_PENDING_CALL" },
              (response) => {
                if (chrome.runtime.lastError) {
                  resolve({ ok: false });
                } else {
                  resolve(response);
                }
              }
            );
          });
          if (storageResponse?.ok && storageResponse.data) {
            contextToUse = storageResponse.data;
          }
        } catch (e) {
          console.warn("[Voice CRM] Error getting context for recording:", e);
        }
      }
      
      // Start recording ONLY when call is attended (answered)
      if (contextToUse?.consent && activeCall?.id) {
        console.log("[Voice CRM] 🎙️ Starting recording NOW - call is attended (answered):", activeCall.id);
        chrome.runtime.sendMessage({
          type: "VOICE_CRM_START_TRANSCRIPTION",
          callId: activeCall.id,
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.error("[Voice CRM] Error starting transcription:", chrome.runtime.lastError);
          } else {
            console.log("[Voice CRM] ✅ Recording started successfully (call attended):", response);
          }
        });
      } else {
        console.warn("[Voice CRM] ⚠️ No consent or call ID, skipping recording");
      }
    }

    // Transition: not in call -> in call
    if (!lastInCall && inCall) {
      lastInCall = true;
      if (!activeCall) {
        try {
          // ALWAYS try to get fresh context from Chrome storage first (most reliable)
          let contextToUse = null;
          
          // Try Chrome storage first (always, even if we have cached context)
          try {
            const storageResponse = await new Promise((resolve) => {
              chrome.runtime.sendMessage(
                { type: "VOICE_CRM_GET_PENDING_CALL" },
                (response) => {
                  if (chrome.runtime.lastError) {
                    resolve({ ok: false, error: chrome.runtime.lastError.message });
                  } else {
                    resolve(response);
                  }
                }
              );
            });
            
            if (storageResponse?.ok && storageResponse.data) {
              contextToUse = storageResponse.data;
              
              // Normalize field names
              if (contextToUse.LeadId !== undefined && contextToUse.leadId === undefined) {
                contextToUse.leadId = contextToUse.LeadId;
                delete contextToUse.LeadId;
              }
              if (contextToUse.ClientLeadId !== undefined && contextToUse.clientLeadId === undefined) {
                contextToUse.clientLeadId = contextToUse.ClientLeadId;
                delete contextToUse.ClientLeadId;
              }
              
              pendingCallContext = contextToUse; // Cache it
              console.log("[Voice CRM] ✅ Got FRESH context from Chrome storage:", contextToUse);
            }
          } catch (e) {
            console.warn("[Voice CRM] Error getting from Chrome storage:", e);
          }
          
          // Fallback to cached context
          if (!contextToUse) {
            contextToUse = pendingCallContext || callContext;
            console.log("[Voice CRM] Using cached context:", contextToUse);
          }
          
          // If still no context, try localStorage
          if (!contextToUse) {
            try {
              const storageResponse = await new Promise((resolve) => {
                chrome.runtime.sendMessage(
                  { type: "VOICE_CRM_GET_PENDING_CALL" },
                  (response) => {
                    if (chrome.runtime.lastError) {
                      resolve({ ok: false, error: chrome.runtime.lastError });
                    } else {
                      resolve(response);
                    }
                  }
                );
              });
              
              if (storageResponse?.ok && storageResponse.data) {
                contextToUse = storageResponse.data;
                
                // Normalize field names
                if (contextToUse.LeadId !== undefined && contextToUse.leadId === undefined) {
                  contextToUse.leadId = contextToUse.LeadId;
                  delete contextToUse.LeadId;
                }
                if (contextToUse.ClientLeadId !== undefined && contextToUse.clientLeadId === undefined) {
                  contextToUse.clientLeadId = contextToUse.ClientLeadId;
                  delete contextToUse.ClientLeadId;
                }
                
                pendingCallContext = contextToUse; // Cache it
                console.log("[Voice CRM] Loaded context from Chrome storage in DOM observer:", contextToUse);
                console.log("[Voice CRM] Normalized context:", {
                  phoneNumber: contextToUse.phoneNumber,
                  leadId: contextToUse.leadId,
                  consent: contextToUse.consent
                });
              }
            } catch (e) {
              console.warn("[Voice CRM] Error getting from Chrome storage:", e);
            }
          }
          
          // Fallback to localStorage
          if (!contextToUse) {
            try {
              const pendingCallStr = localStorage.getItem("VOICE_CRM_PENDING_CALL");
              if (pendingCallStr) {
                contextToUse = JSON.parse(pendingCallStr);
                pendingCallContext = contextToUse; // Cache it
                console.log("[Voice CRM] Loaded context from localStorage in DOM observer:", contextToUse);
              }
            } catch (e) {
              console.warn("[Voice CRM] Error getting from localStorage:", e);
            }
          }
          
          if (!contextToUse) {
            console.warn("[Voice CRM] No call context available from any source!");
            console.log("[Voice CRM] Available sources:", {
              pendingCallContext: !!pendingCallContext,
              callContext: !!callContext,
              localStorage: !!localStorage.getItem("VOICE_CRM_PENDING_CALL")
            });
            return;
          }
          
          // Validate required fields
          if (!contextToUse || !contextToUse.phoneNumber) {
            console.error("[Voice CRM] ❌ Missing phoneNumber in context!");
            console.log("[Voice CRM] Context object:", contextToUse);
            console.log("[Voice CRM] Available context keys:", contextToUse ? Object.keys(contextToUse) : "context is null/undefined");
            console.log("[Voice CRM] ⚠️ TROUBLESHOOTING: Check Chrome storage:");
            chrome.runtime.sendMessage({ type: "VOICE_CRM_GET_PENDING_CALL" }, (r) => {
              console.log("[Voice CRM] Chrome storage check:", r);
            });
            return;
          }
          
          // Final validation - ensure we have the correct data
          if (!contextToUse.phoneNumber || contextToUse.phoneNumber === "undefined" || contextToUse.phoneNumber === "") {
            console.error("[Voice CRM] ❌ Invalid phoneNumber in context:", contextToUse.phoneNumber);
            return;
          }
          
          console.log("[Voice CRM] ✅ Call started detected! Creating call record...");
          console.log("[Voice CRM] Using context:", {
            phoneNumber: contextToUse.phoneNumber,
            leadId: contextToUse.leadId,
            consent: contextToUse.consent,
            source: contextToUse.metadata?.source || "unknown"
          });
          
          // Double-check: Log what we're about to send
          console.log("[Voice CRM] ⚠️ VERIFY: About to create call with:", {
            phoneNumber: contextToUse.phoneNumber,
            leadId: contextToUse.leadId,
            direction: contextToUse.direction || "outgoing"
          });
          
          const startedAt = nowIso();
          const callData = {
            phoneNumber: contextToUse.phoneNumber, // Use phoneNumber from context, not from UI
            direction: contextToUse.direction || "outgoing",
            consent: Boolean(contextToUse.consent),
            leadId: contextToUse.leadId ? parseInt(contextToUse.leadId) : null,
            clientLeadId: contextToUse.clientLeadId ? parseInt(contextToUse.clientLeadId) : null,
            startedAt,
            status: "in_progress",
            metadata: { 
              ...(contextToUse.metadata || {}), 
              detectedBy: "dom_observer",
              originalPhoneNumber: contextToUse.phoneNumber, // Store original for debugging
              contextSource: "chrome_storage" // Track where context came from
            },
          };
          
          console.log("[Voice CRM] Sending call data to backend:", callData);
          const resp = await apiPost("/api/calls/start", callData);
          
          activeCall = { id: resp?.data?.id, startedAt };
          durationStored = false; // Reset flag for new call
          callEndedFlag = false; // Reset flag for new call
          callAttendedAt = null; // Reset attended timestamp
          callAttendedFlag = false; // Reset attended flag
          console.log("[Voice CRM] ✅ Call record created:", activeCall);
          console.log("[Voice CRM] Call start timestamp:", startedAt, "(" + new Date(startedAt).toISOString() + ")");
          console.log("[Voice CRM] Call details:", {
            id: activeCall.id,
            phoneNumber: callData.phoneNumber,
            leadId: callData.leadId,
            status: callData.status
          });
          
          // Clear pending context and Chrome storage after successful creation
          pendingCallContext = null;
          chrome.runtime.sendMessage(
            { type: "VOICE_CRM_STORE_PENDING_CALL", payload: null },
            () => {}
          );

          // DON'T start recording yet - wait for call to be attended (answered)
          // Recording will start when call is detected as attended (duration > 0)
          console.log("[Voice CRM] ⏸️ Call detected but not attended yet - waiting for call to be answered before starting recording");
        } catch (e) {
          console.error("[Voice CRM] Failed to POST /calls/start", e);
        }
      }
    }

    // Transition: in call -> not in call
    if (lastInCall && !inCall) {
      lastInCall = false;
      if (activeCall?.id && !callEndedFlag) {
        callEndedFlag = true; // Set flag immediately to prevent duplicate updates
        try {
          console.log("[Voice CRM] Call ended detected! Ending call record:", activeCall.id);
          
          // Get fresh context to check consent
          let contextToUse = pendingCallContext || callContext;
          if (!contextToUse) {
            try {
              const storageResponse = await new Promise((resolve) => {
                chrome.runtime.sendMessage(
                  { type: "VOICE_CRM_GET_PENDING_CALL" },
                  (response) => {
                    if (chrome.runtime.lastError) {
                      resolve({ ok: false });
                    } else {
                      resolve(response);
                    }
                  }
                );
              });
              if (storageResponse?.ok && storageResponse.data) {
                contextToUse = storageResponse.data;
              }
            } catch (e) {
              console.warn("[Voice CRM] Error getting context for transcription:", e);
            }
          }
          
          // Stop transcription capture and upload BEFORE ending call
          // This ensures audio is uploaded while call record still exists
          if (contextToUse?.consent) {
            console.log("[Voice CRM] Stopping audio capture and uploading...");
            const transcriptionResult = await new Promise((resolve) => {
              chrome.runtime.sendMessage({ type: "VOICE_CRM_STOP_TRANSCRIPTION" }, (response) => {
                if (chrome.runtime.lastError) {
                  console.error("[Voice CRM] Error stopping transcription:", chrome.runtime.lastError);
                  resolve({ ok: false, error: chrome.runtime.lastError.message });
                } else {
                  console.log("[Voice CRM] Transcription stopped and uploaded:", response);
                  resolve(response);
                }
              });
            });
            
            if (!transcriptionResult?.ok && !transcriptionResult?.skipped) {
              console.warn("[Voice CRM] Transcription upload may have failed:", transcriptionResult);
            }
          } else {
            console.log("[Voice CRM] No consent given, skipping transcription");
          }

          // Wait a moment to ensure transcription upload completes
          await sleep(500);

          // Try to get actual call duration from Google Voice UI if available
          // Duration should be from when call was ATTENDED (answered), not from when call started
          let actualDuration = null;
          if (callStateDuration !== null && callStateDuration > 0) {
            actualDuration = callStateDuration;
            console.log("[Voice CRM] Using actual call duration from UI:", actualDuration, "seconds (from attended time)");
          } else if (window.voiceCrmActualDuration) {
            actualDuration = window.voiceCrmActualDuration;
            console.log("[Voice CRM] Using stored call duration from UI:", actualDuration, "seconds");
          }
          
          // Now end the call with accurate timestamp
          const endedAt = nowIso();
          
          // Calculate duration from when call was ATTENDED (answered), not from when call started
          let calculatedDuration = null;
          if (callAttendedAt) {
            // Duration is from attended time to end time
            const attendedTime = new Date(callAttendedAt);
            const endTime = new Date(endedAt);
            calculatedDuration = Math.floor((endTime.getTime() - attendedTime.getTime()) / 1000);
            console.log("[Voice CRM] Calculated duration from ATTENDED time:", calculatedDuration, "seconds");
          } else {
            // Fallback: use call start time if attended time not available
            const startedAt = activeCall.startedAt ? new Date(activeCall.startedAt) : null;
            if (startedAt) {
              calculatedDuration = Math.floor((new Date(endedAt).getTime() - startedAt.getTime()) / 1000);
              console.log("[Voice CRM] Calculated duration from START time (fallback):", calculatedDuration, "seconds");
            }
          }
          
          // Use actual duration from UI if available, otherwise use calculated from attended time
          const finalDuration = actualDuration || calculatedDuration;
          
          // Only store duration ONCE at the end - check flag
          if (!durationStored) {
            durationStored = true; // Set flag to prevent duplicate duration storage
            
            await apiPatch(`/api/calls/${activeCall.id}/end`, {
              endedAt,
              status: "completed",
              ...(finalDuration !== null && finalDuration >= 0 && { durationSeconds: finalDuration }), // Store duration only once
            });
            
            // Log duration for debugging
            console.log("[Voice CRM] ✅ Call ENDED automatically - record updated as completed (duration stored once).");
            console.log("[Voice CRM] Duration details:", {
              actualFromUI: actualDuration,
              calculatedFromAttended: calculatedDuration,
              final: finalDuration,
              callAttendedAt: callAttendedAt,
              startedAt: activeCall.startedAt,
              endedAt: new Date(endedAt).toISOString(),
              storedOnce: true
            });
          } else {
            console.log("[Voice CRM] ⚠️ Duration already stored, skipping duplicate update");
          }
        } catch (e) {
          console.error("[Voice CRM] Failed to PATCH /calls/:id/end", e);
        } finally {
          activeCall = null;
          lastCallId = null; // Clear call ID tracking
          callAttendedAt = null; // Clear attended timestamp
          callAttendedFlag = false; // Reset attended flag
          durationStored = false; // Reset duration stored flag
          callEndedFlag = false; // Reset ended flag
        }
      }
    }
  });

  observer.observe(document.documentElement, { 
    childList: true, 
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'aria-label'] // Watch for class/aria-label changes
  });
  
  // Also perform immediate check
  setTimeout(performPeriodicCheck, 500);
  
  // Cleanup function (store for later use if needed)
  return () => {
    if (periodicCheckInterval) clearInterval(periodicCheckInterval);
    if (observer) observer.disconnect();
  };
}

// Store call context for when call actually starts
let pendingCallContext = null;

// Listen for messages from chrome.runtime (from extension popup or background)
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "VOICE_CRM_DIAL") {
    const payload = msg.payload || {};
    const phoneNumber = payload.phoneNumber;
    if (!phoneNumber) return;

    // Store the call context - will be used when call actually starts
    pendingCallContext = payload;
    
    // Start observing for call lifecycle
    startObservingCallLifecycle(payload);
    
    // Try to dial the number (if on Google Voice page)
    dialNumber(phoneNumber).catch(() => {});
  }
});

// Listen for messages from window.postMessage (from frontend web page)
window.addEventListener("message", (event) => {
  // Only accept messages from same origin
  if (event.origin !== window.location.origin) return;
  
  if (event.data?.type === "VOICE_CRM_DIAL") {
    const payload = event.data.payload || {};
    pendingCallContext = payload;
    startObservingCallLifecycle(payload);
    
    // Try to dial if on Google Voice page
    if (payload.phoneNumber) {
      dialNumber(payload.phoneNumber).catch(() => {});
    }
  }
});

// Check Chrome storage for pending calls (from frontend)
async function checkChromeStorageForPendingCall() {
  try {
    // Try to get from Chrome storage (works across origins)
    const storageResponse = await new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { type: "VOICE_CRM_GET_PENDING_CALL" },
        (response) => {
          if (chrome.runtime.lastError) {
            resolve({ ok: false, error: chrome.runtime.lastError.message });
          } else {
            resolve(response);
          }
        }
      );
    });
    
      if (storageResponse?.ok && storageResponse.data) {
        const payload = storageResponse.data;
        
        // Normalize field names (fix case sensitivity issues)
        if (payload.LeadId !== undefined && payload.leadId === undefined) {
          payload.leadId = payload.LeadId;
          delete payload.LeadId;
        }
        if (payload.ClientLeadId !== undefined && payload.clientLeadId === undefined) {
          payload.clientLeadId = payload.ClientLeadId;
          delete payload.ClientLeadId;
        }
        
        console.log("[Voice CRM] ✅ Found pending call in Chrome storage:", payload);
        console.log("[Voice CRM] Context details:", {
          phoneNumber: payload.phoneNumber,
          leadId: payload.leadId,
          consent: payload.consent,
          timestamp: payload.metadata?.timestamp || payload.metadata?.storedAt
        });
        
        // Validate required fields
        if (!payload.phoneNumber) {
          console.error("[Voice CRM] ⚠️ Chrome storage has no phoneNumber!");
        }
        if (!payload.leadId && payload.LeadId) {
          console.warn("[Voice CRM] ⚠️ Found LeadId (capital L), normalizing to leadId");
          payload.leadId = payload.LeadId;
        }
        
        // Set pendingCallContext so it's available for call detection
        pendingCallContext = payload;
      
      // Start observing for call lifecycle
      startObservingCallLifecycle(payload);
      
      // Try to dial if on Google Voice page
      if (payload.phoneNumber) {
        console.log("[Voice CRM] Attempting to dial:", payload.phoneNumber);
        dialNumber(payload.phoneNumber).catch((e) => {
          console.warn("[Voice CRM] Failed to dial number:", e);
        });
      }
      
      // Don't clear from storage yet - keep it until call is actually detected
      // It will be cleared when the call is created
    } else {
      console.log("[Voice CRM] No pending call in Chrome storage");
      // Fallback to localStorage (for same-origin cases)
      checkLocalStorageForPendingCall();
    }
  } catch (e) {
    console.error("[Voice CRM] Error checking Chrome storage:", e);
    // Fallback to localStorage
    checkLocalStorageForPendingCall();
  }
}

// Fallback: Check localStorage for pending calls (from frontend) - for same-origin cases
function checkLocalStorageForPendingCall() {
  try {
    const pendingCallStr = localStorage.getItem("VOICE_CRM_PENDING_CALL");
    if (pendingCallStr) {
      const payload = JSON.parse(pendingCallStr);
      // Only use if it's recent (within last 5 minutes)
      const timestamp = payload.metadata?.timestamp || 0;
      const age = Date.now() - timestamp;
      
      if (age < 5 * 60 * 1000) {
        console.log("[Voice CRM] Found pending call in localStorage (fallback):", payload);
        pendingCallContext = payload;
        startObservingCallLifecycle(payload);
        
        // Clear from localStorage after using it
        localStorage.removeItem("VOICE_CRM_PENDING_CALL");
        
        // Try to dial if on Google Voice page
        if (payload.phoneNumber) {
          console.log("[Voice CRM] Attempting to dial:", payload.phoneNumber);
          dialNumber(payload.phoneNumber).catch((e) => {
            console.warn("[Voice CRM] Failed to dial number:", e);
          });
        }
      } else {
        // Too old, remove it
        console.log("[Voice CRM] Pending call too old, removing:", age / 1000, "seconds");
        localStorage.removeItem("VOICE_CRM_PENDING_CALL");
      }
    }
  } catch (e) {
    console.error("[Voice CRM] Error checking localStorage:", e);
  }
}

// Initialize on page load
console.log("[Voice CRM] Content script loaded on:", window.location.href);

// Check for pending calls when page loads
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    console.log("[Voice CRM] DOM loaded, checking for pending calls");
    checkChromeStorageForPendingCall();
  });
} else {
  console.log("[Voice CRM] DOM already loaded, checking for pending calls");
  checkChromeStorageForPendingCall();
}

// Also check periodically (in case page was already loaded)
setInterval(checkChromeStorageForPendingCall, 2000);

// Start observing immediately (in case call is already in progress)
if (window.location.href.includes("voice.google.com")) {
  console.log("[Voice CRM] On Google Voice page, starting observer");
  startObservingCallLifecycle({});
  
  // Also check immediately if call is already in progress
  setTimeout(() => {
    const callState = isInCallUI();
    if (callState.isInCall) {
      console.log("[Voice CRM] Call already in progress when page loaded!");
      checkLocalStorageForPendingCall();
    }
  }, 1000);
}

// Expose manual trigger for debugging (call from console: window.voiceCrmManualDetect())
window.voiceCrmManualDetect = async function() {
  console.log("[Voice CRM] ===== MANUAL DETECTION TRIGGERED =====");
  
  const callState = isInCallUI();
  const inCall = callState.isInCall;
  const isCallAttended = callState.isCallAttended;
  console.log("[Voice CRM] isInCallUI() returned:", callState);
  console.log("[Voice CRM] activeCall:", activeCall);
  console.log("[Voice CRM] pendingCallContext:", pendingCallContext);
  
  // Track when call is attended (answered) - duration starts from here
  if (isCallAttended && !callAttendedFlag && activeCall?.id) {
    callAttendedAt = nowIso();
    callAttendedFlag = true;
    console.log("[Voice CRM] ✅ Call ATTENDED at:", callAttendedAt, "- Duration tracking started");
  }
  
  // Get context from Chrome storage (async)
  let contextToUse = pendingCallContext;
  
  if (!contextToUse) {
    // Try Chrome storage first (cross-origin compatible)
    try {
      const storageResponse = await new Promise((resolve) => {
        chrome.runtime.sendMessage(
          { type: "VOICE_CRM_GET_PENDING_CALL" },
          (response) => {
            if (chrome.runtime.lastError) {
              resolve({ ok: false, error: chrome.runtime.lastError });
            } else {
              resolve(response);
            }
          }
        );
      });
      
      if (storageResponse?.ok && storageResponse.data) {
        contextToUse = storageResponse.data;
        
        // Normalize field names
        if (contextToUse.LeadId !== undefined && contextToUse.leadId === undefined) {
          contextToUse.leadId = contextToUse.LeadId;
          delete contextToUse.LeadId;
        }
        if (contextToUse.ClientLeadId !== undefined && contextToUse.clientLeadId === undefined) {
          contextToUse.clientLeadId = contextToUse.ClientLeadId;
          delete contextToUse.ClientLeadId;
        }
        
        console.log("[Voice CRM] Loaded context from Chrome storage:", contextToUse);
      }
    } catch (e) {
      console.warn("[Voice CRM] Error getting from Chrome storage:", e);
    }
  }
  
  // Fallback to localStorage
  if (!contextToUse) {
    try {
      const pendingCallStr = localStorage.getItem("VOICE_CRM_PENDING_CALL");
      console.log("[Voice CRM] localStorage pending call:", pendingCallStr);
      if (pendingCallStr) {
        contextToUse = JSON.parse(pendingCallStr);
        
        // Normalize field names
        if (contextToUse.LeadId !== undefined && contextToUse.leadId === undefined) {
          contextToUse.leadId = contextToUse.LeadId;
          delete contextToUse.LeadId;
        }
        if (contextToUse.ClientLeadId !== undefined && contextToUse.clientLeadId === undefined) {
          contextToUse.clientLeadId = contextToUse.ClientLeadId;
          delete contextToUse.ClientLeadId;
        }
        
        console.log("[Voice CRM] Loaded context from localStorage:", contextToUse);
      }
    } catch (e) {
      console.error("[Voice CRM] Failed to parse localStorage:", e);
    }
  }
  
  if (inCall && !activeCall) {
    if (contextToUse && (contextToUse.phoneNumber || contextToUse.leadId)) {
      // Validate required fields
      if (!contextToUse.phoneNumber) {
        console.error("[Voice CRM] Missing phoneNumber in context!");
        return { 
          success: false, 
          error: "Missing phoneNumber in call context",
          suggestion: "Go back to CRM, click 'Call Opt-in' again, then come back"
        };
      }
      
      console.log("[Voice CRM] Attempting to create call record manually...");
      console.log("[Voice CRM] Using context:", {
        phoneNumber: contextToUse.phoneNumber,
        leadId: contextToUse.leadId,
        consent: contextToUse.consent
      });
      
      try {
        const startedAt = nowIso();
        const callData = {
          phoneNumber: contextToUse.phoneNumber, // Use phoneNumber from context
          direction: contextToUse.direction || "outgoing",
          consent: Boolean(contextToUse.consent),
          leadId: contextToUse.leadId ? parseInt(contextToUse.leadId) : null,
          clientLeadId: contextToUse.clientLeadId ? parseInt(contextToUse.clientLeadId) : null,
          startedAt,
          status: "in_progress",
          metadata: { 
            ...(contextToUse.metadata || {}), 
            detectedBy: "manual_trigger",
            originalPhoneNumber: contextToUse.phoneNumber
          },
        };
        
        console.log("[Voice CRM] Sending call data to backend:", callData);
        const resp = await apiPost("/api/calls/start", callData);
        activeCall = { id: resp?.data?.id, startedAt };
        durationStored = false; // Reset flag for new call
        callEndedFlag = false; // Reset flag for new call
        callAttendedAt = null; // Reset attended timestamp
        callAttendedFlag = false; // Reset attended flag
        console.log("[Voice CRM] ✅ Call record created manually:", activeCall);
        
        // Clear localStorage after successful creation
        if (pendingCallStr) {
          localStorage.removeItem("VOICE_CRM_PENDING_CALL");
        }
        
        // DON'T start recording yet - wait for call to be attended (answered)
        // Recording will start when call is detected as attended (duration > 0)
        console.log("[Voice CRM] ⏸️ Call detected but not attended yet - waiting for call to be answered before starting recording");
        return { success: true, callId: activeCall.id, message: "Call record created successfully! Recording will start when call is answered." };
      } catch (e) {
        console.error("[Voice CRM] ❌ Manual detection failed:", e);
        return { success: false, error: e.message, details: e };
      }
    } else {
      console.warn("[Voice CRM] ⚠️ No call context available");
      console.log("[Voice CRM] Available context:", contextToUse);
      return { 
        success: false, 
        error: "No call context (phoneNumber/leadId) available",
        suggestion: "Go back to CRM, click 'Call Opt-in' again, then come back and run this function"
      };
    }
  } else if (activeCall) {
    console.log("[Voice CRM] ℹ️ Call already active:", activeCall);
    return { success: true, message: "Call already active", callId: activeCall.id };
  } else {
    console.log("[Voice CRM] ❌ Not in call state");
    console.log("[Voice CRM] Detection details:", {
      url: window.location.href,
      buttons: Array.from(document.querySelectorAll("button")).slice(0, 5).map(b => ({
        label: b.getAttribute("aria-label"),
        text: b.textContent?.substring(0, 20)
      }))
    });
    return { 
      success: false, 
      error: "Not in call state",
      suggestion: "Make sure you're in an active call in Google Voice, then run this function again"
    };
  }
};

console.log("[Voice CRM] Manual detection function available: window.voiceCrmManualDetect()");



