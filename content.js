(() => {
  const TOAST_ID = "notebooklm-source-saver-toast";
  const STORAGE_KEY = "notebooklmSearches";

  const showToast = (message) => {
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
      toast.style.fontSize = "12px";
      toast.style.borderRadius = "8px";
      toast.style.zIndex = "999999";
      toast.style.fontFamily =
        "system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
      toast.style.transition = "opacity 0.2s ease";
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.opacity = "1";
    setTimeout(() => {
      toast.style.opacity = "0";
    }, 2500);
  };

  const mergeLinks = (existingLinks, newLinks) => {
    const merged = new Map();
    for (const link of existingLinks) {
      merged.set(link.url, link);
    }
    for (const link of newLinks) {
      merged.set(link.url, link);
    }
    return Array.from(merged.values());
  };

  const saveBlocks = async (blocks) => {
    if (!blocks.length) {
      return;
    }
    const stored = await chrome.storage.local.get(STORAGE_KEY);
    const existing = stored[STORAGE_KEY] || {};
    const now = Date.now();

    for (const block of blocks) {
      const previous = existing[block.query];
      existing[block.query] = {
        query: block.query,
        links: previous ? mergeLinks(previous.links || [], block.links) : block.links,
        updatedAt: now
      };
    }

    await chrome.storage.local.set({ [STORAGE_KEY]: existing });
    showToast(`✅ Найдено поисков: ${blocks.length}`);
  };

  const handleBatchExecute = (event) => {
    const { responseText } = event.detail || {};
    if (!responseText || !window.NotebookLMParser) {
      return;
    }
    const blocks = window.NotebookLMParser.parseBatchexecuteResponse(responseText);
    saveBlocks(blocks);
  };

  window.addEventListener("NotebookLMBatchExecute", handleBatchExecute);
})();
