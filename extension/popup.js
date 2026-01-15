const els = {
  backendBaseUrl: document.getElementById("backendBaseUrl"),
  jwt: document.getElementById("jwt"),
  consent: document.getElementById("consent"),
  phoneNumber: document.getElementById("phoneNumber"),
  leadId: document.getElementById("leadId"),
  clientLeadId: document.getElementById("clientLeadId"),
  saveConfig: document.getElementById("saveConfig"),
  start: document.getElementById("start"),
  status: document.getElementById("status"),
};

function setStatus(msg) {
  els.status.textContent = msg;
}

async function loadConfig() {
  const cfg = await chrome.storage.local.get(["backendBaseUrl", "jwt", "consent"]);
  if (cfg.backendBaseUrl) els.backendBaseUrl.value = cfg.backendBaseUrl;
  if (cfg.jwt) els.jwt.value = cfg.jwt;
  if (typeof cfg.consent === "boolean") els.consent.checked = cfg.consent;
}

async function saveConfig() {
  const config = {
    backendBaseUrl: (els.backendBaseUrl.value || "").trim(),
    jwt: (els.jwt.value || "").trim(),
    consent: Boolean(els.consent.checked),
  };
  await chrome.storage.local.set(config);
  console.log("[Voice CRM Popup] Config saved:", { ...config, jwt: config.jwt ? "***" : "" });
  setStatus("✅ Config saved!");
  setTimeout(() => setStatus(""), 2000);
}

// Save config button
els.saveConfig.addEventListener("click", async () => {
  try {
    setStatus("Saving config...");
    await saveConfig();
  } catch (e) {
    setStatus(`Error: ${e?.message || String(e)}`);
  }
});

// Auto-save config when fields change
els.backendBaseUrl.addEventListener("blur", saveConfig);
els.jwt.addEventListener("blur", saveConfig);
els.consent.addEventListener("change", saveConfig);

els.start.addEventListener("click", async () => {
  try {
    setStatus("Saving config...");
    await saveConfig();

    const phoneNumber = (els.phoneNumber.value || "").trim();
    if (!phoneNumber) return setStatus("Phone number is required.");

    const payload = {
      phoneNumber,
      direction: "outgoing",
      leadId: els.leadId.value ? Number(els.leadId.value) : undefined,
      clientLeadId: els.clientLeadId.value ? Number(els.clientLeadId.value) : undefined,
      consent: Boolean(els.consent.checked),
      metadata: { source: "extension_popup" },
    };

    setStatus("Opening Google Voice...");
    const tab = await chrome.tabs.create({ url: "https://voice.google.com/u/0/calls", active: true });

    // After the tab loads, tell the content script to dial.
    const tabId = tab.id;
    if (!tabId) return setStatus("Failed to create tab.");

    // Give the page a moment; content script also retries.
    setTimeout(() => {
      chrome.tabs.sendMessage(tabId, { type: "VOICE_CRM_DIAL", payload });
      setStatus("Sent dial command. Watch the Voice tab.");
    }, 1500);
  } catch (e) {
    setStatus(`Error: ${e?.message || String(e)}`);
  }
});

loadConfig().catch(() => {});

