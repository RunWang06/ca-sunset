"""Local preview server with caching disabled: python3 serve.py [port]

Always serves the folder this file is in, wherever it is launched from.
"""
import functools
import http.server
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent


class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
handler = functools.partial(NoCache, directory=str(ROOT))
print(f"Serving {ROOT} at http://127.0.0.1:{port}")
http.server.ThreadingHTTPServer(("127.0.0.1", port), handler).serve_forever()
