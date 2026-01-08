(function () {
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__notebookLmUrl = url;
    return originalOpen.call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.send = function (...args) {
    this.addEventListener("load", function () {
      try {
        if (typeof this.__notebookLmUrl === "string" && this.__notebookLmUrl.includes("batchexecute")) {
          window.postMessage(
            {
              source: "NotebookLmSourceSaver",
              type: "raw-response",
              payload: this.responseText || ""
            },
            "*"
          );
        }
      } catch (error) {
        // swallow errors to avoid breaking page requests
      }
    });
    return originalSend.apply(this, args);
  };
})();
