"""Serve only the local demonstration assets; no external connections."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import argparse
import json
from urllib.parse import urlsplit
from backend import analyse

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--port", type=int, default=8766)
args = parser.parse_args()
root = Path(__file__).resolve().parent / "dist"
class DemoHandler(SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.path != "/api/analyse":
            self.send_error(404)
            return
        allowed = {f"127.0.0.1:{args.port}", f"localhost:{args.port}"}
        origin = self.headers.get("Origin")
        if self.headers.get("Host") not in allowed or (origin and urlsplit(origin).netloc not in allowed):
            self.send_error(403, "Local same-origin requests only")
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > 100000:
                raise ValueError("The request must be a small JSON scenario.")
            payload = json.loads(self.rfile.read(length), parse_constant=lambda value: (_ for _ in ()).throw(ValueError("Non-finite JSON number")))
            output = analyse(payload)
            data = json.dumps(output, allow_nan=False).encode("utf-8")
            self.send_response(200)
        except (ValueError, TypeError) as error:
            data = json.dumps({"ok": False, "error": {"message": str(error)}}).encode("utf-8")
            self.send_response(400)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

handler = partial(DemoHandler, directory=str(root))
server = ThreadingHTTPServer(("127.0.0.1", args.port), handler)
print(f"Local preview: http://127.0.0.1:{args.port}", flush=True)
print("Only dist/ is served. Stop with Ctrl+C.", flush=True)
try:
    server.serve_forever()
except KeyboardInterrupt:
    server.server_close()
