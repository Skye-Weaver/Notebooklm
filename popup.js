(() => {
  const STORAGE_KEY = "notebooklmSearches";

  const emptyState = document.getElementById("empty-state");
  const list = document.getElementById("search-list");
  const clearButton = document.getElementById("clear-history");

  const formatMarkdown = (links) =>
    links.map((link) => `[${link.title}](${link.url})`).join("\n");

  const formatTsv = (links) =>
    links
      .map((link) =>
        [link.title, link.url, link.description || ""].join("\t")
      )
      .join("\n");

  const formatUrlList = (links) => links.map((link) => link.url).join("\n");

  const copyToClipboard = async (text) => {
    await navigator.clipboard.writeText(text);
  };

  const renderList = (searches) => {
    list.innerHTML = "";
    if (!searches.length) {
      emptyState.style.display = "block";
      return;
    }
    emptyState.style.display = "none";

    for (const search of searches) {
      const card = document.createElement("div");
      card.className = "search-card";

      const title = document.createElement("h2");
      title.textContent = search.query;
      card.appendChild(title);

      const meta = document.createElement("div");
      meta.className = "search-meta";
      meta.textContent = `Ссылок: ${search.links.length}`;
      card.appendChild(meta);

      const buttons = document.createElement("div");
      buttons.className = "copy-buttons";

      const markdownButton = document.createElement("button");
      markdownButton.type = "button";
      markdownButton.textContent = "Markdown";
      markdownButton.addEventListener("click", () => {
        copyToClipboard(formatMarkdown(search.links));
      });

      const tsvButton = document.createElement("button");
      tsvButton.type = "button";
      tsvButton.textContent = "Excel/TSV";
      tsvButton.addEventListener("click", () => {
        copyToClipboard(formatTsv(search.links));
      });

      const urlButton = document.createElement("button");
      urlButton.type = "button";
      urlButton.textContent = "URL List";
      urlButton.addEventListener("click", () => {
        copyToClipboard(formatUrlList(search.links));
      });

      buttons.appendChild(markdownButton);
      buttons.appendChild(tsvButton);
      buttons.appendChild(urlButton);
      card.appendChild(buttons);

      list.appendChild(card);
    }
  };

  const loadSearches = async () => {
    const stored = await chrome.storage.local.get(STORAGE_KEY);
    const searchesMap = stored[STORAGE_KEY] || {};
    const searches = Object.values(searchesMap).sort(
      (a, b) => b.updatedAt - a.updatedAt
    );
    renderList(searches);
  };

  clearButton.addEventListener("click", async () => {
    await chrome.storage.local.remove(STORAGE_KEY);
    renderList([]);
  });

  loadSearches();
})();
