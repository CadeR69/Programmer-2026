# Salon Elite — website

Static marketing site for **Salon Elite**, 339 Charles Dr, Mayfield, KY 42066.
No framework, no bundler, no runtime dependencies. Four HTML pages, one
stylesheet, one script, self-hosted fonts.

> **Before this goes live**, read `LAUNCH-CHECKLIST.md`. Three items need a
> decision (HTTPS host, form endpoint, analytics) and four business facts need
> confirming with the salon. The site also presents a real, operating business
> — they should see it and agree to it before it is published.

## Quick start

```bash
npm install     # dev tooling only; the site itself has no dependencies
npm run serve   # http://127.0.0.1:8765
```

## Commands

| Command               | What it does                                                        |
| --------------------- | ------------------------------------------------------------------- |
| `npm run verify`      | Everything below, in order. Run this before deploying.              |
| `npm run lint`        | Formatting, HTML, CSS, JS and site-integrity checks                 |
| `npm run lint:a11y`   | axe-core (WCAG 2.1 A/AA + best practice), 4 pages × 2 viewports     |
| `npm run build`       | Writes `dist/` — the exact files to upload                          |
| `npm run format`      | Rewrites files to the Prettier style                                |
| `npm run build:pages` | Regenerates the legal pages (see below), formats and validates them |

`npm run lint:site` runs `_source/check.py`, which fails on colour contrast
below WCAG AA, dead links or anchors, missing alt text, and missing per-page
SEO tags. `lint:a11y` uses the system Chrome via `playwright-core`, so there is
no browser download.

## Deploying

```bash
npm run verify
# then upload the contents of dist/
```

`dist/` contains only what a visitor or crawler can request — 18 files, ~500 KB.
Do not publish the project root: it contains `node_modules/`, the linter
configs, `_source/` and the internal launch checklist.

**Netlify / Cloudflare Pages** — build command `npm run build`, publish
directory `dist`. `_headers` is picked up automatically and sets the CSP, HSTS
and the cache policy; the 404 page is served automatically.

**Apache / nginx** — upload `dist/`, then translate `_headers` yourself
(`.htaccess` or `add_header`) and point the 404 handler at `404.html`
(`ErrorDocument 404 /404.html`).

Either way the site must be served over HTTPS: `_headers` sends HSTS with
`preload`, and the CSP sets `upgrade-insecure-requests`.

## Layout

```
index.html  privacy.html  terms.html  404.html
stylesheet-1.css      design system; tokens at the top, sections below
scripts.js            nav, form validation, consent gate — progressive enhancement
images/  fonts/       SVG artwork, social card, two self-hosted variable fonts
_headers              CSP, HSTS, cache policy
_source/              not deployed — tooling and the original Framer export
```

### `_source/`

| File                                        | Purpose                                                            |
| ------------------------------------------- | ------------------------------------------------------------------ |
| `check.py`                                  | Contrast, links, alt text and SEO checks                           |
| `a11y.mjs`                                  | axe-core audit                                                     |
| `build.mjs`                                 | Produces `dist/`                                                   |
| `genpages.py`                               | Generates `privacy.html`, `terms.html`, `404.html`                 |
| `og-card.html`                              | Source for `images/social-preview.png` — screenshot it at 1200×630 |
| `initial*.html`, `framer-generated.css.bak` | The original Framer export, kept for reference                     |

**The three legal/error pages are generated.** Edit `_source/genpages.py` and
run `npm run build:pages` — editing those HTML files directly will be
overwritten. `index.html` is hand-written and is not generated.

## Things that will bite you

- **`appearance: none` and checkboxes.** The base input rule deliberately
  excludes `[type="checkbox"]` and `[type="radio"]`. Including them strips the
  native checkmark and a ticked consent box becomes indistinguishable from an
  empty one.
- **Vendor prefixes are deliberate.** `stylelint.config.mjs` disables
  `property-no-vendor-prefix`: Safari still needs `-webkit-backdrop-filter`,
  and iOS needs `-webkit-text-size-adjust` to stop inflating text in landscape.
- **Prettier and html-validate disagreed on DOCTYPE case.** Prettier wins;
  `.htmlvalidate.json` pins `doctype-style` to lowercase so they cannot fight.
- **Analytics is one line, plus a CSP change.** Set `ANALYTICS_ID` in
  `scripts.js`; `_headers` carries the replacement CSP line to paste in. Until
  then the consent banner stays hidden because nothing sets a cookie.
- **There is no contact form, on purpose.** Salon Elite is booth rental —
  each stylist books their own clients, so there is no shared diary and a
  central web inbox would sit unread on one person's phone. Booking routes to
  the stylist by phone or Facebook. `form-action` and `connect-src` are
  therefore `'none'` in the CSP; if you ever add a form, both must name its
  host or the POST is blocked.
- **Cache headers assume filenames are not content-hashed.** Fonts are
  `immutable`; images get a week; CSS and JS revalidate every visit. Do not
  mark CSS/JS immutable unless you start hashing their filenames — returning
  visitors would be stuck on a stale stylesheet.
