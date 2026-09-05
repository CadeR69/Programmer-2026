# TriggTech AI Proxy

A remote MCP server that exposes OpenAI (GPT), xAI (Grok), and Google
(Gemini) as tools Claude/Cowork can call directly — built because none of
those three publish their own hosted MCP server the way Perplexity does.

## Tools it exposes

- `ask_gpt` — OpenAI GPT text/coding second opinion
- `ask_grok_trends` — Grok with live web/X search, for real-time trends and marketing research
- `ask_gemini` — Gemini text second opinion / large-context reasoning
- `generate_image` — image generation via OpenAI or Gemini, for mockups/marketing graphics

## How auth works here

Cowork's "Add custom connector" screen only takes a URL — no header field,
no API-key field. So instead of a Bearer token header, this server checks
a secret token that's baked into the URL path itself:
`https://your-app.onrender.com/mcp/<MCP_ACCESS_TOKEN>`

Treat that full URL like a password — anyone who has it can call your
OpenAI/xAI/Gemini keys and run up your bill. Don't post it publicly.

## 1. Get your three API keys

- **OpenAI**: platform.openai.com → API keys → create new secret key. Requires billing set up (pay-as-you-go).
- **xAI (Grok)**: console.x.ai → API Keys. Requires billing/credits.
- **Google Gemini**: aistudio.google.com/apikey — has a free tier to start.

## 2. Generate your access token

```
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```
Save this — it's `MCP_ACCESS_TOKEN` below and becomes part of your connector URL.

## 3. Deploy to Render (free tier)

1. Push this folder to a GitHub repo (can be a new repo, or a subfolder of your Programmer-2026 monorepo).
2. On render.com → New → Web Service → connect the repo.
3. Render should auto-detect `render.yaml`. If not, set manually:
   - Build command: `pip install -r requirements.txt`
   - Start command: `python server.py`
4. In the Render dashboard, add environment variables:
   - `MCP_ACCESS_TOKEN` (from step 2)
   - `OPENAI_API_KEY`
   - `XAI_API_KEY`
   - `GEMINI_API_KEY`
5. Deploy. Render gives you a URL like `https://triggtech-ai-proxy.onrender.com`.
6. Your connector URL is that plus the path:
   `https://triggtech-ai-proxy.onrender.com/mcp/<MCP_ACCESS_TOKEN>`

Note: Render's free tier spins down after inactivity and takes ~30-60s to
wake back up on the next request — the first tool call after idle time may
time out or feel slow. That's normal for the free tier, not a bug.

## 4. Add it to Cowork

Settings → Connectors → Add custom connector → paste the full URL from
step 3.6 (including `/mcp/<token>`) → Continue.

## 5. Test locally before deploying (optional)

```
cp .env.example .env   # fill in real values
pip install -r requirements.txt
export $(cat .env | xargs)
python server.py
```
Server runs on `http://localhost:8000/mcp/<MCP_ACCESS_TOKEN>`.

## Changing models later

Model names for all three providers move fast. If a tool starts failing
with a "model not found" style error, override the model via the
`OPENAI_MODEL` / `XAI_MODEL` / `GEMINI_MODEL` / `*_IMAGE_MODEL` env vars in
Render without touching code.
