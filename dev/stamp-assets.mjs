/* ECON3049-Course — asset cache stamping.

   GitHub Pages serves assets with `cache-control: max-age=600`, so for
   ten minutes after a push a returning reader can get new HTML against
   an old stylesheet. That is not hypothetical: it produced a completely
   unstyled preferences bar the first time reader.js shipped, because the
   markup arrived and the CSS did not.

   This stamps every asset link with a short hash of the assets' own
   contents:

       assets/course.css?v=a1b2c3d4

   Change any asset and the hash changes, so the URL changes, so no
   browser can serve a stale copy. Nothing else needs to know the number.

   Run before pushing, alongside the other tools:

       node dev/stamp-assets.mjs          # rewrite the stamps
       node dev/stamp-assets.mjs --check  # verify without writing

   check-site.mjs runs the same verification, so a forgotten stamp fails
   the suite rather than reaching a student.                             */

import { readFileSync, writeFileSync, readdirSync } from "fs";
import { createHash } from "crypto";

const SITE = new URL("../", import.meta.url).pathname;
const CHECK = process.argv.includes("--check");

/* one hash over every asset, so any change to any of them busts all of
   them — simpler than per-file stamps, and they are all small */
const assets = readdirSync(SITE + "assets").filter(f => /\.(css|js)$/.test(f)).sort();
const h = createHash("sha256");
for (const a of assets) h.update(readFileSync(SITE + "assets/" + a));
const VERSION = h.digest("hex").slice(0, 8);

const pages = [
  "index.html",
  ...readdirSync(SITE + "units").filter(f => f.endsWith(".html")).map(f => "units/" + f),
  ...readdirSync(SITE + "reference").filter(f => f.endsWith(".html")).map(f => "reference/" + f)
];

let stale = 0, touched = 0;
for (const page of pages) {
  const path = SITE + page;
  const src = readFileSync(path, "utf8");
  /* match assets/<name>.<ext> optionally already carrying a ?v= */
  const out = src.replace(
    /((?:\.\.\/)?assets\/[a-z-]+\.(?:css|js))(\?v=[0-9a-f]+)?/g,
    (_, file) => `${file}?v=${VERSION}`
  );
  if (out !== src) {
    stale++;
    if (!CHECK) { writeFileSync(path, out); touched++; }
  }
}

console.log(`asset version ${VERSION}  (${assets.length} files)`);
if (CHECK) {
  console.log(stale ? `  ${stale} page(s) carry a stale stamp` : "  all pages stamped current");
  process.exit(stale ? 1 : 0);
} else {
  console.log(touched ? `  restamped ${touched} page(s)` : "  already current");
}
