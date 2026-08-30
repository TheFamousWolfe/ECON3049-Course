/* ECON3049-Course — glossary back-linker.

   The glossary links out to the units. This links the units back, so a
   student who meets "heteroscedasticity" in Unit 1B can get the one-line
   reminder without hunting for the unit that defines it.

   Run after writing a unit:   node dev/link-glossary.mjs
   See what it would do first: node dev/link-glossary.mjs --dry

   How it decides what to link
   ---------------------------
   * Terms and their spellings come from reference/glossary.html. A <dt>
     is matched by its own text, plus an optional plural "s"; where that
     is not how the term reads in prose, the <dt> carries data-match with
     a comma-separated list of alternatives.
   * ALL-CAPS phrases (OLS, BLUE, TSS) match case-sensitively, so the
     word "blue" in a caption is never mistaken for the acronym.
   * Only the FIRST occurrence in a unit is linked. A page peppered with
     the same link is harder to read, not easier.
   * Only running prose is touched: bare <p>…</p> blocks. Headings, the
     algebra in <p class="math">, quiz options, tutorial question text,
     .eqn-report displays and figure fallbacks are all left alone —
     a link inside a self-test is a distraction, and a link inside an
     equation is noise.
   * Text already inside an <a> is skipped, and a term the file already
     links is never linked a second time, so the script is idempotent:
     running it twice changes nothing.

   Run with --unlink to strip every generated link back out again, which
   is the way to re-flow the links after editing a unit's prose.

   No dependencies, and it never touches reference/ or assets/.          */

import { readFileSync, writeFileSync, readdirSync } from "fs";

const SITE = new URL("../", import.meta.url).pathname;
const DRY = process.argv.includes("--dry");
const UNLINK = process.argv.includes("--unlink");

const GT = /<a class="gt" href="\.\.\/reference\/glossary\.html#([^"]+)">([\s\S]*?)<\/a>/g;

if (UNLINK) {
  let n = 0;
  for (const file of readdirSync(`${SITE}units`).filter(f => f.endsWith(".html")).sort()) {
    const path = `${SITE}units/${file}`;
    const src = readFileSync(path, "utf8");
    let count = 0;
    const out = src.replace(GT, (_, id, text) => { count++; return text; });
    if (count && !DRY) writeFileSync(path, out);
    n += count;
    console.log(`${file}  —  ${count} link(s) removed`);
  }
  console.log(`\n${n} links removed${DRY ? "  (dry run, nothing written)" : ""}`);
  process.exit(0);
}

/* ---------- 1. read the term list out of the glossary ---------- */
const gloss = readFileSync(`${SITE}reference/glossary.html`, "utf8");
const terms = [];

for (const m of gloss.matchAll(/<dt id="([^"]+)"([^>]*)>([\s\S]*?)<\/dt>/g)) {
  const [, id, attrs, inner] = m;
  const dm = /data-match="([^"]+)"/.exec(attrs);

  let phrases;
  if (dm) {
    phrases = dm[1].split(",").map(s => s.trim()).filter(Boolean);
  } else {
    /* strip the trailing "Unit 1C" pill and any markup, then cut the
       phrase at an em dash or an opening parenthesis */
    const text = inner.replace(/<a class="g-unit"[\s\S]*?<\/a>/g, "")
                      .replace(/<[^>]+>/g, "")
                      .replace(/&[a-z]+;/g, " ")
                      .trim();
    phrases = [text.split(/\s+—\s+| \(/)[0].trim()];
  }
  for (const phrase of phrases) {
    if (phrase) terms.push({ id, phrase });
  }
}

/* Longest first, so "residual sum of squares" wins over "residual". */
terms.sort((a, b) => b.phrase.length - a.phrase.length);

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
for (const t of terms) {
  const caps = /^[A-Z]{2,}$/.test(t.phrase);
  /* an optional plural, but never on an acronym; a space in the phrase
     matches any run of whitespace, since prose wraps across lines */
  const body = escape(t.phrase).replace(/ /g, "\\s+") + (caps ? "" : "e?s?");
  t.re = new RegExp(`(?<![\\w-])(${body})(?![\\w-])`, caps ? "" : "i");
}
console.log(`${terms.length} phrases from ${new Set(terms.map(t => t.id)).size} glossary entries\n`);

/* ---------- 2. rewrite each unit ---------- */
const TAG = /<[^>]+>/g;
let totalLinks = 0, totalFiles = 0;

for (const file of readdirSync(`${SITE}units`).filter(f => f.endsWith(".html")).sort()) {
  const path = `${SITE}units/${file}`;
  const src = readFileSync(path, "utf8");
  /* Terms this file already links stay linked where they are — that is
     what makes a second run a no-op. */
  const used = new Set([...src.matchAll(GT)].map(m => m[1]));
  const hits = [];

  /* bare <p> only — <p class="math">, <p class="subtitle"> etc. are prose
     we do not want to decorate */
  const out = src.replace(/<p>([\s\S]*?)<\/p>/g, (block) => {
    let depth = 0, cursor = 0, rebuilt = "";

    const pieces = [];
    for (const tag of block.matchAll(TAG)) {
      pieces.push({ text: block.slice(cursor, tag.index) });
      pieces.push({ tag: tag[0] });
      cursor = tag.index + tag[0].length;
    }
    pieces.push({ text: block.slice(cursor) });

    for (const piece of pieces) {
      if (piece.tag !== undefined) {
        if (/^<a[\s>]/i.test(piece.tag)) depth++;
        else if (/^<\/a>/i.test(piece.tag)) depth = Math.max(0, depth - 1);
        rebuilt += piece.tag;
        continue;
      }
      if (depth > 0 || !piece.text.trim()) { rebuilt += piece.text; continue; }

      /* collect one candidate per unused phrase, then keep the
         non-overlapping ones in document order */
      const found = [];
      for (const t of terms) {
        if (used.has(t.id)) continue;
        const m = t.re.exec(piece.text);
        if (m) found.push({ at: m.index, len: m[0].length, text: m[0], term: t });
      }
      found.sort((a, b) => a.at - b.at || b.len - a.len);

      let end = -1, pos = 0, text = "";
      for (const f of found) {
        if (f.at < end || used.has(f.term.id)) continue;
        text += piece.text.slice(pos, f.at)
             + `<a class="gt" href="../reference/glossary.html#${f.term.id}">${f.text}</a>`;
        pos = f.at + f.len;
        end = pos;
        used.add(f.term.id);
        hits.push(`${f.text} → #${f.term.id}`);
      }
      rebuilt += text + piece.text.slice(pos);
    }
    return rebuilt;
  });

  if (out !== src) {
    if (!DRY) writeFileSync(path, out);
    totalFiles++;
  }
  totalLinks += hits.length;
  console.log(`${file}  —  ${hits.length} link${hits.length === 1 ? "" : "s"}`);
  for (const h of hits) console.log(`    ${h}`);
  console.log();
}

console.log(`${totalLinks} links across ${totalFiles} file(s)${DRY ? "  (dry run, nothing written)" : ""}`);
