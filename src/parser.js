(function (global) {
  const BLACKLIST = new Set([
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

  const MAX_STRING_JSON_LENGTH = 2_000_000;

  function stripPrefix(text) {
    if (text.startsWith(")]}'")) {
      return text.slice(4).trim();
    }
    return text.trim();
  }

  function tryParseJson(value) {
    try {
      return JSON.parse(value);
    } catch (error) {
      return null;
    }
  }

  function parseJsonPrefix(value) {
    const trimmed = value.trim();
    if (!trimmed.startsWith("[") && !trimmed.startsWith("{")) {
      return null;
    }
    const stack = [];
    let inString = false;
    let escape = false;

    for (let i = 0; i < trimmed.length; i += 1) {
      const char = trimmed[i];
      if (inString) {
        if (escape) {
          escape = false;
          continue;
        }
        if (char === "\\\\") {
          escape = true;
        } else if (char === "\"") {
          inString = false;
        }
        continue;
      }
      if (char === "\"") {
        inString = true;
        continue;
      }
      if (char === "[" || char === "{") {
        stack.push(char);
      } else if (char === "]" || char === "}") {
        const last = stack.pop();
        if (!last) {
          return null;
        }
        if (stack.length === 0) {
          return tryParseJson(trimmed.slice(0, i + 1));
        }
      }
    }
    return null;
  }

  function extractJsonChunks(text) {
    const chunks = [];
    const direct = tryParseJson(text) || parseJsonPrefix(text);
    if (direct) {
      chunks.push(direct);
      return chunks;
    }

    const lines = text.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }
      if (
        (trimmed.startsWith("[") && trimmed.endsWith("]")) ||
        (trimmed.startsWith("{") && trimmed.endsWith("}"))
      ) {
        const parsed = tryParseJson(trimmed) || parseJsonPrefix(trimmed);
        if (parsed) {
          chunks.push(parsed);
        }
      }
    }

    return chunks;
  }

  function isQuerySignature(node) {
    return (
      Array.isArray(node) &&
      node.length >= 2 &&
      typeof node[0] === "string" &&
      typeof node[1] === "number" &&
      node[1] === 1
    );
  }

  function findQuerySignature(node, depthLimit = 12) {
    if (depthLimit < 0) {
      return null;
    }
    if (isQuerySignature(node)) {
      return node[0];
    }
    if (Array.isArray(node)) {
      for (const item of node) {
        const found = findQuerySignature(item, depthLimit - 1);
        if (found) {
          return found;
        }
      }
    } else if (node && typeof node === "object") {
      for (const value of Object.values(node)) {
        const found = findQuerySignature(value, depthLimit - 1);
        if (found) {
          return found;
        }
      }
    }
    return null;
  }

  function isLinkEntry(entry) {
    return (
      Array.isArray(entry) &&
      typeof entry[0] === "string" &&
      entry[0].startsWith("http")
    );
  }

  function extractLinksFromList(list) {
    const links = [];
    for (const entry of list) {
      if (isLinkEntry(entry)) {
        links.push({
          url: entry[0],
          title: typeof entry[1] === "string" ? entry[1] : "",
          description: typeof entry[2] === "string" ? entry[2] : ""
        });
      }
    }
    return links;
  }

  function findLinksNear(node) {
    const linkGroups = [];

    function collect(target, depth) {
      if (depth < 0 || !target) {
        return;
      }
      if (Array.isArray(target)) {
        if (target.some(isLinkEntry)) {
          linkGroups.push(target);
        }
        for (const child of target) {
          collect(child, depth - 1);
        }
      } else if (typeof target === "object") {
        for (const value of Object.values(target)) {
          collect(value, depth - 1);
        }
      }
    }

    collect(node, 2);

    const links = [];
    for (const group of linkGroups) {
      links.push(...extractLinksFromList(group));
    }

    return links;
  }

  function looksLikeJsonString(value) {
    if (typeof value !== "string") {
      return false;
    }
    const trimmed = value.trim();
    if (trimmed.length < 2 || trimmed.length > MAX_STRING_JSON_LENGTH) {
      return false;
    }
    return (
      (trimmed.startsWith("[") && trimmed.endsWith("]")) ||
      (trimmed.startsWith("{") && trimmed.endsWith("}"))
    );
  }

  function walk(node, visitor, seen = new Set()) {
    if (!node || typeof node !== "object") {
      return;
    }
    if (seen.has(node)) {
      return;
    }
    seen.add(node);
    visitor(node);

    if (Array.isArray(node)) {
      for (const item of node) {
        if (looksLikeJsonString(item)) {
          const parsed = tryParseJson(item) || parseJsonPrefix(item);
          if (parsed) {
            walk(parsed, visitor, seen);
            continue;
          }
        }
        walk(item, visitor, seen);
      }
      return;
    }

    for (const value of Object.values(node)) {
      walk(value, visitor, seen);
    }
  }

  function parseNotebookResponse(rawText) {
    const cleaned = stripPrefix(rawText);
    const chunks = extractJsonChunks(cleaned);
    const results = new Map();

    for (const chunk of chunks) {
      walk(chunk, (node) => {
        if (!Array.isArray(node)) {
          return;
        }
        const query = findQuerySignature(node);
        if (!query || BLACKLIST.has(query)) {
          return;
        }
        const links = findLinksNear(node);
        if (!links.length) {
          return;
        }
        const existing = results.get(query) || [];
        const merged = mergeLinks(existing, links);
        results.set(query, merged);
      });
    }

    return Array.from(results.entries()).map(([query, links]) => ({
      query,
      links
    }));
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

  function formatToastMessage(count) {
    return `✅ Найдено поисков: ${count}`;
  }

  global.NotebookLmParser = {
    parseNotebookResponse,
    formatToastMessage,
    BLACKLIST
  };

  if (typeof module !== "undefined") {
    module.exports = global.NotebookLmParser;
  }
})(typeof window !== "undefined" ? window : globalThis);
