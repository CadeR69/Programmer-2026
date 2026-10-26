# TriggTech Tailwind starter

The starting point for new client sites: Tailwind CSS v4 with the bluegrass brand tokens already set up.

## New client site
```bash
cp -r ~/Programmer-2026/tailwind-starter ~/Website_Production/<client-name>
cd ~/Website_Production/<client-name>
npm install
npm run dev      # rebuilds dist/css/styles.css each time you save; open dist/index.html with Live Server
```
Edit the HTML in `src/`, not in `dist/`. `dist/` gets rebuilt.

## Brand
All the tokens live in `src/css/input.css` under `@theme`. Change the hex values for each client and keep the names, and every `bg-accent`, `text-ink`, etc. updates with them.
Shared pieces: `.btn-primary` and `.card`.

## Ship
1. In `package.json`, set `--project-name` in the `deploy` script to the client's Cloudflare Pages project. Never reuse `triggtech-web`, because that deploy wipes the business site.
2. `npm run deploy`

The build copies into `dist/` and never deletes anything there, so a Google verification file you drop into `dist/` survives every deploy.

## VS Code
Install the "Tailwind CSS IntelliSense" extension to get class autocomplete.
