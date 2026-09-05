"""
TriggTech AI Proxy — a remote MCP server exposing OpenAI (GPT), xAI (Grok),
and Google (Gemini) as tools Claude/Cowork can call directly.

Why this exists: none of these three providers publish a hosted MCP server
the way Perplexity does, so this is a thin FastMCP wrapper around their
plain REST APIs, deployed somewhere with a public HTTPS URL and added to
Cowork as a custom connector.

Auth note: Cowork's "Add custom connector" screen only accepts a URL — it
always tries to OAuth-register with whatever server you point it at, and
refuses to proceed if that fails. So this server implements the smallest
possible OAuth authorization server: when Cowork tries to connect, it opens
a one-field login page here asking for MCP_ACCESS_TOKEN. Type it once,
and Cowork stores the resulting session — no header, no token-in-URL
trick needed. Adapted from the MCP Python SDK's own "simple-auth" example
(examples/servers/simple-auth/mcp_simple_auth/simple_auth_provider.py).
"""

import os
import secrets
import time

import httpx
from mcp.server.auth.provider import (
    AccessToken,
    AuthorizationCode,
    AuthorizationParams,
    OAuthAuthorizationServerProvider,
    RefreshToken,
    construct_redirect_uri,
)
from mcp.server.auth.settings import AuthSettings, ClientRegistrationOptions, RevocationOptions
from mcp.server.fastmcp import FastMCP
from mcp.server.transport_security import TransportSecuritySettings
from mcp.shared.auth import OAuthClientInformationFull, OAuthToken
from mcp.types import ImageContent
from pydantic import AnyHttpUrl
from starlette.exceptions import HTTPException
from starlette.requests import Request
from starlette.responses import HTMLResponse, PlainTextResponse, RedirectResponse, Response

# ---- Config --------------------------------------------------------------

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
        "MCP_ACCESS_TOKEN env var is required (this is the password the /login "
        "page checks). Generate one with: python3 -c \"import secrets; "
        "print(secrets.token_urlsafe(32))\""
    )

PORT = int(os.environ.get("PORT", 8000))

# Render sets this automatically for every web service. For local testing,
# set PUBLIC_URL yourself (e.g. http://localhost:8000).
SERVER_URL = os.environ.get("RENDER_EXTERNAL_URL") or os.environ.get("PUBLIC_URL")
if not SERVER_URL:
    raise RuntimeError(
        "Could not determine this server's public URL. Set PUBLIC_URL "
        "(Render sets RENDER_EXTERNAL_URL automatically, so this is only "
        "needed for local testing, e.g. http://localhost:8000)."
    )
SERVER_URL = SERVER_URL.rstrip("/")


# ---- Minimal OAuth authorization server, gated by MCP_ACCESS_TOKEN -------

class AccessTokenGateProvider(OAuthAuthorizationServerProvider[AuthorizationCode, RefreshToken, AccessToken]):
    """The whole point of this class: accept any client that wants to
    connect (dynamic registration), then gate the actual authorization step
    behind a single shared secret (MCP_ACCESS_TOKEN) instead of a real user
    login system. There's exactly one user (Cade), so a full login system
    would be security theater — this just proves "you have the secret."
    """

    def __init__(self, gate_secret: str, server_url: str):
        self.gate_secret = gate_secret
        self.server_url = server_url
        self.clients: dict[str, OAuthClientInformationFull] = {}
        self.auth_codes: dict[str, AuthorizationCode] = {}
        self.tokens: dict[str, AccessToken] = {}
        self.state_mapping: dict[str, dict[str, str | None]] = {}

    async def get_client(self, client_id: str) -> OAuthClientInformationFull | None:
        return self.clients.get(client_id)

    async def register_client(self, client_info: OAuthClientInformationFull) -> None:
        if not client_info.client_id:
            raise ValueError("No client_id provided")
        self.clients[client_info.client_id] = client_info

    async def authorize(self, client: OAuthClientInformationFull, params: AuthorizationParams) -> str:
        state = params.state or secrets.token_hex(16)
        self.state_mapping[state] = {
            "redirect_uri": str(params.redirect_uri),
            "code_challenge": params.code_challenge,
            "redirect_uri_provided_explicitly": str(params.redirect_uri_provided_explicitly),
            "client_id": client.client_id,
            "resource": params.resource,
        }
        return f"{self.server_url}/login?state={state}&client_id={client.client_id}"

    async def get_login_page(self, state: str) -> HTMLResponse:
        if not state:
            raise HTTPException(400, "Missing state parameter")
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>TriggTech AI Proxy — Sign in</title>
            <style>
                body {{ font-family: Arial, sans-serif; max-width: 480px; margin: 60px auto; padding: 20px; }}
                input {{ width: 100%; padding: 10px; margin-top: 6px; box-sizing: border-box; }}
                button {{ background-color: #4CAF50; color: white; padding: 10px 16px; border: none;
                          cursor: pointer; margin-top: 16px; border-radius: 4px; }}
            </style>
        </head>
        <body>
            <h2>TriggTech AI Proxy</h2>
            <p>Enter your MCP_ACCESS_TOKEN to connect Claude to this server.</p>
            <form action="{self.server_url}/login/callback" method="post">
                <input type="hidden" name="state" value="{state}">
                <label>Access token:</label>
                <input type="password" name="access_token" required autofocus>
                <button type="submit">Connect</button>
            </form>
        </body>
        </html>
        """
        return HTMLResponse(content=html_content)

    async def handle_login_callback(self, request: Request) -> Response:
        form = await request.form()
        token = form.get("access_token")
        state = form.get("state")
        if not token or not state:
            raise HTTPException(400, "Missing access_token or state")
        if not isinstance(token, str) or not isinstance(state, str):
            raise HTTPException(400, "Invalid parameter types")

        if not secrets.compare_digest(token, self.gate_secret):
            raise HTTPException(401, "Incorrect access token")

        state_data = self.state_mapping.get(state)
        if not state_data:
            raise HTTPException(400, "Invalid state parameter")

        redirect_uri = state_data["redirect_uri"]
        code_challenge = state_data["code_challenge"]
        redirect_uri_provided_explicitly = state_data["redirect_uri_provided_explicitly"] == "True"
        client_id = state_data["client_id"]
        resource = state_data.get("resource")
        assert redirect_uri is not None
        assert client_id is not None

        new_code = f"mcp_{secrets.token_hex(16)}"
        self.auth_codes[new_code] = AuthorizationCode(
            code=new_code,
            client_id=client_id,
            redirect_uri=AnyHttpUrl(redirect_uri),
            redirect_uri_provided_explicitly=redirect_uri_provided_explicitly,
            expires_at=time.time() + 300,
            scopes=["mcp"],
            code_challenge=code_challenge,
            resource=resource,
        )
        del self.state_mapping[state]
        return RedirectResponse(url=construct_redirect_uri(redirect_uri, code=new_code, state=state), status_code=302)

    async def load_authorization_code(
        self, client: OAuthClientInformationFull, authorization_code: str
    ) -> AuthorizationCode | None:
        return self.auth_codes.get(authorization_code)

    async def exchange_authorization_code(
        self, client: OAuthClientInformationFull, authorization_code: AuthorizationCode
    ) -> OAuthToken:
        if authorization_code.code not in self.auth_codes:
            raise ValueError("Invalid authorization code")
        if not client.client_id:
            raise ValueError("No client_id provided")

        mcp_token = f"mcp_{secrets.token_hex(32)}"
        self.tokens[mcp_token] = AccessToken(
            token=mcp_token,
            client_id=client.client_id,
            scopes=authorization_code.scopes,
            expires_at=None,  # long-lived; this is a personal single-user server
            resource=authorization_code.resource,
        )
        del self.auth_codes[authorization_code.code]
        return OAuthToken(
            access_token=mcp_token,
            token_type="Bearer",
            scope=" ".join(authorization_code.scopes),
        )

    async def load_access_token(self, token: str) -> AccessToken | None:
        access_token = self.tokens.get(token)
        if not access_token:
            return None
        if access_token.expires_at and access_token.expires_at < time.time():
            del self.tokens[token]
            return None
        return access_token

    async def load_refresh_token(self, client: OAuthClientInformationFull, refresh_token: str) -> RefreshToken | None:
        return None

    async def exchange_refresh_token(
        self, client: OAuthClientInformationFull, refresh_token: RefreshToken, scopes: list[str]
    ) -> OAuthToken:
        raise NotImplementedError("Refresh tokens not supported")

    async def revoke_token(self, token: str, token_type_hint: str | None = None) -> None:
        self.tokens.pop(token, None)


oauth_provider = AccessTokenGateProvider(gate_secret=ACCESS_TOKEN, server_url=SERVER_URL)

auth_settings = AuthSettings(
    issuer_url=AnyHttpUrl(SERVER_URL),
    client_registration_options=ClientRegistrationOptions(
        enabled=True,
        valid_scopes=["mcp"],
        default_scopes=["mcp"],
    ),
    revocation_options=RevocationOptions(enabled=True),
    required_scopes=["mcp"],
    resource_server_url=None,  # legacy combined authorization-server + resource-server mode
)

mcp = FastMCP(
    "triggtech-ai-proxy",
    host="0.0.0.0",
    port=PORT,
    stateless_http=True,
    auth_server_provider=oauth_provider,
    auth=auth_settings,
    # Requests arrive with Render's own Host header, not localhost —
    # disable the default DNS-rebinding host check or every real call gets 421'd.
    transport_security=TransportSecuritySettings(enable_dns_rebinding_protection=False),
)


@mcp.custom_route("/", methods=["GET"])
async def health(_request: Request) -> PlainTextResponse:
    return PlainTextResponse("triggtech-ai-proxy is running")


@mcp.custom_route("/login", methods=["GET"])
async def login_page_handler(request: Request) -> Response:
    state = request.query_params.get("state")
    if not state:
        raise HTTPException(400, "Missing state parameter")
    return await oauth_provider.get_login_page(state)


@mcp.custom_route("/login/callback", methods=["POST"])
async def login_callback_handler(request: Request) -> Response:
    return await oauth_provider.handle_login_callback(request)


# ---- Tools -----------------------------------------------------------------

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
