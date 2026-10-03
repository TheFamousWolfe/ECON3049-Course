/* ECON3049-Course — print each lecture deck to PDF, one slide per page.

       node dev/decks-to-pdf.mjs                      -> iCloud/ECON3049 Decks
       node dev/decks-to-pdf.mjs out/dir              -> somewhere else
       node dev/decks-to-pdf.mjs --src path/to/decks  -> other input
       node dev/decks-to-pdf.mjs --slides-only        -> skip the notes PDFs

   A tablet mirrored to a projector cannot run presenter mode and need not:
   a PDF opens anywhere, needs no JavaScript, survives a dead network, and
   every reader can already page through one. The dynamic figures stay on the
   site; the PDF carries the static state of each.

   slides.css already contains the whole print layout, so this adds no styling
   of its own. It relies on four rules there:

       @page { size: landscape }          the shape of a slide
       .slide { break-after: page }       exactly one slide per page
       .fragment { visibility: visible }  every step revealed, so nothing that
                                          was built up on screen is missing
       aside.notes { display: none }      notes stay off the presenting copy

   Two PDFs per deck. The slides carry no notes and are safe on a projector.
   The notes are printed separately from the handout, to be read from a phone
   or on paper beside the slides.

   BOTH OUTPUTS ARE LECTURER-ONLY: the notes PDF is speaker notes in full. */

import { execFileSync } from "child_process";
import { readdirSync, existsSync, mkdirSync, statSync, readFileSync, writeFileSync, unlinkSync } from "fs";
import { join, resolve, basename } from "path";
import { homedir, tmpdir } from "os";

const SITE = new URL("../", import.meta.url).pathname;
const CHROME = process.env.CHROME ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
if (!existsSync(CHROME)) {
  console.error(`no Chrome at ${CHROME} — set $CHROME to a Chrome or Chromium binary`);
  process.exit(1);
}

const args = process.argv.slice(2);
let src = join(SITE, "../Econ3049/Slides");
let out = join(homedir(), "Library/Mobile Documents/com~apple~CloudDocs/ECON3049 Decks");
let withNotes = true;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--src") src = args[++i];
  else if (args[i] === "--slides-only") withNotes = false;
  else out = args[i];
}
src = resolve(src); out = resolve(out);
if (!existsSync(src)) { console.error(`no decks at ${src}`); process.exit(1); }
mkdirSync(out, { recursive: true });

const pdf = (fileUrl, dest) => execFileSync(CHROME, [
  "--headless=new", "--disable-gpu", "--no-pdf-header-footer",
  "--virtual-time-budget=12000",
  "--print-to-pdf=" + dest, fileUrl
], { stdio: ["ignore", "ignore", "ignore"] });

/* page count straight out of the PDF, so the claim is measured not assumed */
const pages = (f) => {
  const txt = execFileSync("pdftotext", ["-layout", f, "-"], { encoding: "utf8", maxBuffer: 64e6 });
  return txt.split("\f").filter((p, i, a) => p.trim() || i < a.length - 1).length;
};

const decks = readdirSync(src).filter(f => f.endsWith(".html") && !f.startsWith(".") &&
                                           !f.endsWith("-notes.html") && f !== "index.html").sort();
if (!decks.length) { console.error(`no decks in ${src}`); process.exit(1); }

let bad = 0;
for (const file of decks) {
  const html = readFileSync(join(src, file), "utf8");
  const slides = (html.match(/<section class="slide/g) || []).length;

  const dest = join(out, file.replace(/\.html$/, ".pdf"));
  pdf("file://" + join(src, file), dest);
  const got = pages(dest);
  const kb = Math.round(statSync(dest).size / 1024);
  const ok = got === slides;
  if (!ok) bad++;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${file.replace(/\.html$/, ".pdf").padEnd(42)}` +
              `${String(got).padStart(3)} pages / ${String(slides).padStart(2)} slides  ${String(kb).padStart(5)} KB`);

  if (withNotes) {
    /* the notes handout, if bundle-decks.mjs has written one beside the output */
    const handout = join(out, file.replace(/\.html$/, "-notes.html"));
    if (existsSync(handout)) {
      const ndest = join(out, file.replace(/\.html$/, "-notes.pdf"));
      pdf("file://" + handout, ndest);
      console.log(`       ${basename(ndest).padEnd(42)}${String(pages(ndest)).padStart(3)} pages` +
                  `${" ".repeat(12)}${String(Math.round(statSync(ndest).size / 1024)).padStart(5)} KB`);
    }
  }
}

console.log(bad ? `\n  ${bad} deck(s) did not produce one page per slide`
                : `\n  ${decks.length} decks -> ${out}`);
console.log("  slides carry no speaker notes; the -notes PDFs are the lecturer's copy");
process.exit(bad ? 1 : 0);
