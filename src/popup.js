const STORAGE_KEY = "searches";
const TAB_KEY = "active-tab";
const DEFAULT_TAB = "notebooklm";
const statusEl = document.getElementById("status");
const tabButtons = document.querySelectorAll(".tab-button");

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function formatMarkdown(links) {
  return links.map((link) => `- [${link.title || link.url}](${link.url})`).join("\n");
}

function formatTsv(links) {
  return links
    .map((link) => `${link.title || ""}\t${link.url}\t${link.description || ""}`)
    .join("\n");
}

function formatUrlList(links) {
  return links.map((link) => link.url).join("\n");
}

function setStatus(message, { isError = false } = {}) {
  if (!statusEl) {
    return;
  }
  statusEl.textContent = message;
  statusEl.classList.toggle("error", isError);
}

function getActiveTab() {
  return localStorage.getItem(TAB_KEY) || DEFAULT_TAB;
}

function setActiveTab(tabName) {
  localStorage.setItem(TAB_KEY, tabName);
  tabButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === tabName);
  });
  setStatus("");
}

function createCard(search, view) {
  const card = document.createElement("div");
  card.className = "card";

  const actions = view === "perplexity" ? createPerplexityActions(search) : createNotebookActions(search);

  card.innerHTML = `
    <h2>${escapeHtml(search.query)}</h2>
    <p>Ссылок: ${search.links.length}</p>
    <div class="actions"></div>
  `;

  const actionContainer = card.querySelector(".actions");
  actions.forEach((action) => actionContainer.appendChild(action));

  return card;
}

function createNotebookActions(search) {
  const actions = [];
  const formats = [
    { label: "Markdown", format: "markdown", className: "copy" },
    { label: "Excel/TSV", format: "tsv", className: "copy" },
    { label: "URL list", format: "urls", className: "copy" }
  ];

  formats.forEach(({ label, format, className }) => {
    const button = document.createElement("button");
    button.className = className;
    button.dataset.format = format;
    button.textContent = label;
    button.addEventListener("click", async () => {
      const text =
        format === "markdown"
          ? formatMarkdown(search.links)
          : format === "tsv"
            ? formatTsv(search.links)
            : formatUrlList(search.links);
      await navigator.clipboard.writeText(text);
      button.textContent = "Скопировано";
      setTimeout(() => {
        button.textContent = label;
      }, 1200);
    });
    actions.push(button);
  });

  actions.push(createDeleteButton(search));
  return actions;
}

function createPerplexityActions(search) {
  const actions = [];
  const addButton = document.createElement("button");
  addButton.className = "perplexity";
  addButton.textContent = "Добавить в Perplexity";
  addButton.addEventListener("click", () => {
    handleAddToPerplexity(search, addButton).catch(() => undefined);
  });
  actions.push(addButton, createDeleteButton(search));
  return actions;
}

function createDeleteButton(search) {
  const button = document.createElement("button");
  button.className = "danger";
  button.textContent = "Удалить";
  button.addEventListener("click", async () => {
    await deleteSearch(search.query);
  });
  return button;
}

async function deleteSearch(query) {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const current = stored[STORAGE_KEY] || {};
  if (current[query]) {
    delete current[query];
    await chrome.storage.local.set({ [STORAGE_KEY]: current });
    setStatus("История удалена.");
    await render();
  }
}

async function render() {
  const container = document.getElementById("search-list");
  if (!container) {
    return;
  }
  container.innerHTML = "";
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const searches = Object.values(stored[STORAGE_KEY] || {});
  searches.sort((a, b) => b.updatedAt - a.updatedAt);

  if (!searches.length) {
    container.innerHTML = '<p class="empty">История пока пуста.</p>';
    return;
  }

  const activeTab = getActiveTab();
  for (const search of searches) {
    container.appendChild(createCard(search, activeTab));
  }
}

async function clearHistory() {
  await chrome.storage.local.set({ [STORAGE_KEY]: {} });
  await render();
  setStatus("История очищена.");
}

function getActiveTabInfo() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      resolve(tabs[0]);
    });
  });
}

function sendMessageToTab(tabId, message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      resolve(response);
    });
  });
}

async function handleAddToPerplexity(search, button) {
  setStatus("");
  const tab = await getActiveTabInfo();
  if (!tab || !tab.id || !tab.url) {
    setStatus("Не удалось определить активную вкладку.", { isError: true });
    return;
  }

  if (!tab.url.includes("https://www.perplexity.ai/spaces/")) {
    setStatus("Откройте нужное пространство Perplexity и повторите попытку.", { isError: true });
    return;
  }

  button.disabled = true;
  button.textContent = "Импорт...";
  const links = search.links.map((link) => link.url).filter(Boolean);

  try {
    const response = await sendMessageToTab(tab.id, {
      type: "perplexity-add-links",
      payload: {
        links,
        query: search.query
      }
    });
    if (response?.status === "started") {
      setStatus(`Запущен импорт: ${links.length} ссылок.`);
    } else if (response?.status === "busy") {
      setStatus("Импорт уже выполняется в этой вкладке.", { isError: true });
    } else {
      setStatus("Не удалось запустить импорт.", { isError: true });
    }
  } catch (error) {
    setStatus("Не удалось отправить данные в Perplexity.", { isError: true });
  } finally {
    button.disabled = false;
    button.textContent = "Добавить в Perplexity";
  }
}

function updateProgress(message) {
  if (!message) {
    return;
  }
  const text = message.error
    ? `Ошибка импорта: ${message.error}`
    : `Импорт: ${message.completed}/${message.total}. Добавлено: ${message.added}. Пропущено: ${message.skipped}. Ошибки: ${message.failed}.`;
  setStatus(text, { isError: Boolean(message.error) });
}

document.getElementById("clear-history").addEventListener("click", clearHistory);

tabButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setActiveTab(button.dataset.tab);
    render();
  });
});

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "perplexity-progress") {
    updateProgress(message.payload);
  }
});

setActiveTab(getActiveTab());
render();
