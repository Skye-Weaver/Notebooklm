const STORAGE_KEY = "searches";

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

function createCard(search) {
  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `
    <h2>${escapeHtml(search.query)}</h2>
    <p>Ссылок: ${search.links.length}</p>
    <div class="actions">
      <button class="copy" data-format="markdown">Markdown</button>
      <button class="copy" data-format="tsv">Excel/TSV</button>
      <button class="copy" data-format="urls">URL list</button>
    </div>
  `;

  card.querySelectorAll("button.copy").forEach((button) => {
    button.addEventListener("click", async () => {
      const format = button.dataset.format;
      let text = "";
      if (format === "markdown") {
        text = formatMarkdown(search.links);
      } else if (format === "tsv") {
        text = formatTsv(search.links);
      } else {
        text = formatUrlList(search.links);
      }
      await navigator.clipboard.writeText(text);
      button.textContent = "Скопировано";
      setTimeout(() => {
        button.textContent =
          format === "markdown" ? "Markdown" : format === "tsv" ? "Excel/TSV" : "URL list";
      }, 1200);
    });
  });

  return card;
}

async function render() {
  const container = document.getElementById("search-list");
  const empty = container.querySelector(".empty");
  if (empty) {
    empty.remove();
  }
  container.innerHTML = "";
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const searches = Object.values(stored[STORAGE_KEY] || {});
  searches.sort((a, b) => b.updatedAt - a.updatedAt);

  if (!searches.length) {
    container.innerHTML = '<p class="empty">История пока пуста.</p>';
    return;
  }

  for (const search of searches) {
    container.appendChild(createCard(search));
  }
}

async function clearHistory() {
  await chrome.storage.local.set({ [STORAGE_KEY]: {} });
  await render();
}

document.getElementById("clear-history").addEventListener("click", clearHistory);
render();
