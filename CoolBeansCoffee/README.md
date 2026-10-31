# CoolBeans Coffee

A menu website for a made-up coffee shop, built as a practice project with plain HTML and CSS. No frameworks, no JavaScript of its own, no build step.

**Live site:** [cader69.github.io/Programmer-2026/CoolBeansCoffee](https://cader69.github.io/Programmer-2026/CoolBeansCoffee/)

![Screenshot of the CoolBeans Coffee page: a welcome line and a Plan your visit button above the menu, which shows coffee photos, names and prices on a cream card over a dark wooden table, under a dark brown header with Home, About, Products and Contact links](screenshot.jpg)

## What's on the page

- **A short welcome** with one button, **Plan your visit**, that jumps to the opening hours.
- **A menu of ten coffees**, each with a photo, a price and a short description, from a $2.50 espresso to a $4.50 affogato.
- **About, Hours, Contact and Location cards**, two per row on wide screens and one per row on phones. The email address and phone number are links.
- **A frosted-glass header** that stays at the top, with links that glide to each section.
- **Privacy Policy and Terms and Conditions pages** on the same cream paper, linked from the footer.

## How it's built

- **The wooden table is all CSS.** The `body` rule in `stylesheetone.css` stacks four background layers: a dark vignette at the edges, thin seams between planks, slightly different shades from plank to plank, and SVG noise stretched sideways into wood grain. There's no image file.
- **One class for the cream paper.** `.paper` holds the card look (cream background, border, two shadows), so the menu, the info cards and the legal pages all match.
- **Dotted lines join each name to its price.** `.item-info::after` is an empty flex item with `flex: 1` and a dotted bottom border, so it stretches across the gap. `order: 2` on the price moves the price after the line.
- **The info cards rearrange without a media query.** `grid-template-columns: repeat(auto-fit, minmax(min(320px, 100%), 1fr))` fits two cards per row when there's room and one when there isn't.
- **The header stays put without hiding anything.** `position: sticky` keeps the header's own space in the page, where a `fixed` header would sit on top of the menu. `scroll-padding-top`, set from one `--header-offset` variable in `rem`, makes nav jumps land just below it, even when a visitor sets bigger text.
- **It's light.** No frameworks, no web fonts and no JavaScript of its own. The page, the stylesheet and all ten photos add up to about 90 KB.

## Accessibility

Checked with axe (WCAG 2.2 AA, 0 violations on every page) and the W3C HTML and CSS validators (0 errors).

- The menu is a real list, so screen readers announce "list, 10 items". `role="list"` keeps it a list in Safari, which drops list semantics once CSS removes the bullets ([MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/list-style#accessibility)).
- The header, main content and footer are separate landmarks, so screen reader users can jump between them.
- Every photo has alt text, plus a `width` and `height` so the page doesn't jump while photos load.
- Text on the cream cards has a 17.6:1 contrast ratio, the lighter descriptions 7.3:1 and the links 9:1. Text on the wood and in the header measures at least 6.9:1.
- A 3px focus ring shows keyboard users where they are: cream on the dark header and the wood, espresso brown on the cream cards.
- If a visitor's device asks for reduced motion, smooth scrolling and transitions turn off.
- With very large text, nav links, prices and long words wrap to the next line instead of running off-screen.
- On short screens (landscape phones, or a browser zoomed to 200-400%), the header scrolls away instead of covering a big slice of the window.
- Footer links are at least 24px tall, so they're easy to tap.

## Run it locally

There's nothing to install. Clone the repo and go to this folder:

```bash
git clone https://github.com/CadeR69/Programmer-2026.git
cd Programmer-2026/CoolBeansCoffee
```

Then open `index.html` in a browser. To test it on a local web server instead, run:

```bash
python3 -m http.server 8000
```

Then visit http://localhost:8000.

## Project structure

```text
CoolBeansCoffee/
├── index.html                 the page: welcome, menu, info cards, footer
├── stylesheetone.css          the styles for every page: wood background, header, cards, phone and accessibility rules
├── privacy-policy.html
├── terms-and-conditions.html
├── sitemap.xml                the three page addresses, for search engines
├── Favicon.png                the icon in the browser tab
├── CREDITS.md                 source, license and photographer for every photo
├── screenshot.jpg             the picture at the top of this README, also the link preview image
└── images/                    the ten menu photos, 190x190 each
```

## Credits

All ten menu photos are CC0 (public domain) from StockSnap, rawpixel and Wikimedia Commons. [CREDITS.md](CREDITS.md) lists the source page, the license and, where known, the photographer for each one.

The shop is fictional. Its address, phone number and email are placeholders.

## What's next

- [ ] Add the GoatCounter visitor counter. The privacy policy already describes it.
- [ ] Highlight the nav link for the section on screen.
