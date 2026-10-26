"""A stub Higgsfield API, so the tools can be tested without a real API key."""

import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import pytest


class StubState:
    """What the stub should return, and what it actually received."""

    def __init__(self):
        self.requests = []          # (method, path, headers, body)
        self.submit_response = {
            "status": "queued",
            "request_id": "req-1",
            "status_url": "/requests/req-1/status",
            "cancel_url": "/requests/req-1/cancel",
        }
        self.submit_status_code = 200
        # Popped one at a time, so a test can script queued -> completed.
        self.status_sequence = [
            {"status": "completed", "request_id": "req-1",
             "images": [{"url": "https://cdn.example.com/out-1.jpg"}]},
        ]
        self.cancel_response = {"status": "canceled", "request_id": "req-1"}


def _make_handler(state: StubState):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass

        def _record(self, body=b""):
            state.requests.append(
                (self.command, self.path, dict(self.headers), body.decode() if body else "")
            )

        def _send(self, payload, code=200):
            raw = json.dumps(payload).encode()
            self.send_response(code)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(raw)))
            self.end_headers()
            self.wfile.write(raw)

        def do_POST(self):
            length = int(self.headers.get("Content-Length") or 0)
            body = self.rfile.read(length) if length else b""
            self._record(body)
            if self.path.endswith("/cancel"):
                self._send(state.cancel_response)
            else:
                self._send(state.submit_response, state.submit_status_code)

        def do_GET(self):
            self._record()
            if len(state.status_sequence) > 1:
                payload = state.status_sequence.pop(0)
            else:
                payload = state.status_sequence[0]
            self._send(payload)

    return Handler


@pytest.fixture
def stub_api(monkeypatch):
    """Run the stub on a real port and point the server module at it."""
    state = StubState()
    httpd = ThreadingHTTPServer(("127.0.0.1", 0), _make_handler(state))
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()

    monkeypatch.setenv("HIGGSFIELD_API_BASE", f"http://127.0.0.1:{httpd.server_address[1]}")
    monkeypatch.setenv("HF_API_KEY_ID", "test-id")
    monkeypatch.setenv("HF_API_KEY_SECRET", "test-secret")
    monkeypatch.setenv("HIGGSFIELD_POLL_SECONDS", "0.01")

    import server
    server.reload_credentials()

    yield state

    httpd.shutdown()
    httpd.server_close()
