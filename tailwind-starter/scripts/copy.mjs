// Copies everything in src/ except src/css/input.css into dist/.
// Keeps files already in dist/ (like a Google verification .html) untouched.
import { cpSync, mkdirSync } from "node:fs";
mkdirSync("dist", { recursive: true });
cpSync("src", "dist", {
  recursive: true,
  filter: (p) => !p.replaceAll("\\", "/").endsWith("css/input.css"),
});
console.log("copied src/ -> dist/");
