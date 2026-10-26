import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["node_modules/**", "_source/initial*.html"] },
  {
    // Ships to browsers as a classic script (no modules, no bundler).
    // Baseline is ES2019: it already uses fetch, Promise and .finally.
    files: ["scripts.js"],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: "script",
      globals: { ...globals.browser },
    },
    rules: {
      ...js.configs.recommended.rules,
      eqeqeq: ["error", "always"],
    },
  },
  {
    // Local tooling — runs in Node, but page.evaluate() callbacks are
    // serialised and executed inside the browser, so both sets of globals
    // legitimately appear in one file.
    files: ["_source/*.mjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.node, ...globals.browser },
    },
    rules: js.configs.recommended.rules,
  },
];
