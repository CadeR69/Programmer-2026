# -*- coding: utf-8 -*-
"""Builds privacy.html, terms.html and 404.html from one shared shell so the
header, footer and legal links can never drift apart between pages.

Run from the site root:  python3 _source/genpages.py
"""
import os

SITE = "https://www.salonelitemayfield.com"   # ⚠ placeholder — see LAUNCH-CHECKLIST.md
OUT = os.path.dirname(os.path.abspath(os.path.join(__file__, "..")))
UPDATED = "22 September 2026"
FB = "https://www.facebook.com/p/SALON-ELITE-100054479139254/"

HEAD = """<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />

    <title>{title}</title>
    <meta name="description" content="{desc}" />
    <meta name="theme-color" content="#27201e" />
    <meta name="color-scheme" content="light" />
    <meta name="robots" content="{robots}" />
{canonical}
    <link rel="icon" href="favicon.svg" type="image/svg+xml" />
    <link rel="apple-touch-icon" href="favicon.svg" />

    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Salon Elite" />
    <meta property="og:locale" content="en_US" />
    <meta property="og:title" content="{title}" />
    <meta property="og:description" content="{desc}" />
{ogurl}    <meta property="og:image" content="{site}/images/social-preview.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="Salon Elite — hair salon, Mayfield, Kentucky" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="{title}" />
    <meta name="twitter:description" content="{desc}" />
    <meta name="twitter:image" content="{site}/images/social-preview.png" />

    <link rel="stylesheet" href="stylesheet-1.css" />
  </head>

  <body>
    <a class="skip-link" href="#main">Skip to content</a>

    <header class="header">
      <div class="wrap">
        <nav class="nav" aria-label="Primary">
          <a class="logo" href="index.html">Salon <span>Elite</span></a>

          <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="nav-menu">
            <span class="sr-only">Menu</span>
            <svg class="icon-open" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
              <path d="M3 6h18M3 12h18M3 18h18" stroke-linecap="round" />
            </svg>
            <svg class="icon-close" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
              <path d="M5 5l14 14M19 5L5 19" stroke-linecap="round" />
            </svg>
          </button>

          <ul class="nav-links nav-menu" id="nav-menu">
            <li><a href="index.html#services">Services</a></li>
            <li><a href="index.html#work">Our work</a></li>
            <li><a href="index.html#about">About</a></li>
            <li><a href="index.html#stylists">Stylists</a></li>
            <li><a href="index.html#faq">FAQ</a></li>
            <li><a href="index.html#visit">Visit</a></li>
          </ul>

          <a class="btn btn-primary nav-cta" href="tel:+12708047272">Call&nbsp;to&nbsp;book</a>
        </nav>
      </div>
    </header>

    <main id="main">
"""

FOOT = """    </main>

    <footer class="footer">
      <div class="wrap">
        <div class="footer-grid">
          <div>
            <h2>Salon Elite</h2>
            <p>A hair salon in Mayfield, Kentucky. Haircuts, styling, colour and treatments.</p>
          </div>

          <nav aria-label="Footer">
            <h3>Explore</h3>
            <ul>
              <li><a href="index.html#services">Services</a></li>
              <li><a href="index.html#work">Our work</a></li>
              <li><a href="index.html#about">About</a></li>
              <li><a href="index.html#stylists">Stylists</a></li>
              <li><a href="index.html#faq">FAQ</a></li>
              <li><a href="index.html#visit">Visit</a></li>
            </ul>
          </nav>

          <div>
            <h3>Visit</h3>
            <address>
              339 Charles Dr<br />
              Mayfield, KY 42066<br />
              <a href="tel:+12708047272">(270)&nbsp;804&#8209;7272</a><br />
              <a href="%FB%" rel="noopener">Facebook</a>
            </address>
          </div>

          <div>
            <h3>Hours</h3>
            <ul>
              <li>Monday to Saturday</li>
              <li>Closed Sunday</li>
              <li>Hours vary by stylist</li>
            </ul>
          </div>
        </div>

        <div class="footer-bottom">
          <p>&#169; <span id="year">2026</span> Salon Elite. All rights reserved.</p>
          <ul>
            <li><a href="privacy.html"{cur_priv}>Privacy</a></li>
            <li><a href="terms.html"{cur_terms}>Terms</a></li>
            <li><a href="#main">Back to top</a></li>
          </ul>
        </div>
      </div>
    </footer>

    <aside class="cookie-banner" id="cookie-banner" hidden aria-label="Cookie notice">
      <p>
        We would like to set optional analytics cookies to understand how the site
        is used. No tracking runs until you accept. See our
        <a href="privacy.html">privacy policy</a>.
      </p>
      <div class="cookie-actions">
        <button class="btn btn-ghost" type="button" data-cookie="decline">Decline</button>
        <button class="btn btn-primary" type="button" data-cookie="accept">Accept</button>
      </div>
    </aside>

    <script src="scripts.js" defer></script>
  </body>
</html>
""".replace("%FB%", FB)


def page(fname, title, desc, body, indexed=True, current=None):
    canonical = ('    <link rel="canonical" href="%s/%s" />\n' % (SITE, fname)) if indexed else ""
    ogurl = ('    <meta property="og:url" content="%s/%s" />\n' % (SITE, fname)) if indexed else ""
    head = HEAD.format(
        title=title, desc=desc, site=SITE, canonical=canonical, ogurl=ogurl,
        robots="index, follow" if indexed else "noindex, follow",
    )
    foot = FOOT.format(
        cur_priv=' aria-current="page"' if current == "privacy" else "",
        cur_terms=' aria-current="page"' if current == "terms" else "",
    )
    with open(os.path.join(OUT, fname), "w", encoding="utf-8") as fh:
        fh.write(head + body + foot)
    print("wrote", fname)


# ── Privacy ──────────────────────────────────────────────────────
PRIVACY = """      <!-- LEGAL REVIEW: describes what this build actually does, which is
           now almost nothing: no cookies, no analytics, no forms, no
           third-party requests. Verified in the browser, not assumed.
           Accurate to the code, but not attorney-reviewed. -->
      <div class="page-head">
        <div class="wrap">
          <p class="eyebrow">Legal</p>
          <h1>Privacy policy</h1>
        </div>
      </div>

      <section>
        <div class="wrap">
          <div class="prose">
            <p class="updated">Last updated {updated}.</p>

            <p>
              This policy explains what Salon Elite does with personal
              information in connection with this website. It covers the website
              only &#8212; what your stylist keeps about you as their client is
              separate, and they will explain that at your appointment.
            </p>

            <h2>The short version</h2>
            <ul>
              <li>This website has <strong>no contact form</strong> and collects nothing you type.</li>
              <li>It sets <strong>no cookies</strong> and runs <strong>no analytics</strong> or advertising trackers.</li>
              <li>Fonts and images are served from this site, so no third party sees your visit.</li>
              <li>We do not sell or share personal information.</li>
            </ul>

            <h2>What is collected</h2>
            <p>
              Nothing, by us, through this site. There is no form to fill in and
              nothing is stored in your browser. Booking happens by phone or
              through our Facebook page, not through this website.
            </p>
            <p>
              Our hosting provider keeps standard server logs &#8212; IP address,
              browser, and the page requested &#8212; automatically, for security
              and fault-finding. They are typically kept for under 30 days and we
              do not use them to build a profile of you.
            </p>

            <h2>If you call or message us</h2>
            <p>
              When you call the salon or message us on Facebook to book, your
              stylist keeps the details needed to make and keep the appointment.
              Anything you send through Facebook is also handled under
              Facebook&#8217;s own privacy policy, not this one.
            </p>
            <p>
              Please do not send health information &#8212; allergies,
              medication, skin or scalp conditions &#8212; by message. Tell your
              stylist directly, where it can be recorded properly.
            </p>

            <h2>Cookies and tracking</h2>
            <p>
              As built, this website stores nothing on your device and sets no
              cookies. There is no cookie banner because there is nothing to
              consent to.
            </p>
            <p>
              If analytics are added later, a consent banner will appear first
              and no analytics cookie will be set unless you press Accept. Your
              choice would be remembered in your browser&#8217;s local storage
              under the key <code>se-consent</code>, which is used for nothing
              else and never leaves your device.
            </p>

            <h2>Your rights</h2>
            <p>
              You can ask what personal information we hold about you, ask us to
              correct it, or ask us to delete it. Several states, including
              Kentucky under the Kentucky Consumer Data Privacy Act, give
              residents statutory rights along these lines.
            </p>
            <p>
              We honour these requests from anyone who asks, whether or not the
              law technically applies to a salon our size. Call
              <a href="tel:+12708047272">(270)&nbsp;804&#8209;7272</a> or ask at
              the salon, and we will deal with it within 45 days.
            </p>

            <h2>Children</h2>
            <p>
              This site is not directed at children under 13 and collects
              nothing from anyone. Children are welcome in the salon, but a
              parent or guardian should make the booking.
            </p>

            <h2>Changes</h2>
            <p>
              If this policy changes we will update the date at the top. In
              particular, if a contact form or analytics are ever added, this
              page will be rewritten before they go live.
            </p>

            <h2>Contact</h2>
            <p>
              Questions, or a request about your information: call
              <a href="tel:+12708047272">(270)&nbsp;804&#8209;7272</a>, message
              us on <a href="{fb}" rel="noopener">Facebook</a>, or call in at
              339 Charles Dr, Mayfield, KY 42066.
            </p>
          </div>
        </div>
      </section>
""".format(updated=UPDATED, fb=FB)

# ── Terms ────────────────────────────────────────────────────────
TERMS = """      <!-- ⚠ IMPORTANT: this page deliberately contains NO deposit amounts,
           cancellation windows, patch-test timings or refund periods. Those are
           Salon Elite's own commercial policies and inventing them would put
           words in the salon's mouth and mislead clients. Ask the salon for
           each one, fill in the marked sections, then have counsel review. -->
      <div class="page-head">
        <div class="wrap">
          <p class="eyebrow">Legal</p>
          <h1>Terms &amp; conditions</h1>
        </div>
      </div>

      <section>
        <div class="wrap">
          <div class="prose">
            <p class="updated">Last updated {updated}.</p>

            <p>
              These terms cover use of this website and the booking of services at
              Salon Elite, 339 Charles Dr, Mayfield, KY 42066.
            </p>

            <h2>1. Using this website</h2>
            <p>
              You may read, print and share these pages for your own
              non-commercial use. The text, layout, artwork and code are ours and
              may not be copied for commercial purposes without written permission.
            </p>
            <p>
              We keep the site accurate but cannot promise it is error-free or
              always available. Services shown here may change.
            </p>

            <h2>2. Booking an appointment</h2>
            <p>
              Stylists at Salon Elite rent their own booths and book their own
              clients, so your appointment is an arrangement between you and
              your stylist rather than with the salon.
            </p>
            <p>
              Book by calling
              <a href="tel:+12708047272">(270)&nbsp;804&#8209;7272</a> and asking
              for your stylist by name, or by messaging us on
              <a href="{fb}" rel="noopener">Facebook</a>. This website has no
              booking form. A message is a <strong>request</strong> until your
              stylist has confirmed a time with you.
            </p>

            <h2>3. Prices</h2>
            <p>
              No price list is published here, because each stylist sets their
              own prices and the figure depends on your hair and how long the
              work takes. Ask when you book and your stylist will give you a
              price before any work begins. Payment is due at the end of the
              appointment, to your stylist.
            </p>

            <h2>4. Deposits, cancellations and lateness</h2>
            <p>
              Some services may require a deposit, and we ask for reasonable notice
              if you need to cancel or move an appointment so the time can be
              offered to someone else. Arriving late may mean a shortened service
              or rebooking, since the appointment after yours cannot absorb the
              overrun.
            </p>
            <p>
              Please ask us for the current deposit and cancellation terms when you
              book &#8212; they are confirmed with you at that point.
            </p>

            <h2>5. Patch tests and your safety</h2>
            <p>
              Colour services may require a skin patch test in advance. Your
              stylist will tell you whether one is needed and how far ahead it has
              to be done. This is a safety requirement, not a formality.
            </p>
            <p>
              Please tell us before treatment about allergies, sensitivities, skin
              or scalp conditions, medication, recent treatments elsewhere, and
              pregnancy. We rely on what you tell us, and we cannot accept
              responsibility for a reaction caused by information we were not given.
            </p>

            <h2>6. Results</h2>
            <p>
              Hair responds differently from person to person. Your stylist will
              tell you honestly what is achievable, and will not carry out work
              they believe will damage your hair. We cannot guarantee an exact
              match to a reference photograph.
            </p>
            <p>
              If you are unhappy with a service, tell us as soon as you can and we
              will do what we reasonably can to put right anything that falls short
              of what was agreed.
            </p>

            <h2>7. Who you are dealing with</h2>
            <p>
              Salon Elite provides the premises. The stylists who work here rent
              their booths and operate independently: each one sets their own
              prices, hours and booking, and is responsible for the services
              they carry out. Where these terms say &#8220;we&#8221;, they mean
              whoever you are dealing with in that context.
            </p>

            <h2>8. Liability</h2>
            <p>
              Nothing in these terms limits our liability for death or personal
              injury caused by our negligence, for fraud, or for anything else that
              cannot lawfully be excluded. Subject to that, our total liability
              arising from a service is limited to the amount you paid for it.
            </p>
            <p>
              Please keep personal belongings with you. We cannot accept
              responsibility for items lost or damaged in the salon.
            </p>

            <h2>9. Gift certificates</h2>
            <p>
              Where we sell gift certificates, the expiry and conditions are those
              stated on the certificate itself and as required by Kentucky law.
              They are not exchangeable for cash.
            </p>

            <h2>10. Privacy</h2>
            <p>
              How we handle your information is set out in our
              <a href="privacy.html">privacy policy</a>.
            </p>

            <h2>11. Governing law</h2>
            <p>
              These terms are governed by the laws of the Commonwealth of Kentucky,
              and the courts of Kentucky have exclusive jurisdiction over any
              dispute.
            </p>

            <h2>12. Contact</h2>
            <p>
              Salon Elite, 339 Charles Dr, Mayfield, KY 42066.
              <a href="tel:+12708047272">(270)&nbsp;804&#8209;7272</a> &#183;
              <a href="{fb}" rel="noopener">Facebook</a>
            </p>
          </div>
        </div>
      </section>
""".format(updated=UPDATED, fb=FB)

# ── 404 ──────────────────────────────────────────────────────────
NOTFOUND = """      <section class="notfound">
        <div class="wrap">
          <p class="eyebrow">404</p>
          <h1>That page is not here</h1>
          <p class="lede notfound-lede">
            The link may be out of date, or the address slightly off. Nothing is
            lost &#8212; everything on the site is one tap away below.
          </p>
          <div class="hero-actions">
            <a class="btn btn-primary" href="index.html">Back to the home page</a>
            <a class="btn btn-ghost" href="tel:+12708047272">Call&nbsp;(270)&nbsp;804&#8209;7272</a>
          </div>
        </div>
      </section>
"""

page("privacy.html",
     "Privacy Policy &#8212; Salon Elite",
     "What Salon Elite collects through this website, why, how long it is kept, and how to have it deleted. No cookies, no analytics, no tracking.",
     PRIVACY, current="privacy")

page("terms.html",
     "Terms &amp; Conditions &#8212; Salon Elite",
     "Booking, pricing and patch-test terms for services at Salon Elite in Mayfield, Kentucky, plus the terms for using this website.",
     TERMS, current="terms")

page("404.html",
     "Page Not Found &#8212; Salon Elite",
     "That page does not exist on the Salon Elite website.",
     NOTFOUND, indexed=False)
