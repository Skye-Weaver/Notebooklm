(() => {
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function open(method, url, ...rest) {
    this.__notebookLmUrl = url;
    return originalOpen.call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.send = function send(...args) {
    this.addEventListener("load", () => {
      try {
        const url = this.__notebookLmUrl || "";
        if (url.includes("batchexecute")) {
          window.dispatchEvent(
            new CustomEvent("NotebookLMBatchExecute", {
              detail: {
                url,
                responseText: this.responseText
              }
            })
          );
        }
      } catch (error) {
        // Swallow errors to avoid breaking the page.
      }
    });
    return originalSend.apply(this, args);
  };
})();
