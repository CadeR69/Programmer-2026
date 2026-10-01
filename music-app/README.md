# Cadence

A private, offline-first music player for your own music files. One web app (PWA) that installs on your
iPhone and your laptop, backed by your own Cloudflare account.

- **Offline is the point.** Tap Download on a song, album or playlist and it is stored on the device. The app
  shell, your library, playlists and downloaded audio all work with no connection at all.
- **Your cloud, your files.** Music lives in a private Cloudflare R2 bucket. A small Worker handles sign-in and
  syncs the library and playlists between devices.
- **Single user.** One password. Nothing is public.
- **Plays files you provide.** It does not fetch anything from streaming services.

```
iPhone / laptop (PWA)                          Cloudflare
┌──────────────────────────┐   HTTPS    ┌────────────────────────────┐
│ UI + service worker      │ ─────────▶ │ Worker  (src/worker.js)    │
│ IndexedDB: library,      │            │   /api/*  auth, sync, range│
│   playlists, player state│            │   static assets (public/)  │
│ Cache API: downloaded    │ ◀───────── │ D1: tracks, playlists      │
│   audio + cover art      │   audio    │ R2: audio + cover files    │
└──────────────────────────┘            └────────────────────────────┘
```

## Cost

R2 storage is about $0.015 per GB-month with no download fees (first 10 GB free). A 10–50 GB library is
roughly $0.15–$0.75 a month. Workers and D1 stay inside the free tier for one person.

## One-time setup (about 10 minutes, from your laptop)

1. In the Cloudflare dashboard, enable **R2** (it asks for a payment method; the free tier still applies).
2. In this folder:
   ```sh
   npm install
   npx wrangler login
   npx wrangler r2 bucket create cadence-music
   npx wrangler d1 create cadence
   ```
   Copy the `database_id` that the last command prints into `wrangler.jsonc`.
3. Create the tables and set your secrets:
   ```sh
   npm run db:init:remote
   npx wrangler secret put APP_PASSWORD      # the password you will sign in with
   npx wrangler secret put AUTH_SECRET       # any long random string: openssl rand -base64 32
   ```
4. Deploy:
   ```sh
   npm run deploy
   ```
   Wrangler prints your URL, like `https://cadence-music.<your-subdomain>.workers.dev`.

To ship changes later, just run `npm run deploy` again.

## Using it

**Add music (laptop is easiest).** Open the site, sign in, go to **More → Add music**, and choose files or a
folder. Tags and cover art are read in the browser. MP3, M4A, AAC, FLAC and WAV, up to 100 MB per file.

**Big library? Use rclone.** Browser uploads are one file at a time. For tens of GB, copy straight into the
bucket instead. Create an R2 API token (R2 → Manage API tokens), then:
```sh
rclone config   # new remote "r2": type s3, provider Cloudflare, paste the token's keys and your account endpoint
rclone copy ~/Music r2:cadence-music/import --progress
```
Then open **More → Import from bucket**. Tracks are named from your folders (`Artist/Album/01 Title.mp3`).

**Install on iPhone.** Open the site in Safari → Share → **Add to Home Screen**, then launch it from the new
icon. Sign in once while online, then on Wi-Fi tap **Download** on what you want offline. Check the
**Downloads** tab and try airplane mode before you rely on it.

## iPhone things to know

- Safari plays MP3, AAC/M4A, WAV and FLAC. It does not play OGG/Opus.
- iOS can clear a web app's stored data when the phone is very low on space. Installing to the Home Screen
  and the app's storage request make that much less likely, but it is not a guarantee. If it ever bites,
  the same code can be wrapped as a native app (Capacitor) with sturdier storage.
- Lock-screen controls and background playback use the Media Session API. Test them on your own phone.

## Security

- Sign-in is one password checked in constant time; 10 wrong attempts in 15 minutes blocks that address.
- Sessions last 90 days (so the phone stays signed in offline) and are revoked by changing `AUTH_SECRET`.
- The R2 bucket is never public. Audio is served only through the Worker, to a signed-in session or a
  6-hour signed link.
- For another layer, put the site behind Cloudflare Access (free for a few users).

## Local development

```sh
npm install
printf 'APP_PASSWORD=dev-password\nAUTH_SECRET=dev-secret-change-me\n' > .dev.vars   # git-ignored
npm run db:init:local
npm run dev            # http://localhost:8787 with simulated R2 and D1
npm test               # API checks against the running dev server
```
`npm test` trips the login throttle on purpose; run `npm run db:unlock:local` before signing in from a browser.

## Layout

```
src/worker.js        API: login, library, upload, range streaming, covers, playlist sync, bucket import
schema.sql           D1 tables
wrangler.jsonc       Worker, assets, R2 and D1 bindings
public/              the PWA (no build step)
  js/core.js         library, playlists, downloads, sync
  js/offline.js      on-device audio + cover storage
  js/player.js       playback engine, queue, lock-screen controls
  js/views.js        screens
  sw.js              service worker (app shell offline)
tests/api.mjs        API test script
```
