(function () {
  const STORAGE_KEY = "searches";
  const TOAST_ID = "notebooklm-source-saver-toast";

  function ensureToast() {
    let toast = document.getElementById(TOAST_ID);
    if (!toast) {
      toast = document.createElement("div");
      toast.id = TOAST_ID;
      toast.style.position = "fixed";
      toast.style.left = "16px";
      toast.style.bottom = "16px";
      toast.style.padding = "10px 12px";
      toast.style.background = "rgba(0, 0, 0, 0.8)";
      toast.style.color = "#fff";
      toast.style.borderRadius = "6px";
      toast.style.fontSize = "13px";
      toast.style.fontFamily = "system-ui, -apple-system, sans-serif";
      toast.style.zIndex = "999999";
      toast.style.opacity = "0";
      toast.style.transition = "opacity 150ms ease-in-out";
      document.body.appendChild(toast);
    }
    return toast;
  }

  function showToast(message) {
    const toast = ensureToast();
    toast.textContent = message;
    toast.style.opacity = "1";
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => {
      toast.style.opacity = "0";
    }, 2500);
  }

  async function updateStorage(blocks) {
    if (!blocks.length) {
      return;
    }
    const stored = await chrome.storage.local.get(STORAGE_KEY);
    const current = stored[STORAGE_KEY] || {};

    for (const block of blocks) {
      const existing = current[block.query];
      const links = mergeLinks(existing?.links || [], block.links || []);
      current[block.query] = {
        query: block.query,
        links,
        updatedAt: Date.now()
      };
    }

    await chrome.storage.local.set({ [STORAGE_KEY]: current });
    showToast(window.NotebookLmParser.formatToastMessage(Object.keys(current).length));
  }

  function mergeLinks(existing, incoming) {
    const byUrl = new Map();
    for (const link of [...existing, ...incoming]) {
      if (!link.url) {
        continue;
      }
      if (!byUrl.has(link.url)) {
        byUrl.set(link.url, link);
      }
    }
    return Array.from(byUrl.values());
  }

  function handleRawResponse(rawText) {
    const parsed = window.NotebookLmParser.parseNotebookResponse(rawText);
    if (parsed.length) {
      updateStorage(parsed).catch(() => {
        // ignore storage errors
      });
    }
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window) {
      return;
    }
    const data = event.data;
    if (!data || data.source !== "NotebookLmSourceSaver" || data.type !== "raw-response") {
      return;
    }
    handleRawResponse(data.payload || "");
  });
})();
