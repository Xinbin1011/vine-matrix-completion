// Browser and notebook use the same Python package. No matrix is sent to a server.
import { loadPyodide } from "https://cdn.jsdelivr.net/pyodide/v314.0.7/full/pyodide.mjs";

const base = new URL("./", import.meta.url);
const archiveUrl = new URL("solver-python.zip", base);
archiveUrl.search = new URL(import.meta.url).search;
let runtimePromise;
let queue = Promise.resolve();

async function runtime() {
  if (!runtimePromise) runtimePromise = (async () => {
    const python = await loadPyodide();
    await python.loadPackage(["numpy", "networkx"]);
    const response = await fetch(archiveUrl);
    if (!response.ok) throw new Error("The solver package could not be downloaded.");
    python.unpackArchive(await response.arrayBuffer(), "zip", { extractDir: "/app" });
    python.runPython("import sys\nsys.path.insert(0, '/app/employer-demo')\nfrom backend import analyse\nimport json");
    return python;
  })().catch(error => { runtimePromise = undefined; throw error; });
  return runtimePromise;
}

self.onmessage = ({ data }) => {
  queue = queue.catch(() => {}).then(async () => {
    try {
      const python = await runtime();
      // JSON is passed as data, never interpolated into executable Python.
      python.globals.set("request_json", JSON.stringify(data.payload));
      try {
        const result = python.runPython("json.dumps(analyse(json.loads(request_json)), allow_nan=False)");
        self.postMessage({ id: data.id, result: JSON.parse(result) });
      } finally {
        python.globals.delete("request_json");
      }
    } catch (error) {
      self.postMessage({ id: data.id, error: String(error.message || error) });
    }
  });
};
