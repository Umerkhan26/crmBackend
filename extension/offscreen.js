let recorder = null;
let recordedChunks = [];
let current = null; // { callId, mimeType }

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function getConfig() {
  const { backendBaseUrl, jwt } = await chrome.storage.local.get(["backendBaseUrl", "jwt"]);
  return {
    backendBaseUrl: (backendBaseUrl || "").replace(/\/+$/, ""),
    jwt: jwt || "",
  };
}

async function uploadAndSaveTranscript({ callId, blob }) {
  console.log("[Voice CRM Offscreen] Uploading audio for transcription. Call ID:", callId, "Blob size:", blob.size);
  
  const cfg = await getConfig();
  if (!cfg.backendBaseUrl) throw new Error("Missing backendBaseUrl in extension config.");
  if (!cfg.jwt) throw new Error("Missing JWT in extension config.");

  const fd = new FormData();
  fd.append("consent", "true");
  fd.append("audio", blob, "call.webm");

  console.log("[Voice CRM Offscreen] Uploading to:", `${cfg.backendBaseUrl}/api/calls/${callId}/transcribe`);

  const resp = await fetch(`${cfg.backendBaseUrl}/api/calls/${callId}/transcribe`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.jwt}`,
    },
    body: fd,
  });

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    console.error("[Voice CRM Offscreen] Transcription failed:", data);
    throw new Error(data?.message || `Transcribe failed (HTTP ${resp.status})`);
  }

  console.log("[Voice CRM Offscreen] Transcription successful:", data);
  return data;
}

async function startRecording(streamId, { callId }) {
  console.log("[Voice CRM Offscreen] Starting recording for call:", callId, "streamId:", streamId);
  
  try {
    // Use getUserMedia with the tab stream id.
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: "tab",
          chromeMediaSourceId: streamId,
        },
      },
      video: false,
    });

    console.log("[Voice CRM Offscreen] Audio stream obtained:", stream);

    recordedChunks = [];
    current = { callId, mimeType: "audio/webm;codecs=opus" };

    recorder = new MediaRecorder(stream, { mimeType: current.mimeType });
    
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        recordedChunks.push(e.data);
        console.log("[Voice CRM Offscreen] Audio chunk received:", e.data.size, "bytes, total chunks:", recordedChunks.length);
      }
    };
    
    recorder.onerror = (e) => {
      console.error("[Voice CRM Offscreen] MediaRecorder error:", e);
    };

    recorder.start(1000); // chunk every 1s (kept in memory; uploaded at end in MVP)
    console.log("[Voice CRM Offscreen] MediaRecorder started");
  } catch (error) {
    console.error("[Voice CRM Offscreen] Failed to start recording:", error);
    throw error;
  }
}

async function stopRecording() {
  if (!recorder || !current) {
    console.log("[Voice CRM Offscreen] No active recording to stop");
    return null;
  }

  console.log("[Voice CRM Offscreen] Stopping recording for call:", current.callId);
  console.log("[Voice CRM Offscreen] Total chunks recorded:", recordedChunks.length);

  const localRecorder = recorder;
  recorder = null;

  await new Promise((resolve) => {
    localRecorder.onstop = resolve;
    localRecorder.stop();
  });

  // Give last dataavailable a beat
  await sleep(200);

  const blob = new Blob(recordedChunks, { type: current.mimeType });
  const callId = current.callId;
  const blobSize = blob.size;
  console.log("[Voice CRM Offscreen] Recording stopped. Blob size:", blobSize, "bytes");
  
  // Validate blob size - if too small, might not have captured audio
  if (blobSize < 1000) {
    console.warn("[Voice CRM Offscreen] ⚠️ Audio blob is very small (", blobSize, "bytes). May not have captured audio properly.");
  }
  
  current = null;
  recordedChunks = [];

  return { callId, blob };
}

console.log("[Voice CRM Offscreen] Offscreen document loaded");

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  console.log("[Voice CRM Offscreen] Message received:", msg.type);
  
  if (msg?.type === "OFFSCREEN_START") {
    (async () => {
      try {
        await startRecording(msg.streamId, { callId: msg.callId });
        sendResponse({ ok: true });
      } catch (e) {
        console.error("[Voice CRM Offscreen] Start recording error:", e);
        sendResponse({ ok: false, error: e?.message || String(e) });
      }
    })();
    return true;
  }

  if (msg?.type === "OFFSCREEN_STOP") {
    (async () => {
      try {
        const result = await stopRecording();
        if (!result) {
          console.log("[Voice CRM Offscreen] No recording to stop");
          sendResponse({ ok: true, skipped: true });
          return;
        }
        if (result.blob.size < 1000) {
          console.warn("[Voice CRM Offscreen] ⚠️ Audio blob too small (", result.blob.size, "bytes). Skipping transcription.");
          sendResponse({ ok: true, skipped: true, reason: "audio_too_small" });
          return;
        }
        
        console.log("[Voice CRM Offscreen] Uploading audio for transcription...");
        console.log("[Voice CRM Offscreen] Audio details:", {
          callId: result.callId,
          blobSize: result.blob.size,
          blobType: result.blob.type
        });
        
        const data = await uploadAndSaveTranscript({ callId: result.callId, blob: result.blob });
        console.log("[Voice CRM Offscreen] ✅ Transcription completed and saved:", data);
        sendResponse({ ok: true, data });
      } catch (e) {
        console.error("[Voice CRM Offscreen] Stop/upload error:", e);
        sendResponse({ ok: false, error: e?.message || String(e) });
      }
    })();
    return true;
  }
});

