"""Quick check for server.py. Run: python3 test_server.py (prints OK when everything passes)."""

import io
import json
import os
import tempfile
import threading
import urllib.error
import urllib.request
from pathlib import Path

os.environ.update(OUTLET_DATA_DIR=tempfile.mkdtemp(), OUTLET_TEAM_KEY='test-key', GEMINI_API_KEY='fake-key')
import server  # noqa: E402  (must import after the settings above)

httpd = server.make_server(0)
threading.Thread(target=httpd.serve_forever, daemon=True).start()
BASE = f'http://127.0.0.1:{httpd.server_port}'
real_urlopen = urllib.request.urlopen  # the AI check below swaps urlopen out; these test calls keep the real one


def call(method, path, body=None, key='test-key'):
    if isinstance(body, dict):
        body = json.dumps(body).encode()
    request = urllib.request.Request(BASE + path, data=body, method=method, headers={'Authorization': f'Bearer {key}'})
    try:
        with real_urlopen(request) as response:
            status, raw = response.status, response.read()
    except urllib.error.HTTPError as error:
        status, raw = error.code, error.read()
    try:
        return status, json.loads(raw)
    except ValueError:
        return status, raw


# the password is required
assert call('GET', '/api/all', key='wrong')[0] == 401

# save, list, replace, delete
assert call('PUT', '/api/tasks/t1', {'id': 't1', 'title': 'Ship it'})[0] == 200
assert call('PUT', '/api/tasks/t1', {'id': 't1', 'title': 'Ship it today'})[0] == 200
assert call('GET', '/api/all')[1]['tasks'] == [{'id': 't1', 'title': 'Ship it today'}]
assert call('PUT', '/api/tasks/t2', {'id': 'other'})[0] == 400   # id must match the address
assert call('PUT', '/api/secrets/t1', {'id': 't1'})[0] == 404    # unknown collection
assert json.loads(server.DATA_FILE.read_text())['tasks']['t1']['title'] == 'Ship it today'  # written to disk
assert call('DELETE', '/api/tasks/t1')[0] == 204
assert call('GET', '/api/all')[1]['tasks'] == []

# files round-trip, and an id can't walk out of the files folder
status, body = call('POST', '/api/files', b'hello')
assert status == 201
assert call('GET', f'/api/files/{body["id"]}')[1] == b'hello'
assert call('GET', '/api/files/..%2Fdata.json')[0] == 404
assert call('GET', '/api/files/../data.json')[0] == 404

# the page is public, the data folder and this code are not
assert call('GET', '/', key='')[0] == 200
assert call('GET', '/outlet-data/data.json', key='')[0] == 404
assert call('GET', '/server.py', key='')[0] == 404

# AI goes to Gemini with the key in a header, never in the URL
sent = {}


def fake_urlopen(request, timeout):
    sent.update(url=request.full_url, key=request.get_header('X-goog-api-key'), body=json.loads(request.data))
    return io.BytesIO(json.dumps({'candidates': [{'content': {'parts': [{'text': 'A prompt'}]}}]}).encode())


server.urllib.request.urlopen = fake_urlopen
assert call('POST', '/api/ai', {'system': 'Be brief', 'prompt': 'Help'}) == (200, {'text': 'A prompt'})
assert sent['key'] == 'fake-key' and 'fake-key' not in sent['url']
assert sent['body']['system_instruction'] == {'parts': [{'text': 'Be brief'}]}

# a .env file fills in settings, but variables already set (like the real environment) win
env_file = Path(tempfile.mkdtemp()) / '.env'
env_file.write_text('# my settings\nexport OUTLET_TEST_SETTING="from file"\nOUTLET_TEAM_KEY=from-file\n')
server.load_env_file(env_file)
assert os.environ['OUTLET_TEST_SETTING'] == 'from file'
assert os.environ['OUTLET_TEAM_KEY'] == 'test-key'

print('OK')
