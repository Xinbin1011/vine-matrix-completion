/* The public site computes in a worker. It never calls localhost or /api/analyse. */
(function () {
  "use strict";
  let worker, nextId = 0;
  const pending = new Map();
  function connection(message) {
    const element = document.getElementById('connection-state');
    if (element) element.textContent = message;
  }
  function stop(error) {
    if (worker) worker.terminate();
    worker = undefined;
    for (const request of pending.values()) {
      clearTimeout(request.timer);
      request.reject(error);
    }
    pending.clear();
    connection('Browser solver unavailable · reload to retry');
  }
  window.matrixSolver = {
    request(payload) {
      return new Promise((resolve, reject) => {
        if (!worker) {
          connection('Loading browser solver…');
          worker = new Worker(new URL('solver-worker.mjs', document.baseURI), { type: 'module' });
          worker.onmessage = ({ data }) => {
            const request = pending.get(data.id);
            if (!request) return;
            clearTimeout(request.timer);
            pending.delete(data.id);
            if (data.error) {
              connection('Browser solver unavailable · retry or reload');
              request.reject(new Error(data.error));
            } else {
              connection('Browser Python · no local server needed');
              request.resolve(data.result);
            }
          };
          worker.onerror = () => stop(new Error('The browser solver could not load. Check your connection and reload.'));
        }
        const id = ++nextId;
        const timer = setTimeout(() => stop(new Error('The browser solver took too long to load or calculate. Reload to retry.')), 180000);
        pending.set(id, { resolve, reject, timer });
        worker.postMessage({ id, payload });
      });
    }
  };
})();
