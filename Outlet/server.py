"""Outlet example backend: one file, standard library only, nothing to install.

Run it:
    cp .env.example .env     then put your own team password (and Gemini key, if you want AI) in .env
    python3 server.py

Then open http://localhost:8000 on this computer, or http://<this computer's network address>:8000
on a teammate's computer or phone, and type the same password in Outlet's Settings.

Settings come from .env (git ignores it) or from environment variables, which win over .env.
Either way no secret is ever written in code or in git, and your password stays out of shell history:
    OUTLET_TEAM_KEY   required. The shared team password every request must send.
    GEMINI_API_KEY    optional. Your own Gemini key; without it the AI buttons say AI isn't set up.
    GEMINI_MODEL      optional. Defaults to gemini-3.8-flash.
    GEMINI_FALLBACK_MODEL  optional. Asked once when the main model is overloaded or too slow.
                      Defaults to gemini-3.6-flash; set it empty to turn the retry off.
    OUTLET_PORT       optional. Defaults to 8000.
    OUTLET_DATA_DIR   optional. Defaults to outlet-data/ next to this file (git ignores it).

This is a starting point, not the only option. Outlet's page works with any backend that answers
the HTTP calls listed in Handler.handle_api, so rewrite this in whatever your team prefers.
Over the internet, put it behind HTTPS: plain HTTP sends the team password readable on the network.
"""

import hmac
import json
import os
import re
import threading
import urllib.error
import urllib.request
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HERE = Path(__file__).resolve().parent


def load_env_file(path):
    """Reads NAME=value lines from a .env file into the environment. Variables already set win."""
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        name, sep, value = line.partition('=')
        name = name.strip().removeprefix('export ').strip()
        if sep and name and not name.startswith('#'):
            os.environ.setdefault(name, value.strip().strip('\'"'))


load_env_file(HERE / '.env')
TEAM_KEY = os.environ.get('OUTLET_TEAM_KEY', '')
GEMINI_KEY = os.environ.get('GEMINI_API_KEY', '')
GEMINI_MODEL = os.environ.get('GEMINI_MODEL', 'gemini-3.8-flash')
GEMINI_FALLBACK_MODEL = os.environ.get('GEMINI_FALLBACK_MODEL', 'gemini-3.6-flash')
BUSY_CODES = {429, 500, 503}  # Gemini's "overloaded, try again later" answers
SLOW_SECONDS = 30  # how long the main model gets before the backup is tried
PORT = int(os.environ.get('OUTLET_PORT', '8000'))
DATA_DIR = Path(os.environ.get('OUTLET_DATA_DIR', HERE / 'outlet-data'))
DATA_FILE = DATA_DIR / 'data.json'
FILES_DIR = DATA_DIR / 'files'

COLLECTIONS = ('logs', 'tasks', 'comments', 'notes', 'events', 'stickies', 'workflows')
# Only these files are served without the password. Everything else (this file, the data folder) is not.
PAGES = {
    '/': ('Outlet.com.html', 'text/html; charset=utf-8'),
    '/Outlet.com.html': ('Outlet.com.html', 'text/html; charset=utf-8'),
    '/icon.svg': ('icon.svg', 'image/svg+xml'),
}
MAX_ITEM = 1024 * 1024       # one saved item, as JSON
MAX_FILE = 5 * 1024 * 1024   # one attachment
SAFE_ID = re.compile(r'[A-Za-z0-9_-]{1,64}')

# ponytail: one lock and one JSON file hold everything; move to SQLite if a big team makes saves slow
lock = threading.Lock()
data = {}


def load():
    saved = json.loads(DATA_FILE.read_text()) if DATA_FILE.exists() else {}
    return {name: saved.get(name, {}) for name in COLLECTIONS}


def store():
    temp = DATA_FILE.with_suffix('.tmp')
    temp.write_text(json.dumps(data))
    temp.replace(DATA_FILE)  # swaps the new file in one step, so a crash mid-save can't leave half a file


class GeminiBusy(Exception):
    """The model is overloaded or too slow right now; a different model may still answer."""


def ask_gemini(model, system, prompt, timeout):
    body = {'contents': [{'role': 'user', 'parts': [{'text': prompt}]}]}
    if system:
        body['system_instruction'] = {'parts': [{'text': system}]}
    request = urllib.request.Request(
        f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent',
        data=json.dumps(body).encode(),
        headers={'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY},  # key in a header, never the URL
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            reply = json.load(response)
    except urllib.error.HTTPError as error:
        if error.code in BUSY_CODES:
            raise GeminiBusy(f'{model} answered {error.code}') from error
        raise
    except TimeoutError as error:  # waited too long for the answer
        raise GeminiBusy(f'{model} took longer than {timeout} seconds') from error
    except urllib.error.URLError as error:  # waited too long to connect
        if isinstance(error.reason, TimeoutError):
            raise GeminiBusy(f'{model} took longer than {timeout} seconds') from error
        raise
    parts = (reply.get('candidates') or [{}])[0].get('content', {}).get('parts', [])
    text = ''.join(part.get('text', '') for part in parts)
    if not text:
        raise ValueError('Gemini sent back no text (the request may have been blocked).')
    return text


def ask_ai(system, prompt):
    """Asks the main model; if it's overloaded or too slow, asks the backup model once."""
    models = [GEMINI_MODEL]
    if GEMINI_FALLBACK_MODEL and GEMINI_FALLBACK_MODEL != GEMINI_MODEL:
        models.append(GEMINI_FALLBACK_MODEL)
    for number, model in enumerate(models, 1):
        last = number == len(models)
        try:
            # with a backup waiting, the main model gets less time, so a stuck answer doesn't use up the whole wait
            return ask_gemini(model, system, prompt, timeout=60 if last else SLOW_SECONDS)
        except GeminiBusy as busy:
            print(f'AI: {busy}' + ('' if last else f', trying {models[number]}'))
    raise GeminiBusy(f'Gemini is overloaded right now (tried {" and then ".join(models)}). Wait a minute and try again.')


def gemini_complaint(error):
    """Google's own explanation from an error reply, like "API key not valid"."""
    raw = error.read().decode(errors='replace')
    try:
        return json.loads(raw)['error']['message']
    except (ValueError, KeyError, TypeError):
        return raw[:300]


class Handler(BaseHTTPRequestHandler):
    def send(self, status, body=b'', content_type='application/json'):
        if isinstance(body, (dict, list)):
            body = json.dumps(body).encode()
        self.send_response(status)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(body)))
        # The page may be opened from a file or another site. That's safe to allow because the
        # password travels in a header (not a cookie), so other sites can't borrow it.
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):  # browsers ask this first before a cross-site call that carries a password header
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, PUT, POST, DELETE')
        self.send_header('Access-Control-Allow-Headers', 'Authorization, Content-Type')
        self.send_header('Access-Control-Max-Age', '600')
        self.end_headers()

    def do_GET(self):
        self.route('GET')

    def do_PUT(self):
        self.route('PUT')

    def do_POST(self):
        self.route('POST')

    def do_DELETE(self):
        self.route('DELETE')

    def route(self, method):
        path = self.path.split('?')[0]
        if method == 'GET' and path in PAGES:
            name, content_type = PAGES[path]
            return self.send(200, (HERE / name).read_bytes(), content_type)
        if not path.startswith('/api/'):
            return self.send(404, {'error': 'Not found'})
        if not hmac.compare_digest(self.headers.get('Authorization', '').encode(), f'Bearer {TEAM_KEY}'.encode()):
            return self.send(401, {'error': 'Wrong team password'})
        try:
            self.handle_api(method, path.removeprefix('/api/').split('/'))
        except ValueError as error:  # bad JSON, wrong id, too big
            self.send(400, {'error': str(error)})

    def read_body(self, limit):
        length = int(self.headers.get('Content-Length') or 0)
        if not 0 <= length <= limit:
            raise ValueError(f'Too big: the limit is {limit // (1024 * 1024)} MB')
        return self.rfile.read(length)

    def handle_api(self, method, parts):
        """The whole HTTP contract Outlet's page expects (every call sends "Authorization: Bearer <team password>"):

        GET    /api/all                 -> {"tasks": [...], "notes": [...], ...} every collection
        PUT    /api/<collection>/<id>   body: the item as JSON, its "id" matching <id> -> adds or replaces it
        DELETE /api/<collection>/<id>   -> removes it
        POST   /api/files               body: the file's bytes -> {"id": "..."}
        GET    /api/files/<id>          -> the file's bytes
        DELETE /api/files/<id>          -> removes the file
        POST   /api/ai                  body: {"system": "...", "prompt": "..."} -> {"text": "..."}
        """
        match method, parts:
            case 'GET', ['all']:
                with lock:
                    snapshot = {name: list(items.values()) for name, items in data.items()}
                return self.send(200, snapshot)

            case 'PUT', [collection, item_id] if collection in COLLECTIONS and SAFE_ID.fullmatch(item_id):
                item = json.loads(self.read_body(MAX_ITEM))
                if not isinstance(item, dict) or item.get('id') != item_id:
                    raise ValueError('The body must be a JSON object whose "id" matches the address')
                with lock:
                    data[collection][item_id] = item
                    store()
                return self.send(200, item)

            case 'DELETE', [collection, item_id] if collection in COLLECTIONS and SAFE_ID.fullmatch(item_id):
                with lock:
                    data[collection].pop(item_id, None)
                    store()
                return self.send(204)

            case 'POST', ['files']:
                file_id = uuid.uuid4().hex
                (FILES_DIR / file_id).write_bytes(self.read_body(MAX_FILE))
                return self.send(201, {'id': file_id})

            case 'GET', ['files', file_id] if SAFE_ID.fullmatch(file_id) and (FILES_DIR / file_id).is_file():
                return self.send(200, (FILES_DIR / file_id).read_bytes(), 'application/octet-stream')

            case 'DELETE', ['files', file_id] if SAFE_ID.fullmatch(file_id):
                (FILES_DIR / file_id).unlink(missing_ok=True)
                return self.send(204)

            case 'POST', ['ai']:
                if not GEMINI_KEY:
                    return self.send(503, {'error': 'AI is not set up yet: put your own GEMINI_API_KEY in the backend\'s .env file and restart it.'})
                request = json.loads(self.read_body(MAX_ITEM))
                try:
                    text = ask_ai(str(request.get('system', '')), str(request.get('prompt', '')))
                except GeminiBusy as busy:
                    return self.send(503, {'error': str(busy)})
                except urllib.error.HTTPError as error:  # not a busy problem, so retrying wouldn't help (a bad key, say)
                    return self.send(502, {'error': f'Gemini refused the request ({error.code}): {gemini_complaint(error)}'})
                except urllib.error.URLError as error:
                    return self.send(502, {'error': f"Couldn't reach Gemini: {error.reason}"})
                except ValueError as error:
                    return self.send(502, {'error': str(error)})
                return self.send(200, {'text': text})

        self.send(404, {'error': 'Unknown API call'})


def make_server(port):
    global data
    FILES_DIR.mkdir(parents=True, exist_ok=True)
    data = load()
    return ThreadingHTTPServer(('0.0.0.0', port), Handler)


if __name__ == '__main__':
    if not TEAM_KEY:
        raise SystemExit('Set a team password first: copy .env.example to .env and fill in OUTLET_TEAM_KEY.')
    server = make_server(PORT)
    print(f'Outlet backend running on http://localhost:{PORT} (saving to {DATA_DIR})')
    backup = f', backup {GEMINI_FALLBACK_MODEL}' if GEMINI_FALLBACK_MODEL and GEMINI_FALLBACK_MODEL != GEMINI_MODEL else ''
    print(f'AI: on ({GEMINI_MODEL}{backup})' if GEMINI_KEY else 'AI: off (set GEMINI_API_KEY to turn it on)')
    server.serve_forever()
