/* Salon Elite — progressive enhancement only.
   Every feature here has a working no-JS fallback: the nav menu is a plain
   anchor list, the FAQ is native <details>, and the cookie banner stays
   hidden because nothing that needs consent has loaded.

   There is no form handling here on purpose. The salon is booth rental, so
   bookings are made with the individual stylist by phone or Facebook rather
   than through a central inbox nobody owns. */
(function () {
  "use strict";

  /* ── Config ────────────────────────────────────────────────────
     Set ANALYTICS_ID to switch measurement on. Leaving it empty is a real
     choice, not a stub: no ID means no third-party script, no cookies, and
     no consent banner to interrupt anyone. Setting it makes the banner
     appear and gates the loader behind an explicit Accept.
     ⚠ Also add the analytics host to script-src/connect-src in _headers,
     or CSP will block it. */
  var ANALYTICS_ID = "";
  var ANALYTICS_SRC = "https://www.googletagmanager.com/gtag/js?id=";
  var CONSENT_KEY = "se-consent";

  var $ = function (sel, root) {
    return (root || document).querySelector(sel);
  };

  /* ── Footer year ───────────────────────────────────────────── */
  var year = $("#year");
  if (year) year.textContent = String(new Date().getFullYear());

  /* ── Mobile navigation ─────────────────────────────────────── */
  var toggle = $(".nav-toggle");
  var menu = $("#nav-menu");

  if (toggle && menu) {
    var setMenu = function (open) {
      toggle.setAttribute("aria-expanded", String(open));
      if (open) menu.setAttribute("data-open", "true");
      else menu.removeAttribute("data-open");
    };

    toggle.addEventListener("click", function () {
      setMenu(toggle.getAttribute("aria-expanded") !== "true");
    });

    // Jumping to an anchor should not leave the panel covering the target.
    menu.addEventListener("click", function (e) {
      if (e.target.closest("a")) setMenu(false);
    });

    document.addEventListener("keydown", function (e) {
      if (
        e.key === "Escape" &&
        toggle.getAttribute("aria-expanded") === "true"
      ) {
        setMenu(false);
        toggle.focus();
      }
    });

    // Rotating to landscape can cross the 900px breakpoint, where the panel's
    // CSS stops applying and a stale aria-expanded="true" would lie to AT.
    var desktop = window.matchMedia("(min-width: 900px)");
    var onBreakpoint = function (e) {
      if (e.matches) setMenu(false);
    };
    if (desktop.addEventListener)
      desktop.addEventListener("change", onBreakpoint);
    else desktop.addListener(onBreakpoint); // Safari < 14

    // Close on outside tap — a menu you can't dismiss feels broken on a phone.
    document.addEventListener("click", function (e) {
      if (
        toggle.getAttribute("aria-expanded") === "true" &&
        !e.target.closest(".nav")
      ) {
        setMenu(false);
      }
    });
  }

  /* ── Cookie consent ────────────────────────────────────────────
     Gates analytics rather than merely announcing it. With no ANALYTICS_ID
     this whole block is inert and the banner never renders. */
  var banner = $("#cookie-banner");
  if (!banner || !ANALYTICS_ID) return;

  var readConsent = function () {
    try {
      return window.localStorage.getItem(CONSENT_KEY);
    } catch {
      return null; // Private mode / storage blocked.
    }
  };

  var loadAnalytics = function () {
    if (window.__seAnalyticsLoaded) return;
    window.__seAnalyticsLoaded = true;
    var s = document.createElement("script");
    s.async = true;
    s.src = ANALYTICS_SRC + encodeURIComponent(ANALYTICS_ID);
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () {
      window.dataLayer.push(arguments);
    };
    window.gtag("js", new Date());
    window.gtag("config", ANALYTICS_ID, { anonymize_ip: true });
  };

  var choice = readConsent();
  if (choice === "accept") {
    loadAnalytics();
  } else if (choice !== "decline") {
    banner.hidden = false;
  }

  banner.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-cookie]");
    if (!btn) return;
    var decision = btn.getAttribute("data-cookie");
    try {
      window.localStorage.setItem(CONSENT_KEY, decision);
    } catch {
      /* Choice won't persist, but it still applies to this visit. */
    }
    banner.hidden = true;
    if (decision === "accept") loadAnalytics();
  });
})();
