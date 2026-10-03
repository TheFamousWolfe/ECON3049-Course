/* ECON3049-Course — make each lecture deck a single self-contained file.

   The decks live outside this repository and load the site's assets by
   relative path, which is fine on the machine that holds both folders and
   useless anywhere else. This inlines every stylesheet and script so that one
   file is the whole deck: no server, no sibling folders, works offline, and
   can be dropped in iCloud and opened on a phone or an iPad.

       node dev/bundle-decks.mjs                      -> iCloud/ECON3049 Decks
       node dev/bundle-decks.mjs out/some/dir         -> somewhere else
       node dev/bundle-decks.mjs --src path/to/decks  -> other input

   It also writes a NOTES HANDOUT per deck — every speaker note, numbered by
   slide, as its own small page. Presenter mode needs two visible windows, so
   it cannot work on a tablet mirrored to a projector: whatever is on the
   screen is on the wall. The handout is the way round that — read it from a
   phone or on paper while the tablet drives the slides.

   DEFER MATTERS. course.js is eager and defines window.COURSE; nav.js, viz.js
   and slides.js are deferred and expect a parsed document. An inline script
   runs where it sits, so the deferred three are moved to the end of <body>
   rather than left in <head>, which preserves both their order and their
   assumption that the DOM exists.

   THE OUTPUT IS LECTURER-ONLY. It carries the speaker notes in full. Do not
   put it anywhere public.                                                 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "fs";
import { join, resolve, basename } from "path";
import { homedir } from "os";

const SITE = new URL("../", import.meta.url).pathname;
const args = process.argv.slice(2);
let src = join(SITE, "../Econ3049/Slides");
let out = join(homedir(), "Library/Mobile Documents/com~apple~CloudDocs/ECON3049 Decks");
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--src") src = args[++i];
  else out = args[i];
}
src = resolve(src); out = resolve(out);

if (!existsSync(src)) { console.error(`no decks at ${src}`); process.exit(1); }
mkdirSync(out, { recursive: true });

/* A string being pasted into <script> or <style> must not be able to close it. */
const safe = (s, tag) => s.replace(new RegExp(`</(?=${tag})`, "gi"), "<\\/");

const asset = (f) => readFileSync(join(SITE, "assets", f), "utf8");

const decks = readdirSync(src).filter((f) => f.endsWith(".html") && f !== "README.md").sort();
if (!decks.length) { console.error(`no .html decks in ${src}`); process.exit(1); }

let total = 0;
const index = [];

for (const file of decks) {
  let html = readFileSync(join(src, file), "utf8");
  const title = (html.match(/<title>([^<]*)<\/title>/) || [, file])[1]
                  .replace(/\s*·\s*lecture deck\s*·\s*ECON 3049\s*$/, "").trim();

  /* stylesheets, in place */
  html = html.replace(
    /[ \t]*<link rel="stylesheet" href="[^"]*assets\/([a-z-]+\.css)"[^>]*>\n?/g,
    (_, f) => `<style>/* ${f} */\n${safe(asset(f), "style")}\n</style>\n`);

  /* deferred scripts: lift out, re-emit at the end of body, order preserved */
  const deferred = [];
  html = html.replace(
    /[ \t]*<script src="[^"]*assets\/([a-z-]+\.js)"[^>]*\bdefer\b[^>]*><\/script>\n?/g,
    (_, f) => { deferred.push(f); return ""; });

  /* eager scripts: in place */
  html = html.replace(
    /[ \t]*<script src="[^"]*assets\/([a-z-]+\.js)"[^>]*><\/script>\n?/g,
    (_, f) => `<script>/* ${f} */\n${safe(asset(f), "script")}\n</script>\n`);

  const tail = deferred
    .map((f) => `<script>/* ${f} — was deferred, so it runs here */\n${safe(asset(f), "script")}\n</script>`)
    .join("\n");
  html = html.replace(/<\/body>/, `${tail}\n</body>`);

  const leftover = html.match(/(?:href|src)="[^"]*assets\/[^"]*"/g);
  if (leftover) { console.error(`  ${file}: ${leftover.length} asset reference(s) not inlined`); process.exit(1); }
  if (/\.\.\/\.\.\//.test(html)) { console.error(`  ${file}: a relative path to the site survived`); process.exit(1); }

  writeFileSync(join(out, file), html);
  total += html.length;

  /* ---- the notes handout -------------------------------------------- */
  const slides = [...html.matchAll(/<section class="slide[^"]*"[^>]*>([\s\S]*?)<\/section>/g)];
  const rows = [];
  slides.forEach((m, i) => {
    const body = m[1];
    const head = (body.match(/<h[12][^>]*>([\s\S]*?)<\/h[12]>/) || [, ""])[1]
                   .replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    const notes = [...body.matchAll(/<aside class="notes">([\s\S]*?)<\/aside>/g)]
      .map((n) => n[1].replace(/<\/p>/g, "\n").replace(/<[^>]+>/g, " ")
                      .replace(/[ \t]+/g, " ").split("\n").map((s) => s.trim()).filter(Boolean))
      .flat();
    if (notes.length) rows.push({ n: i + 1, head, notes });
  });
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const handout = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} — speaker notes</title>
<style>
  :root{color-scheme:light}
  body{font:16px/1.55 -apple-system,Georgia,serif;max-width:40rem;margin:0 auto;
       padding:1.2rem 1.1rem 4rem;background:#fbfaf8;color:#1a1a1a}
  h1{font-size:1.25rem;margin:0 0 .2rem}
  .sub{color:#666;font-size:.85rem;margin:0 0 1.4rem}
  .s{border-top:1px solid #ddd;padding:.85rem 0}
  .n{display:inline-block;min-width:2.1em;font-weight:700;color:#7a1f2b}
  .h{font-weight:600}
  p.note{margin:.45rem 0 .45rem 2.1em}
  @media print{body{background:#fff;max-width:none} .s{page-break-inside:avoid}}
</style></head><body>
<h1>${esc(title)}</h1>
<p class="sub">Speaker notes · ${rows.length} of ${slides.length} slides carry them · lecturer's copy</p>
${rows.map((r) => `<div class="s"><span class="n">${r.n}</span><span class="h">${esc(r.head)}</span>
${r.notes.map((t) => `<p class="note">${esc(t)}</p>`).join("\n")}</div>`).join("\n")}
</body></html>`;
  const hname = file.replace(/\.html$/, "-notes.html");
  writeFileSync(join(out, hname), handout);

  index.push({ file, hname, title, slides: slides.length, notes: rows.length });
  console.log(`  ${file.padEnd(40)} ${String(Math.round(html.length / 1024)).padStart(4)} KB  ` +
              `${String(slides.length).padStart(2)} slides  ${String(rows.length).padStart(2)} noted`);
}

/* a contents page, so the iPad has one thing to open */
const escI = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
writeFileSync(join(out, "index.html"), `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ECON 3049 — lecture decks</title>
<style>
  :root{color-scheme:light}
  body{font:16px/1.5 -apple-system,Georgia,serif;max-width:40rem;margin:0 auto;
       padding:1.4rem 1.1rem 4rem;background:#fbfaf8;color:#1a1a1a}
  h1{font-size:1.3rem;margin:0 0 .15rem}
  .sub{color:#666;font-size:.85rem;margin:0 0 1.5rem}
  a{color:#7a1f2b}
  .r{border-top:1px solid #ddd;padding:.7rem 0;display:flex;
     justify-content:space-between;align-items:baseline;gap:1rem}
  .t{font-weight:600;text-decoration:none}
  .m{color:#777;font-size:.8rem;white-space:nowrap}
  .warn{background:#fff4f4;border:1px solid #e7c9c9;padding:.7rem .9rem;
        font-size:.85rem;margin:0 0 1.4rem;border-radius:4px}
</style></head><body>
<h1>ECON 3049 — lecture decks</h1>
<p class="sub">Self-contained. No network, no sibling folders. Tap the left quarter of a slide to go back, anywhere else to go on.</p>
<p class="warn"><strong>Lecturer's copy.</strong> These carry the speaker notes in full, readable in the page source. Do not hand this folder on.</p>
${index.map((d) => `<div class="r"><a class="t" href="${d.file}">${escI(d.title)}</a>
<span class="m">${d.slides} slides · <a href="${d.hname}">notes</a></span></div>`).join("\n")}
</body></html>`);

console.log(`\n  ${decks.length} decks + notes + contents -> ${out}`);
console.log(`  ${Math.round(total / 1024 / 1024 * 10) / 10} MB of slides, each file standalone`);
