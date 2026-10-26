#!/usr/bin/env python3
"""Solanki Atelier — pre-launch check.

Run from the site root:   python3 _source/check.py

Fails loudly on the things that are cheap to break and expensive to ship:
colour contrast below WCAG AA, dead internal links and anchors, missing alt
text, and missing per-page SEO tags.
"""
import os, re, sys, html
from html.parser import HTMLParser

ROOT = os.path.dirname(os.path.abspath(os.path.join(__file__, "..")))
PAGES = ["index.html", "privacy.html", "terms.html", "404.html"]
fails, warns = [], []


def fail(where, msg):
    fails.append("%s: %s" % (where, msg))


def warn(where, msg):
    warns.append("%s: %s" % (where, msg))


# ── 1. Colour contrast (WCAG 2.1 relative luminance) ─────────────
def lum(hexstr):
    c = hexstr.lstrip("#")
    out = []
    for i in (0, 2, 4):
        v = int(c[i:i + 2], 16) / 255.0
        out.append(v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4)
    return 0.2126 * out[0] + 0.7152 * out[1] + 0.0722 * out[2]


def ratio(fg, bg):
    a, b = lum(fg), lum(bg)
    hi, lo = max(a, b), min(a, b)
    return (hi + 0.05) / (lo + 0.05)


BLUSH, CREAM, GOLD = "#f7e9e7", "#fff9f3", "#b98a45"
GOLD_INK, ESPRESSO, STONE = "#856331", "#27201e", "#716864"
CREAM_DIM = "#b6aaa2"
HERO_DARKEST, HERO_LIGHTEST = "#1c1614", "#332a27"

# (label, fg, bg, min_ratio). 3.0 is the AA floor for >=24px / >=19px bold.
PAIRS = [
    ("body copy on cream", STONE, CREAM, 4.5),
    ("body copy on blush", STONE, BLUSH, 4.5),
    ("heading on cream", ESPRESSO, CREAM, 4.5),
    ("heading on blush", ESPRESSO, BLUSH, 4.5),
    ("eyebrow / price on cream", GOLD_INK, CREAM, 4.5),
    ("eyebrow on blush", GOLD_INK, BLUSH, 4.5),
    ("nav link on cream", ESPRESSO, CREAM, 4.5),
    ("faq question on cream", ESPRESSO, CREAM, 4.5),
    ("faq question hover", GOLD_INK, CREAM, 4.5),
    ("step number ring on blush", GOLD_INK, BLUSH, 3.0),
    ("step number text on blush", GOLD_INK, BLUSH, 4.5),
    ("primary button label", CREAM, ESPRESSO, 4.5),
    ("h1 on hero (darkest stop)", CREAM, HERO_DARKEST, 4.5),
    ("h1 on hero (lightest stop)", CREAM, HERO_LIGHTEST, 4.5),
    ("hero lede on hero", CREAM_DIM, HERO_LIGHTEST, 4.5),
    ("gold eyebrow on espresso", GOLD, ESPRESSO, 4.5),
    ("footer body on espresso", CREAM_DIM, ESPRESSO, 4.5),
    ("footer heading on espresso", CREAM, ESPRESSO, 4.5),
    ("cookie banner text", CREAM_DIM, ESPRESSO, 4.5),
    ("quote text on espresso", CREAM, ESPRESSO, 3.0),
    ("focus ring on cream", GOLD_INK, CREAM, 3.0),
    ("focus ring on espresso", GOLD, ESPRESSO, 3.0),
]
print("── contrast ─────────────────────────────────────────")
for label, fg, bg, need in PAIRS:
    r = ratio(fg, bg)
    ok = r >= need
    print("  %-34s %5.2f:1  need %.1f  %s" % (label, r, need, "ok" if ok else "FAIL"))
    if not ok:
        fail("contrast", "%s is %.2f:1, needs %.1f:1" % (label, r, need))


# ── 2. Parse pages ───────────────────────────────────────────────
class Page(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.links, self.imgs, self.ids = [], [], set()
        self.metas, self.links_rel = {}, {}
        self.title = None
        self._in_title = False
        self.labels, self.inputs = [], []
        self.h1 = 0
        self.langs = []
        self.buttons = 0

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if a.get("id"):
            self.ids.add(a["id"])
        if tag == "a" and a.get("href"):
            self.links.append(a["href"])
        if tag in ("link",) and a.get("rel") and a.get("href"):
            self.links_rel[" ".join(a["rel"].split())] = a["href"]
        if tag == "script" and a.get("src"):
            self.imgs.append(("script", a["src"], None))
        if tag == "img":
            self.imgs.append(("img", a.get("src"), a.get("alt")))
        if tag == "meta":
            key = a.get("name") or a.get("property")
            if key:
                self.metas[key] = a.get("content", "")
        if tag == "title":
            self._in_title = True
        if tag == "h1":
            self.h1 += 1
        if tag == "label":
            self.labels.append(a.get("for"))
        if tag in ("input", "select", "textarea"):
            self.inputs.append(a)
        if tag == "html" and a.get("lang"):
            self.langs.append(a["lang"])

    def handle_endtag(self, tag):
        if tag == "title":
            self._in_title = False

    def handle_data(self, data):
        if self._in_title:
            self.title = (self.title or "") + data


parsed = {}
for name in PAGES:
    path = os.path.join(ROOT, name)
    if not os.path.exists(path):
        fail(name, "file missing")
        continue
    p = Page()
    p.feed(open(path, encoding="utf-8").read())
    parsed[name] = p

# ── 3. Links, anchors, assets ────────────────────────────────────
print("\n── links ────────────────────────────────────────────")
external, checked = set(), 0
for name, p in parsed.items():
    targets = list(p.links) + [v for v in p.links_rel.values()]
    targets += [src for _, src, _ in p.imgs if src]
    for href in targets:
        checked += 1
        if href.startswith(("http://", "https://")):
            external.add(href)
            continue
        if href.startswith(("mailto:", "tel:")):
            continue
        if href.startswith("#"):
            anchor = href[1:]
            if anchor and anchor not in p.ids:
                fail(name, "dead in-page anchor %s" % href)
            continue
        file_part, _, frag = href.partition("#")
        if file_part in ("", "/"):
            file_part = "index.html"
        target = os.path.join(ROOT, file_part)
        if not os.path.exists(target):
            fail(name, "dead link -> %s" % href)
        elif frag:
            if file_part in parsed:
                if frag not in parsed[file_part].ids:
                    fail(name, "dead cross-page anchor -> %s" % href)
            else:
                warn(name, "anchor into unparsed file %s" % href)
print("  %d references checked across %d pages" % (checked, len(parsed)))
print("  external (not fetched, verify by hand):")
for u in sorted(external):
    print("    - %s" % u)

# ── 4. Images ────────────────────────────────────────────────────
print("\n── images ───────────────────────────────────────────")
for name, p in parsed.items():
    for kind, src, alt in p.imgs:
        if kind != "img":
            continue
        if alt is None:
            fail(name, "<img src=%s> has no alt attribute" % src)
        elif alt.strip() == "":
            print("  %-12s %-34s alt=\"\" (decorative)" % (name, src))
        else:
            print("  %-12s %-34s alt ok (%d chars)" % (name, src, len(alt)))

# ── 5. Per-page SEO + a11y invariants ────────────────────────────
print("\n── page metadata ────────────────────────────────────")
for name, p in parsed.items():
    t = (p.title or "").strip()
    d = p.metas.get("description", "").strip()
    if not t:
        fail(name, "no <title>")
    elif len(t) > 65:
        warn(name, "title is %d chars, Google truncates near 60" % len(t))
    if not d:
        fail(name, "no meta description")
    elif not (50 <= len(d) <= 165):
        warn(name, "meta description is %d chars (aim 50-165)" % len(d))
    if p.h1 != 1:
        fail(name, "found %d <h1>, expected exactly 1" % p.h1)
    if p.langs != ["en"]:
        fail(name, "html lang is %r" % p.langs)
    if "icon" not in p.links_rel:
        fail(name, "no favicon link")
    noindex = "noindex" in p.metas.get("robots", "")
    if not noindex and "canonical" not in p.links_rel:
        fail(name, "no canonical URL")
    if noindex and "canonical" in p.links_rel:
        fail(name, "noindex page should not declare a canonical")
    for prop in ("og:title", "og:description", "og:image", "og:image:alt"):
        if prop not in p.metas:
            fail(name, "missing %s" % prop)
    if not noindex and "og:url" not in p.metas:
        fail(name, "missing og:url")
    if p.metas.get("twitter:card") == "summary_large_image" and "twitter:image" not in p.metas:
        fail(name, "twitter:card promises an image but twitter:image is absent")
    print("  %-12s title %d chars, description %d chars, h1 x%d%s"
          % (name, len(t), len(d), p.h1, ", noindex" if noindex else ""))

# ── 6. Booking path ──────────────────────────────────────────────
# Salon Elite is booth rental: no shared diary, no front desk, so the site
# deliberately has no contact form. The booking contract is instead a phone
# number and the Facebook page. If a form is ever added back, the original
# label/honeypot checks below still apply to it.
print("\n── booking path ─────────────────────────────────────")
PHONE_DIGITS = "+12708047272"
PHONE_TEXT = "804"

idx = parsed.get("index.html")
if idx:
    body = open(os.path.join(ROOT, "index.html"), encoding="utf-8").read()
    tel = [h for h in idx.links if h.startswith("tel:")]
    fb = [h for h in idx.links if "facebook.com" in h]
    if not tel:
        fail("index.html", "no tel: link — the primary booking route is missing")
    if not fb:
        fail("index.html", "no Facebook link — the secondary booking route is missing")
    print("  %d tel: link(s), %d Facebook link(s)" % (len(tel), len(fb)))

    details = body.count("<summary>")
    if details < 3:
        warn("index.html", "FAQ has only %d entries; it is there to cut inbound calls" % details)
    else:
        print("  FAQ: %d questions answered" % details)

    forms = re.findall(r"<form\b", body)
    if forms:
        print("  form present — checking wiring")
        labelled = {l for l in idx.labels if l}
        for a in idx.inputs:
            iid, itype = a.get("id"), a.get("type", "text")
            if itype == "hidden":
                continue
            if not iid:
                fail("index.html", "form control with no id (%r)" % a)
            elif iid not in labelled:
                fail("index.html", "control #%s has no <label for>" % iid)
        if 'class="hp"' not in body:
            fail("index.html", "form present but no honeypot spam trap")
        if "YOUR_FORM_ID" in body:
            warn("index.html", "form endpoint is still the placeholder YOUR_FORM_ID")
    else:
        print("  no form (booth rental — bookings go to the stylist)")

# Every published phone number must agree with every tel: href. A typo in a
# real business's number is silent and expensive.
tel_hrefs, shown = set(), set()
for name, page in parsed.items():
    src = open(os.path.join(ROOT, name), encoding="utf-8").read()
    for h in page.links:
        if h.startswith("tel:"):
            tel_hrefs.add(h.replace("tel:", "").replace(" ", ""))
    for m in re.findall(r"\(?270\)?[\s\u00a0.-]*804[\s\u00a0\u2011.-]*7272", src):
        shown.add(re.sub(r"[^0-9]", "", m))
if len(tel_hrefs) > 1:
    fail("phone", "tel: links disagree: %s" % sorted(tel_hrefs))
elif tel_hrefs:
    only = tel_hrefs.pop()
    if only != PHONE_DIGITS:
        fail("phone", "tel: link is %s, expected %s" % (only, PHONE_DIGITS))
    else:
        print("  tel: href consistent everywhere (%s)" % only)
if shown and shown != {"2708047272"}:
    fail("phone", "displayed number(s) do not match: %s" % sorted(shown))
elif shown:
    print("  displayed number matches the tel: href")

# ── 7. Supporting files ──────────────────────────────────────────
print("\n── files ────────────────────────────────────────────")
for f in ("robots.txt", "sitemap.xml", "_headers", "favicon.svg",
          "stylesheet-1.css", "scripts.js", "images/social-preview.png",
          "fonts/inter.woff2", "fonts/cormorant-garamond.woff2"):
    ok = os.path.exists(os.path.join(ROOT, f))
    print("  %-34s %s" % (f, "ok" if ok else "MISSING"))
    if not ok:
        fail("files", "%s missing" % f)

# sitemap URLs must resolve to real files
sm = os.path.join(ROOT, "sitemap.xml")
if os.path.exists(sm):
    for loc in re.findall(r"<loc>([^<]+)</loc>", open(sm, encoding="utf-8").read()):
        rel = loc.split("/", 3)[-1] if loc.count("/") > 2 else ""
        rel = rel or "index.html"
        if not os.path.exists(os.path.join(ROOT, rel)):
            fail("sitemap.xml", "lists %s but %s does not exist" % (loc, rel))
        if "404" in rel:
            fail("sitemap.xml", "must not list the 404 page")

# ── Result ───────────────────────────────────────────────────────
print("\n" + "=" * 54)
for w in warns:
    print("WARN  " + w)
for f in fails:
    print("FAIL  " + f)
print("=" * 54)
print("%d failures, %d warnings" % (len(fails), len(warns)))
sys.exit(1 if fails else 0)
