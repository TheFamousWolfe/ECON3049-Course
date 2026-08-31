/* ECON3049-Course — mark units as covered in class.

   The roadmap ticks whichever units appear in COURSE.covered, so that a
   student can see where the class has got to. This edits that one line in
   assets/course.js; nothing else on the site knows about it.

       node dev/covered.mjs                 list what is marked
       node dev/covered.mjs 1A 1B           mark these as covered
       node dev/covered.mjs --undo 1B       unmark
       node dev/covered.mjs "2A Part 1"     codes with spaces need quotes

   Codes are matched against the manifest, so a typo is refused here rather
   than reaching check-site.mjs. The written order does not matter: the list
   is rewritten in course order every time.

   Editing course.js changes the asset hash, so this restamps the pages for
   you. The site is public and served from main, so the change is not visible
   to students until it is pushed:

       node dev/covered.mjs 1A && git commit -am "Covered 1A" && git push

   No dependencies.                                                       */

import { readFileSync, writeFileSync } from "fs";
import { execFileSync } from "child_process";

const SITE = new URL("../", import.meta.url).pathname;
const FILE = `${SITE}assets/course.js`;
const src = readFileSync(FILE, "utf8");

/* the manifest is a script, not JSON: run it for the unit list */
const COURSE = new Function(
  "window", `${src}; return window.COURSE;`)({});
const codes = COURSE.units.map(u => u.unit);
const ready = new Set(COURSE.units.filter(u => u.status !== "planned").map(u => u.unit));

const args = process.argv.slice(2);
const undo = args.includes("--undo");
const asked = args.filter(a => a !== "--undo");

const current = new Set(COURSE.covered || []);

if (!asked.length) {
  const done = codes.filter(c => current.has(c));
  console.log(done.length
    ? `Covered in class (${done.length} of ${codes.length}):\n  ${done.join("  ")}`
    : "No units marked as covered yet.");
  console.log(`\nAll units:\n  ${codes.join("  ")}`);
  process.exit(0);
}

const unknown = asked.filter(a => !codes.includes(a));
if (unknown.length) {
  console.error(`Not a unit code: ${unknown.join(", ")}`);
  console.error(`Codes are:      ${codes.join("  ")}`);
  process.exit(1);
}

for (const code of asked) {
  if (undo) current.delete(code);
  else {
    current.add(code);
    /* Marking an unwritten unit is legal — the class can run ahead of the
       site — but it is worth saying out loud, since the roadmap will tick a
       unit it cannot link to. */
    if (!ready.has(code)) console.log(`note: ${code} is not written yet`);
  }
}

const list = codes.filter(c => current.has(c));
const line = list.length
  ? `  covered: [${list.map(c => `"${c}"`).join(", ")}],`
  : "  covered: [],";

const out = src.replace(/^ {2}covered: \[[^\]]*\],$/m, line);
if (out === src && !list.length) {
  console.log("Nothing to change.");
  process.exit(0);
}
if (!/^ {2}covered: \[/m.test(src)) {
  console.error("Could not find the covered list in assets/course.js.");
  process.exit(1);
}
writeFileSync(FILE, out);

/* course.js is an asset, so editing it changes the hash every page is
   stamped with. Restamp here rather than leaving a tree that fails
   check-site.mjs for a reason that has nothing to do with the edit. */
execFileSync(process.execPath, [`${SITE}dev/stamp-assets.mjs`], { stdio: "inherit" });

console.log(`${undo ? "Unmarked" : "Marked"}: ${asked.join(", ")}`);
console.log(`Now covered (${list.length} of ${codes.length}): ${list.join("  ") || "none"}`);
console.log("\nNot visible to students until it is pushed:");
console.log("  node dev/check-site.mjs && git commit -am \"Covered "
            + asked.join(", ") + "\" && git push");
