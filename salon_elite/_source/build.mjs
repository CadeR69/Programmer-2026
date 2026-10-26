/**
 * Produces dist/ — exactly the files that should be uploaded, nothing else.
 *
 *   npm run build
 *
 * Without this, pointing a host at the project root would publish
 * node_modules/, _source/, the linter configs and the internal launch
 * checklist alongside the site.
 */
import { cp, mkdir, rm, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const DIST = join(ROOT, "dist");

/** Everything a visitor or a crawler can actually request. */
const SHIP = [
  "index.html",
  "privacy.html",
  "terms.html",
  "404.html",
  "stylesheet-1.css",
  "scripts.js",
  "favicon.svg",
  "robots.txt",
  "sitemap.xml",
  "_headers",
  "images",
  "fonts",
];

await rm(DIST, { recursive: true, force: true });
await mkdir(DIST, { recursive: true });

let files = 0;
let bytes = 0;

const tally = async (path) => {
  const s = await stat(path);
  if (s.isDirectory()) {
    for (const entry of await readdir(path)) await tally(join(path, entry));
  } else {
    files += 1;
    bytes += s.size;
  }
};

for (const name of SHIP) {
  const from = join(ROOT, name);
  await cp(from, join(DIST, name), { recursive: true });
  await tally(from);
}

console.log(
  `dist/  ${files} files, ${(bytes / 1024).toFixed(0)} KB uncompressed`,
);
console.log("Upload the contents of dist/ — nothing outside it is needed.");
