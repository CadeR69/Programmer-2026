"""Tests for the Higgsfield MCP server."""

import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def test_auth_header_uses_key_id_and_secret(monkeypatch):
    """Higgsfield wants `Authorization: Key <id>:<secret>` (per docs quickstart)."""
    monkeypatch.setenv("HF_API_KEY_ID", "abc123")
    monkeypatch.setenv("HF_API_KEY_SECRET", "s3cret")

    import server

    server.reload_credentials()

    assert server.auth_headers()["Authorization"] == "Key abc123:s3cret"
