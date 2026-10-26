/**
 * Several stylelint-config-standard rules are switched off below. Each one is
 * off because "fixing" it would cost real browser support on a public site,
 * not because it was noisy. Reasons are recorded so nobody turns them back on
 * by accident.
 */
export default {
  extends: "stylelint-config-standard",
  ignoreFiles: ["node_modules/**", "_source/**"],
  rules: {
    // — Deliberate: these would break browsers —

    // Safari still needs -webkit-backdrop-filter (frosted header) and needed
    // -webkit-appearance until 15.4. iOS Safari needs -webkit-text-size-adjust
    // to stop inflating text in landscape — removing it reintroduces that bug.
    "property-no-vendor-prefix": null,

    // (min-width: 900px) works everywhere; the range syntax (width >= 900px)
    // needs Safari 16.4+. Not worth dropping older iOS for tidier syntax.
    "media-feature-range-notation": null,

    // :not(a, b) needs Safari 16.4+/Chrome 88+; :not(a):not(b) works
    // everywhere and costs nothing.
    "selector-not-notation": null,

    // The .sr-only pattern keeps legacy `clip` alongside `clip-path` so the
    // visually-hidden text stays hidden in older engines.
    "property-no-deprecated": null,

    // — Cosmetic only —
    "value-keyword-case": null, // font stacks read better as "Georgia"
    "custom-property-empty-line-before": null,
    "declaration-empty-line-before": null,
    "comment-empty-line-before": null,
    "no-descending-specificity": null,
    "alpha-value-notation": null,
    "color-function-notation": null,
  },
};
