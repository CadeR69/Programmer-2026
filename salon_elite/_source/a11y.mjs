/**
 * Accessibility audit: runs axe-core over every page, at mobile and desktop
 * widths, in a real browser.
 *
 *   npm run lint:a11y
 *
 * Uses the system Chrome rather than downloading a Playwright browser, and
 * serves the site over HTTP because file:// breaks module and font loading.
 */
import { chromium } from "playwright-core";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PAGES = ["index.html", "privacy.html", "terms.html", "404.html"];
const WIDTHS = [
  { name: "mobile", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 900 },
];
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".xml": "application/xml",
  ".txt": "text/plain; charset=utf-8",
};

const server = createServer(async (req, res) => {
  const rel = normalize(decodeURIComponent(req.url.split("?")[0])).replace(
    /^(\.\.[/\\])+/,
    "",
  );
  const file = join(ROOT, rel === "/" ? "index.html" : rel);
  if (!existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404).end("not found");
    return;
  }
  res.writeHead(200, {
    "Content-Type": TYPES[extname(file)] ?? "application/octet-stream",
  });
  res.end(await readFile(file));
});

await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;

const axeSource = await readFile(
  join(ROOT, "node_modules/axe-core/axe.min.js"),
  "utf8",
);

const browser = await chromium.launch({ channel: "chrome" });
let total = 0;

for (const size of WIDTHS) {
  const context = await browser.newContext({
    viewport: { width: size.width, height: size.height },
  });
  const page = await context.newPage();

  for (const name of PAGES) {
    await page.goto(`${base}/${name}`, { waitUntil: "networkidle" });
    // Lazy images never enter the viewport in an automated run; force them so
    // axe sees every image, not just the ones above the fold.
    await page.evaluate(async () => {
      document
        .querySelectorAll('img[loading="lazy"]')
        .forEach((i) => (i.loading = "eager"));
      await Promise.all(
        [...document.images].map((i) =>
          i.complete ? null : new Promise((r) => (i.onload = i.onerror = r)),
        ),
      );
    });
    await page.addScriptTag({ content: axeSource });
    const result = await page.evaluate(async () =>
      window.axe.run(document, {
        runOnly: {
          type: "tag",
          values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"],
        },
      }),
    );

    const violations = result.violations;
    total += violations.length;
    const label = `${name} @ ${size.name}`;
    if (violations.length === 0) {
      console.log(`  ✓ ${label.padEnd(26)} no violations`);
    } else {
      console.log(`  ✖ ${label}`);
      for (const v of violations) {
        console.log(`      [${v.impact}] ${v.id} — ${v.help}`);
        for (const node of v.nodes.slice(0, 4)) {
          console.log(`        ${node.target.join(" ")}`);
        }
      }
    }
  }
  await context.close();
}

await browser.close();
server.close();

console.log(
  total === 0
    ? "\naxe-core: 0 violations across 4 pages x 2 viewports"
    : `\naxe-core: ${total} violation type(s) found`,
);
process.exit(total === 0 ? 0 : 1);
