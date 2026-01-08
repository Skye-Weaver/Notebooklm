(() => {
  const BLACKLISTED_QUERIES = new Set([
    "Подробный анализ",
    "Краткий пересказ",
    "Рецензия",
    "Дебаты",
    "Обучающее видео",
    "Слайды докладчика",
    "Вопросы",
    "Оглавление",
    "Audio Overview"
  ]);

  const XSSI_PREFIX = ")]}\'";

  const isPlainObject = (value) =>
    value !== null && typeof value === "object" && !Array.isArray(value);

  const stripXssiPrefix = (text) => {
    if (!text) {
      return "";
    }
    const trimmed = text.trimStart();
    if (trimmed.startsWith(XSSI_PREFIX)) {
      const withoutPrefix = trimmed.slice(XSSI_PREFIX.length);
      return withoutPrefix.replace(/^\n+/, "");
    }
    return trimmed;
  };

  const extractJsonPayload = (text) => {
    const cleaned = stripXssiPrefix(text);
    const start = cleaned.indexOf("[");
    const end = cleaned.lastIndexOf("]");
    if (start === -1 || end === -1 || end <= start) {
      return null;
    }
    return cleaned.slice(start, end + 1);
  };

  const isQuerySignature = (value) => {
    if (!Array.isArray(value) || value.length < 2) {
      return null;
    }
    const [query, marker] = value;
    if (typeof query === "string" && typeof marker === "number" && marker === 1) {
      return query.trim();
    }
    return null;
  };

  const isLinkArray = (value) => {
    if (!Array.isArray(value) || value.length < 2) {
      return false;
    }
    const [url, title] = value;
    return (
      typeof url === "string" &&
      /^https?:\/\//.test(url) &&
      typeof title === "string" &&
      title.trim().length > 0
    );
  };

  const normalizeLink = (value) => {
    const [url, title, description] = value;
    return {
      url,
      title,
      description: typeof description === "string" ? description : ""
    };
  };

  const findQueryInTree = (node) => {
    const stack = [node];
    while (stack.length) {
      const current = stack.pop();
      const query = isQuerySignature(current);
      if (query) {
        return query;
      }
      if (Array.isArray(current)) {
        for (const child of current) {
          stack.push(child);
        }
      } else if (isPlainObject(current)) {
        for (const child of Object.values(current)) {
          stack.push(child);
        }
      }
    }
    return null;
  };

  const findLinkLists = (node) => {
    const lists = [];
    if (!Array.isArray(node)) {
      return lists;
    }

    const isListOfLinks = (list) =>
      Array.isArray(list) && list.length > 0 && list.every(isLinkArray);

    if (isListOfLinks(node)) {
      lists.push(node);
    }

    for (const child of node) {
      if (isListOfLinks(child)) {
        lists.push(child);
      }
    }

    return lists;
  };

  const scanForBlocks = (node, results) => {
    if (Array.isArray(node)) {
      const query = findQueryInTree(node);
      if (query && !BLACKLISTED_QUERIES.has(query)) {
        const linkLists = findLinkLists(node);
        if (linkLists.length) {
          const bestList = linkLists.reduce((best, list) =>
            list.length > best.length ? list : best
          );
          results.push({
            query,
            links: bestList.map(normalizeLink)
          });
        }
      }

      for (const child of node) {
        scanForBlocks(child, results);
      }
      return;
    }

    if (isPlainObject(node)) {
      for (const child of Object.values(node)) {
        scanForBlocks(child, results);
      }
    }
  };

  const parseBatchexecuteResponse = (responseText) => {
    const payload = extractJsonPayload(responseText);
    if (!payload) {
      return [];
    }

    let data;
    try {
      data = JSON.parse(payload);
    } catch (error) {
      return [];
    }

    const results = [];
    scanForBlocks(data, results);

    const deduped = new Map();
    for (const block of results) {
      const existing = deduped.get(block.query);
      if (!existing || block.links.length > existing.links.length) {
        deduped.set(block.query, block);
      }
    }

    return Array.from(deduped.values());
  };

  const parserApi = {
    parseBatchexecuteResponse,
    stripXssiPrefix,
    extractJsonPayload
  };

  if (typeof window !== "undefined") {
    window.NotebookLMParser = parserApi;
  }

  if (typeof module !== "undefined") {
    module.exports = parserApi;
  }
})();
