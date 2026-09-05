"""
TriggTech AI Proxy — a remote MCP server exposing OpenAI (GPT), xAI (Grok),
and Google (Gemini) as tools Claude/Cowork can call directly.

Why this exists: none of these three providers publish a hosted MCP server
the way Perplexity does, so this is a thin FastMCP wrapper around their
plain REST APIs, deployed somewhere with a public HTTPS URL and added to
Cowork as a custom connector.

Auth note: Cowork's "Add custom connector" screen only accepts a URL (no
header field, no API-key field). So instead of a Bearer header, this
server is protected by a secret token baked into the URL path itself
(MCP_ACCESS_TOKEN). Anyone who doesn't have that exact URL can't reach
the tools. Keep the deployed URL as private as an API key.
"""

import os
import httpx
from mcp.server.fastmcp import FastMCP
from mcp.server.transport_security import TransportSecuritySettings
from mcp.types import ImageContent
from starlette.requests import Request
from starlette.responses import PlainTextResponse

# ---- Config ----------------------------------------------------------

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
XAI_API_KEY = os.environ.get("XAI_API_KEY", "")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")

OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "gpt-5.2")
OPENAI_IMAGE_MODEL = os.environ.get("OPENAI_IMAGE_MODEL", "gpt-image-1")
XAI_MODEL = os.environ.get("XAI_MODEL", "grok-4.6")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-pro")
GEMINI_IMAGE_MODEL = os.environ.get("GEMINI_IMAGE_MODEL", "gemini-3.1-flash-image")

ACCESS_TOKEN = os.environ.get("MCP_ACCESS_TOKEN")
if not ACCESS_TOKEN:
    raise RuntimeError(
        "MCP_ACCESS_TOKEN env var is required (this is the secret that goes "
        "in the connector URL — generate one with: python3 -c \"import secrets; "
        "print(secrets.token_urlsafe(32))\""
    )

PORT = int(os.environ.get("PORT", 8000))

mcp = FastMCP(
    "triggtech-ai-proxy",
    host="0.0.0.0",
    port=PORT,
    streamable_http_path=f"/mcp/{ACCESS_TOKEN}",
    stateless_http=True,
    # Requests arrive with Render's/Cowork's own Host header, not localhost —
    # disable the default DNS-rebinding host check or every real call gets 421'd.
    transport_security=TransportSecuritySettings(enable_dns_rebinding_protection=False),
)


@mcp.custom_route("/", methods=["GET"])
async def health(_request: Request) -> PlainTextResponse:
    return PlainTextResponse("triggtech-ai-proxy is running")


# ---- Tools -------------------------------------------------------------

@mcp.tool()
async def ask_gpt(prompt: str, system: str = "") -> str:
    """Ask OpenAI's GPT model a question. Use this for a coding second
    opinion, code review, or general reasoning where you want OpenAI's
    take alongside your own."""
    if not OPENAI_API_KEY:
        return "Error: OPENAI_API_KEY is not configured on the server."
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {OPENAI_API_KEY}"},
            json={"model": OPENAI_MODEL, "messages": messages},
        )
    if r.status_code != 200:
        return f"OpenAI API error {r.status_code}: {r.text[:500]}"
    data = r.json()
    return data["choices"][0]["message"]["content"]


@mcp.tool()
async def ask_grok_trends(prompt: str) -> str:
    """Ask Grok (xAI) with live web/X search enabled. Best for real-time
    trends, current events, and social chatter — useful for TriggTech
    client marketing content and local-market research."""
    if not XAI_API_KEY:
        return "Error: XAI_API_KEY is not configured on the server."
    async with httpx.AsyncClient(timeout=90) as client:
        r = await client.post(
            "https://api.x.ai/v1/responses",
            headers={"Authorization": f"Bearer {XAI_API_KEY}"},
            json={
                "model": XAI_MODEL,
                "input": [{"role": "user", "content": prompt}],
                "tools": [{"type": "web_search"}],
            },
        )
    if r.status_code != 200:
        return f"xAI API error {r.status_code}: {r.text[:500]}"
    data = r.json()
    try:
        chunks = []
        for item in data.get("output", []):
            for c in item.get("content", []):
                if c.get("type") in ("output_text", "text"):
                    chunks.append(c.get("text", ""))
        return "\n".join(chunks) if chunks else str(data)[:2000]
    except Exception:
        return str(data)[:2000]


@mcp.tool()
async def ask_gemini(prompt: str) -> str:
    """Ask Google's Gemini model a question. Use for a second opinion,
    large-context reasoning, or an alternate perspective on a draft."""
    if not GEMINI_API_KEY:
        return "Error: GEMINI_API_KEY is not configured on the server."
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent",
            headers={"x-goog-api-key": GEMINI_API_KEY, "Content-Type": "application/json"},
            json={"contents": [{"parts": [{"text": prompt}]}]},
        )
    if r.status_code != 200:
        return f"Gemini API error {r.status_code}: {r.text[:500]}"
    data = r.json()
    try:
        return data["candidates"][0]["content"]["parts"][0]["text"]
    except Exception:
        return str(data)[:2000]


@mcp.tool()
async def generate_image(prompt: str, provider: str = "openai") -> ImageContent:
    """Generate an image for design/marketing use — mockups, hero images,
    logo concepts, social graphics for TriggTech clients. provider must be
    'openai' or 'gemini'."""
    if provider == "gemini":
        if not GEMINI_API_KEY:
            raise ValueError("GEMINI_API_KEY is not configured on the server.")
        async with httpx.AsyncClient(timeout=90) as client:
            r = await client.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_IMAGE_MODEL}:generateContent",
                headers={"x-goog-api-key": GEMINI_API_KEY, "Content-Type": "application/json"},
                json={
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {"responseModalities": ["TEXT", "IMAGE"]},
                },
            )
        if r.status_code != 200:
            raise ValueError(f"Gemini image API error {r.status_code}: {r.text[:500]}")
        data = r.json()
        for part in data["candidates"][0]["content"]["parts"]:
            if "inlineData" in part:
                return ImageContent(
                    type="image",
                    data=part["inlineData"]["data"],
                    mimeType=part["inlineData"].get("mimeType", "image/png"),
                )
        raise ValueError("No image returned by Gemini.")
    else:
        if not OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY is not configured on the server.")
        async with httpx.AsyncClient(timeout=90) as client:
            r = await client.post(
                "https://api.openai.com/v1/images/generations",
                headers={"Authorization": f"Bearer {OPENAI_API_KEY}"},
                json={"model": OPENAI_IMAGE_MODEL, "prompt": prompt, "size": "1024x1024"},
            )
        if r.status_code != 200:
            raise ValueError(f"OpenAI image API error {r.status_code}: {r.text[:500]}")
        data = r.json()
        b64 = data["data"][0]["b64_json"]
        return ImageContent(type="image", data=b64, mimeType="image/png")


if __name__ == "__main__":
    mcp.run(transport="streamable-http")
