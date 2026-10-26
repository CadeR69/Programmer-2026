"""MCP server exposing the Higgsfield generative image/video API as tools.

Runs over stdio, so a local MCP client (Claude Code, Claude Desktop) launches
it; it is not deployed anywhere.

Everything here follows https://docs.higgsfield.ai:

  base URL   https://api.higgsfield.ai
  auth       Authorization: Key ${HF_API_KEY_ID}:${HF_API_KEY_SECRET}
  submit     POST /<model-path>          -> {status, request_id, status_url, cancel_url}
  poll       GET  /requests/<id>/status  -> {status, ...outputs}
  cancel     POST /requests/<id>/cancel  (only while still queued)

Model paths differ per model and are discovered in the console at
https://console.higgsfield.ai, so `submit_generation` takes the path as an
argument. `generate_image` is a typed shortcut for the documented SOUL 2
text-to-image endpoint.
"""

import asyncio
import json
import os

import httpx
from mcp.server.fastmcp import FastMCP

SOUL_2_STANDARD = "higgsfield-ai/soul/v2/standard"

# Per the docs, queued and in_progress are the only states still moving.
TERMINAL_STATUSES = {"completed", "failed", "nsfw", "canceled"}

ASPECT_RATIOS = ("9:16", "16:9", "4:3", "3:4", "1:1", "2:3", "3:2")
RESOLUTIONS = ("720p", "1080p")
BATCH_SIZES = (1, 4)

# Output keys the docs mention. Lists of files, then single files.
LIST_OUTPUT_KEYS = ("images", "audios")
SINGLE_OUTPUT_KEYS = ("video", "audio", "zip", "mov", "jsx", "fbx", "ply")

API_BASE = ""
KEY_ID = ""
KEY_SECRET = ""
POLL_SECONDS = 3.0
HTTP_TIMEOUT = 60.0


def reload_credentials() -> None:
    """Re-read configuration from the environment.

    Called at import and by the tests, so a changed environment is picked up
    without having to reimport the module.
    """
    global API_BASE, KEY_ID, KEY_SECRET, POLL_SECONDS, HTTP_TIMEOUT

    API_BASE = os.environ.get("HIGGSFIELD_API_BASE", "https://api.higgsfield.ai").rstrip("/")
    POLL_SECONDS = float(os.environ.get("HIGGSFIELD_POLL_SECONDS", "3"))
    HTTP_TIMEOUT = float(os.environ.get("HIGGSFIELD_HTTP_TIMEOUT", "60"))

    # Higgsfield issues the key in two halves. The console calls them
    # HF_API_KEY_ID / HF_API_KEY_SECRET; their Python SDK also accepts a
    # single HF_KEY="id:secret", so accept either spelling.
    KEY_ID = os.environ.get("HF_API_KEY_ID", "")
    KEY_SECRET = os.environ.get("HF_API_KEY_SECRET", "")
    if not (KEY_ID and KEY_SECRET):
        joined = os.environ.get("HF_KEY", "")
        if ":" in joined:
            KEY_ID, KEY_SECRET = (part.strip() for part in joined.split(":", 1))


def auth_headers() -> dict[str, str]:
    """The two headers every Higgsfield call needs."""
    return {
        "Authorization": f"Key {KEY_ID}:{KEY_SECRET}",
        "Content-Type": "application/json",
    }


reload_credentials()

mcp = FastMCP("higgsfield")
