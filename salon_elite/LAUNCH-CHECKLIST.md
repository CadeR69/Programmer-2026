# Salon Elite — Pre-Launch Checklist

Run date: 22 September 2026
Site: `salon_elite/` — static HTML/CSS, no build step, no framework.
Business: SALON ELITE, 339 Charles Dr, Mayfield, KY 42066 · (270) 804-7272
Verified in Chromium at 320 / 375 / 390 / 1280 / 1440 px.

```
cd salon_elite && npm install && npm run verify
```

`verify` runs the whole gate and exits non-zero if anything fails:

| Check                               | Tool                                    | Result                                  |
| ----------------------------------- | --------------------------------------- | --------------------------------------- |
| Formatting                          | Prettier                                | clean                                   |
| HTML validity                       | html-validate                           | 0 errors                                |
| CSS                                 | stylelint (standard)                    | 0 errors                                |
| JavaScript                          | ESLint (recommended)                    | 0 errors                                |
| Contrast, links, alt text, SEO tags | `_source/check.py`                      | 0 failures, 1 warning (item 17)         |
| Accessibility                       | axe-core, WCAG 2.1 A/AA + best practice | **0 violations**, 4 pages × 2 viewports |
| Deployable bundle                   | `_source/build.mjs`                     | `dist/`, 18 files, 499 KB               |

Beyond the tool run, the built `dist/` was served **with the production CSP
from `_headers` actually enforced** and loaded in a real browser: no violations,
no blocked resources, fonts, styles, script and form validation all working.
That is the check that catches a CSP mistake before a host does.

---

## Where the business facts came from

Everything factual on this site is sourced, not invented. Nothing was taken on a
single source alone except where noted.

| Fact                                                | Source                                                                      |
| --------------------------------------------------- | --------------------------------------------------------------------------- |
| Name, address, phone                                | Salon Elite's own Facebook page, confirmed by Yelp, MapQuest, Manta, Fresha |
| ZIP 42066                                           | Facebook "About", MapQuest (42066-4900)                                     |
| Nine stylists, by name                              | Salon Elite's Facebook page intro, captured 22 Sep 2026                     |
| Services (haircuts, styling, colouring, treatments) | MapQuest listing description                                                |
| 96% recommend, 297 reviews                          | Facebook page, captured 22 Sep 2026                                         |
| Mon–Fri 9–5, Sun closed                             | Fresha **and** MapQuest agree                                               |
| Saturday hours                                      | **SOURCES CONFLICT — see item A below**                                     |

---

## Scoreboard

| #   | Item                  | Status                                         |
| --- | --------------------- | ---------------------------------------------- |
| 1   | Privacy policy        | Done — needs legal review                      |
| 2   | Terms and conditions  | Done — **salon must supply its real policies** |
| 3   | HTTPS                 | **Needs you** — hosting decision               |
| 4   | Cookie consent banner | Done — built, inert by design                  |
| 5   | Meta titles           | Done                                           |
| 6   | Meta descriptions     | Done                                           |
| 7   | Social preview image  | Done                                           |
| 8   | Favicon               | Done                                           |
| 9   | sitemap.xml           | Done — needs real domain                       |
| 10  | robots.txt            | Done — needs real domain                       |
| 11  | Alt text              | Done                                           |
| 12  | Image compression     | Done                                           |
| 13  | Colour contrast       | Done                                           |
| 14  | Mobile friendly       | Done — one further fix this pass               |
| 15  | Page load speed       | Done — 100 KB, 7 requests                      |
| 16  | Custom 404 page       | Done                                           |
| 17  | Form validation       | **N/A** — no form (booth rental)               |
| 18  | Spam protection       | **N/A** — no form, no spam surface             |
| 19  | Analytics             | **Needs you** — account decision               |
| 20  | Clear call-to-action  | Done — "Call (270) 804-7272"                   |

**15 done, 2 N/A with reason, 3 need a decision from you** — plus the
business facts to confirm with the salon (A–D below).

---

## A–D: confirm with the salon before this goes live

**A. Saturday hours — sources disagree, so the site does not state them.**
Fresha lists Saturday 9am–1pm. MapQuest lists Saturday 9am–5pm. Monday–Friday
(9–5) and Sunday (closed) agree across both. Rather than print a guess that
sends someone to a locked door, the site currently says **"Saturday, call to
confirm"**. Get the real hours and replace that line in `index.html` (visit
section and footer) and in `_source/genpages.py`, then re-run genpages.

**B. The stylist roster.** Nine names are listed, taken from the salon's own
Facebook intro. Staff lists go stale fast — confirm nobody has joined or left.

**C. There is no published email address.** I could not find one, so the site
does not claim one: contact is phone, Facebook, and the form. If the salon has
an email, add it to the contact list in `index.html` and to `privacy.html`.

**D. No prices are published anywhere, deliberately.** Salon Elite's public
price range is "$" and nine stylists set their own rates. Any figure printed
here would have been made up, and misrepresenting a real business's prices is
worse than showing none. The site says pricing is given when you call.

---

## Legal and trust

**1. Privacy policy — done, needs legal review.** `privacy.html`. Describes
what the build actually does, which is very little: no cookies, no analytics,
no third-party requests — verified in the browser, not assumed. Rights section
references the Kentucky Consumer Data Privacy Act rather than California, since
the business is in Kentucky. Accurate to the code, **not attorney-reviewed**.

**2. Terms — done, but the salon must supply its real policies.**
`terms.html` deliberately contains **no deposit amounts, no cancellation window,
no patch-test timing and no refund period**. The earlier draft had invented
numbers (a 48-hour window, a 7-day remedy period); for a real business those are
commercial policies I have no way to know, and publishing them would put words in
the salon's mouth and mislead their clients. The page now says these are
confirmed when you book. Get the real ones and fill them in.
Governing law is set to Kentucky.

**3. HTTPS — needs you.** Hosting/certificate decision. `_headers` is ready with
HSTS and `upgrade-insecure-requests`; works as-is on Netlify or Cloudflare Pages.

**4. Cookie consent banner — done, deliberately inert.** Hidden while
`ANALYTICS_ID` in `scripts.js` is empty. Tested with a dummy ID: before any
choice the banner shows and the tag does **not** load; Decline keeps it unloaded;
Accept loads it. Consent key is `se-consent`.

## SEO and discoverability

**5 & 6. Titles and descriptions — done.** Unique per page, 28–46 and 52–150
chars. `404.html` is `noindex` with no canonical.

**7. Social preview image — done.** `images/social-preview.png`, 1200×630,
rendered from `_source/og-card.html` in the site's own fonts, now carrying the
real name, town, services and phone number. Regenerate by serving the site and
screenshotting that page at 1200×630. 313 KB, but crawler-only — it never
affects visitor page speed.

**8. Favicon — done.** `favicon.svg`.

**9 & 10. sitemap.xml and robots.txt — done**, pending the domain.

## Accessibility and media

**11. Alt text — done.** Five images, each described. Note the alt text says
"Illustration of…" because that is what they are — see the note at the end.

**12. Image compression — done.** All artwork is SVG, 1.1–2.9 KB each.

**13. Colour contrast — done.** 22 pairs measured, all pass WCAG AA. (Last pass
fixed placeholder text from 3.01:1 to 4.55:1.)

**14. Mobile friendly — done.** No horizontal scroll at 320/375/390. The privacy
table scrolls inside its own container rather than dragging the page sideways.

> **Fixed this pass:** the consent checkbox was 22×22, two pixels under the
> WCAG 2.5.8 minimum target of 24×24. Now 24×24.
>
> Also this pass: four service cards were landing 3-on-one-row-plus-1-stranded,
> and nine stylists were landing 4+4+1. Both now use explicit column counts
> (4 and 3) so neither leaves an orphan.

Earlier passes fixed: a consent checkbox that showed no checkmark when ticked
(`appearance:none` stripped its native rendering), a consent error crushed into a
55px flex column, and three tap targets under 24px.

**15. Page load speed — done.** **100 KB gzipped, 7 requests**, no third parties.
85 KB of that is the two self-hosted fonts — which is also why no visitor data
reaches Google Fonts.

## Pages and forms

**16. Custom 404 — done.** Its second CTA is now "Call (270) 804-7272".
_Your host must be told to serve it_ — automatic on Netlify/Cloudflare Pages;
Apache needs `ErrorDocument 404 /404.html`.

**17 & 18. Form validation and spam protection — N/A, and that is the point.**

The contact form has been removed. Salon Elite is **booth rental**: each
stylist rents their chair and books their own clients, so there is no shared
diary and no front desk. A central web form would have landed in one person's
inbox — probably the owner's — asking her to schedule for eight independent
businesses whose calendars she cannot see. Unanswered messages are worse than
no form, because someone who sends one believes they have booked.

Booking now routes the way the salon actually works:

1. Pick a stylist (all nine are listed on the page)
2. Call (270) 804-7272 and ask for them by name, or message the Facebook page
3. The stylist confirms directly and keeps it in their own book

The salon's own Yelp listing says the same thing — _"Book by messaging us on
Facebook or Instagram."_ With no form there is no validation to do and no spam
surface to protect, so `form-action` and `connect-src` in the CSP are now
locked to `'none'`.

A **six-question FAQ** was added to cut the calls that are just questions:
how to book, asking for a stylist, cost, hours, walk-ins, and where the salon
is. It uses native `<details>`, so it costs no JavaScript and is keyboard
accessible by default.

If a form is ever wanted again, `_source/check.py` still contains the label,
honeypot and endpoint checks and will apply them automatically.

**19. Analytics — needs you.** Not installed. One line in `scripts.js`;
`_headers` carries a ready-made CSP line to paste when you do.

**20. Clear call-to-action — done.** "Call to book" / "Call (270) 804-7272" in
the header, hero, 404 and visit section.

---

## Before you publish

1. **Domain.** Replace every `https://www.salonelitemayfield.com` (a placeholder
   — I could not find a real domain for the salon) across `index.html`,
   `privacy.html`, `terms.html`, `404.html`, `robots.txt`, `sitemap.xml` and
   `_source/genpages.py`.
2. **Confirm A–D above** with the salon.
3. **Permission.** This site presents a real, operating business, using its name,
   address, phone number, staff names and review figures. If it is going to be
   published, the salon should see it and agree to it first.

## Tooling notes

Three linter defaults are switched off on purpose, each recorded with its reason
in `stylelint.config.mjs`. They are off because applying them would cost real
browser support, not because they were noisy:

- `property-no-vendor-prefix` — Safari still needs `-webkit-backdrop-filter`,
  and iOS needs `-webkit-text-size-adjust` to stop inflating text in landscape.
- `media-feature-range-notation` — `(width >= 900px)` needs Safari 16.4+;
  `(min-width: 900px)` works everywhere.
- `selector-not-notation` — `:not(a, b)` needs Safari 16.4+; `:not(a):not(b)`
  does not.

Prettier and html-validate also disagreed on DOCTYPE case, which would have made
the two fight on every run. Prettier wins, and `.htmlvalidate.json` pins
`doctype-style` to lowercase so the rule still enforces consistency.

## What I did not invent

- **No testimonials.** Publishing fabricated reviews would breach the FTC's rule
  on fake endorsements (16 CFR Part 465). The real aggregate (96% of 297) is
  shown instead, attributed and dated, with a link to the source.
- **No prices.** See D.
- **No deposit or cancellation terms.** See item 2.
- **No photographs.** The artwork is original illustration; alt text says so.
  The salon posts real work to Facebook daily and the site links there. To use
  real photos, replace each `src` with a `.jpg`/`.webp`, keep `width`/`height`,
  and write true alt text.
