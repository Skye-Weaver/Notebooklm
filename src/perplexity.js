(function () {
  const ADD_LINK_BUTTON_TEXT = "Добавить ссылку";
  const INPUT_PLACEHOLDER_SNIPPET = "Добавьте ваш домен";
  const LINK_ROW_SELECTOR = "table a[href]";
  const DEFAULT_TIMEOUT = 5000;
  const MIN_DELAY_BETWEEN = 120;

  let isRunning = false;

  function normalizeUrl(url) {
    if (!url) {
      return "";
    }
    return url.trim().replace(/\/$/, "");
  }

  function findInput() {
    return document.querySelector(`input[placeholder*="${INPUT_PLACEHOLDER_SNIPPET}"]`);
  }

  function findAddButton() {
    const buttons = Array.from(document.querySelectorAll("button"));
    return buttons.find((button) => button.textContent?.includes(ADD_LINK_BUTTON_TEXT));
  }

  function getExistingLinks() {
    return new Set(
      Array.from(document.querySelectorAll(LINK_ROW_SELECTOR))
        .map((anchor) => normalizeUrl(anchor.getAttribute("href")))
        .filter(Boolean)
    );
  }

  function waitForCondition(condition, timeout = DEFAULT_TIMEOUT) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const interval = setInterval(() => {
        if (condition()) {
          clearInterval(interval);
          resolve(true);
        } else if (Date.now() - start > timeout) {
          clearInterval(interval);
          reject(new Error("timeout"));
        }
      }, 120);
    });
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function addSingleLink(url, existingLinks) {
    const input = findInput();
    const button = findAddButton();
    if (!input || !button) {
      throw new Error("Не найдено поле или кнопка добавления.");
    }

    const normalized = normalizeUrl(url);
    if (existingLinks.has(normalized)) {
      return { status: "skipped" };
    }

    const initialCount = existingLinks.size;

    input.focus();
    input.value = url;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    button.click();

    try {
      await waitForCondition(() => {
        const currentLinks = getExistingLinks();
        return currentLinks.size > initialCount || currentLinks.has(normalized);
      });
    } catch (error) {
      const currentLinks = getExistingLinks();
      if (currentLinks.has(normalized)) {
        existingLinks.add(normalized);
        return { status: "added" };
      }
      return { status: "failed" };
    }

    existingLinks.add(normalized);
    return { status: "added" };
  }

  async function addLinksToSpace(rawLinks) {
    if (isRunning) {
      return { status: "busy" };
    }

    isRunning = true;
    const existingLinks = getExistingLinks();
    const uniqueLinks = Array.from(
      new Set(rawLinks.map((link) => normalizeUrl(link)).filter(Boolean))
    ).filter((link) => link.length > 0);

    let added = 0;
    let skipped = 0;
    let failed = 0;

    for (let index = 0; index < uniqueLinks.length; index += 1) {
      const link = uniqueLinks[index];
      try {
        const result = await addSingleLink(link, existingLinks);
        if (result.status === "added") {
          added += 1;
        } else if (result.status === "skipped") {
          skipped += 1;
        } else {
          failed += 1;
        }
      } catch (error) {
        failed += 1;
      }

      chrome.runtime.sendMessage({
        type: "perplexity-progress",
        payload: {
          completed: index + 1,
          total: uniqueLinks.length,
          added,
          skipped,
          failed
        }
      });

      await sleep(MIN_DELAY_BETWEEN);
    }

    isRunning = false;
    return { status: "done", added, skipped, failed };
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type !== "perplexity-add-links") {
      return;
    }
    const links = message.payload?.links || [];
    if (isRunning) {
      sendResponse({ status: "busy" });
      return;
    }
    addLinksToSpace(links).catch((error) => {
      chrome.runtime.sendMessage({
        type: "perplexity-progress",
        payload: {
          completed: 0,
          total: links.length,
          added: 0,
          skipped: 0,
          failed: links.length,
          error: error?.message || "Неизвестная ошибка"
        }
      });
    });
    sendResponse({ status: "started" });
    return true;
  });
})();
