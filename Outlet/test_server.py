"""Quick check for server.py. Run: python3 test_server.py (prints OK when everything passes)."""

import io
import json
import os
import tempfile
import threading
import urllib.error
import urllib.request
from pathlib import Path

os.environ.update(OUTLET_DATA_DIR=tempfile.mkdtemp(), OUTLET_TEAM_KEY='test-key', GEMINI_API_KEY='fake-key',
                  GEMINI_MODEL='main-model', GEMINI_FALLBACK_MODEL='backup-model')
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

# A fake Gemini: each call to it takes the next reply from `replies` (text to answer, or an error to raise)
calls, replies = [], []


def fake_urlopen(request, timeout):
    model = request.full_url.split('/models/')[1].split(':')[0]
    calls.append({'model': model, 'timeout': timeout, 'url': request.full_url,
                  'key': request.get_header('X-goog-api-key'), 'body': json.loads(request.data)})
    reply = replies.pop(0)
    if isinstance(reply, Exception):
        raise reply
    return io.BytesIO(json.dumps({'candidates': [{'content': {'parts': [{'text': reply}]}}]}).encode())


def gemini_error(code, message):
    return urllib.error.HTTPError('https://gemini', code, 'error', {}, io.BytesIO(json.dumps({'error': {'message': message}}).encode()))


def ask(*fake_replies):
    calls.clear()
    replies[:] = fake_replies
    return call('POST', '/api/ai', {'system': 'Be brief', 'prompt': 'Help'})


server.urllib.request.urlopen = fake_urlopen

# AI goes to Gemini with the key in a header, never in the URL
assert ask('A prompt') == (200, {'text': 'A prompt'})
assert calls[0]['key'] == 'fake-key' and 'fake-key' not in calls[0]['url']
assert calls[0]['body']['system_instruction'] == {'parts': [{'text': 'Be brief'}]}

# an overloaded or slow main model gets one retry on the backup model
assert ask(gemini_error(503, 'high demand'), 'From backup') == (200, {'text': 'From backup'})
assert [c['model'] for c in calls] == ['main-model', 'backup-model']
assert ask(TimeoutError('timed out'), 'From backup')[0] == 200
assert calls[0]['timeout'] == server.SLOW_SECONDS and calls[1]['timeout'] > server.SLOW_SECONDS
status, body = ask(gemini_error(503, 'high demand'), gemini_error(429, 'out of quota'))
assert status == 503 and 'main-model' in body['error'] and 'backup-model' in body['error']

# other problems (a bad key, say) aren't retried, and Google's reason is passed on
status, body = ask(gemini_error(403, 'API key not valid'))
assert status == 502 and len(calls) == 1 and 'API key not valid' in body['error']

# a .env file fills in settings, but variables already set (like the real environment) win
env_file = Path(tempfile.mkdtemp()) / '.env'
env_file.write_text('# my settings\nexport OUTLET_TEST_SETTING="from file"\nOUTLET_TEAM_KEY=from-file\n')
server.load_env_file(env_file)
assert os.environ['OUTLET_TEST_SETTING'] == 'from file'
assert os.environ['OUTLET_TEAM_KEY'] == 'test-key'

print('OK')
