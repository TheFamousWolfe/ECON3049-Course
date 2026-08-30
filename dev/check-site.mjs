/* ECON3049-Course regression suite.
   Expectations are derived from assets/course.js, so this keeps working
   as units move from planned -> ready. Run: node check-site.mjs        */
import { JSDOM } from "jsdom";
import { readFileSync, existsSync } from "fs";

const SITE = new URL("../", import.meta.url).pathname;

const load = async (f) => {
  const dom = await JSDOM.fromFile(SITE + f, {
    runScripts: "dangerously", resources: "usable", pretendToBeVisual: true
  });
  await new Promise(r => dom.window.addEventListener("load", r));
  await new Promise(r => setTimeout(r, 150));
  return dom.window;
};

let fail = 0, count = 0;
const ok = (c, m, x = "") => {
  count++;
  if (!c) fail++;
  if (!c || process.env.VERBOSE) console.log(`${c ? "  ok  " : "FAIL  "}${m}${x ? "  — " + x : ""}`);
};
const head = (s) => console.log(`\n${s}`);

/* ---------- 1. index reflects the manifest ---------- */
head("index.html");
const iw = await load("index.html");
const C = iw.COURSE;
const idx = iw.document;

const live = C.units.filter(u => u.status !== "planned");
const planned = C.units.filter(u => u.status === "planned");

ok(idx.querySelectorAll("#roadmap ol.units li").length === C.units.length,
   `roadmap lists all ${C.units.length} units`);
ok(idx.querySelectorAll("#roadmap a").length === live.length,
   `${live.length} written unit(s) linked`, String(idx.querySelectorAll("#roadmap a").length));
ok(idx.querySelectorAll("#roadmap li.todo").length === planned.length,
   `${planned.length} unwritten unit(s) unlinked`);
ok(idx.querySelectorAll("#roadmap .part").length === C.units_meta.length,
   "one group per part");
const codes = [...idx.querySelectorAll("#roadmap .num")].map(n => n.textContent);
ok(codes.join("|") === C.units.map(u => u.unit).join("|"), "units render in manifest order");

const refLive = (C.reference || []).filter(r => r.status !== "planned");
const refTodo = (C.reference || []).filter(r => r.status === "planned");
ok(idx.querySelectorAll("#reference-links a").length === refLive.length,
   `${refLive.length} written reference page(s) linked`);
ok(idx.querySelectorAll("#reference-links .pending").length === refTodo.length,
   `${refTodo.length} unwritten reference page(s) named but not linked`);
for (const r of refLive) {
  ok(existsSync(`${SITE}reference/${r.slug}.html`),
     `reference/${r.slug}.html exists`);
}

/* ---------- 2. every written reference page ---------- */
for (const r of refLive) {
  head(`reference/${r.slug}.html`);
  const w = await load(`reference/${r.slug}.html`);
  const d = w.document;
  const at = (m) => `${r.slug}: ${m}`;

  ok(d.title.includes(r.title), at("title names the page"), d.title);
  ok(!!d.querySelector(".masthead"), at("has a masthead"));
  ok([...d.querySelectorAll("a")].some(a => /index\.html$/.test(a.getAttribute("href") || "")),
     at("links back to the course home"));

  /* every internal link must resolve — a glossary of dead links is worse
     than no glossary */
  const bad = [...d.querySelectorAll("a[href]")]
    .map(a => a.getAttribute("href"))
    .filter(h => h.startsWith("../"))
    .filter(h => !existsSync(`${SITE}${h.replace(/^\.\.\//, "").split("#")[0]}`));
  ok(bad.length === 0, at("every cross-link resolves"), bad.join(" "));

  /* in-page fragments must exist too */
  const ids = new Set([...d.querySelectorAll("[id]")].map(n => n.id));
  const deadFrag = [...d.querySelectorAll('a[href^="#"]')]
    .map(a => a.getAttribute("href").slice(1))
    .filter(f => !ids.has(f));
  ok(deadFrag.length === 0, at("every in-page anchor resolves"), deadFrag.join(" "));
}

/* ---------- 3. the glossary tracks the units ---------- */
if (refLive.some(r => r.slug === "glossary")) {
  head("reference/glossary.html   (coverage)");
  const gw = await load("reference/glossary.html");
  const gd = gw.document;
  const terms = [...gd.querySelectorAll(".gloss dt")];
  ok(terms.length >= 20, "glossary defines 20+ terms", String(terms.length));
  ok(terms.every(t => t.id), "every term has an id to link to");
  ok(new Set(terms.map(t => t.id)).size === terms.length, "no duplicate term ids");

  /* it must read with JavaScript off, so no <dt> may be empty of markup */
  ok(!!gd.querySelector(".gloss dl"), "entries live in a dl, not loose in the section");
  ok([...gd.querySelectorAll(".gloss dt")].every(t => t.nextElementSibling?.tagName === "DD"),
     "every dt is followed by its dd");

  /* every unit that is written should be cited at least once, and no
     citation may point at a unit that is not */
  const cited = new Set([...gd.querySelectorAll(".g-unit")]
    .map(a => (a.getAttribute("href") || "").split("/").pop().replace(".html", "")));
  for (const u of live) {
    ok(cited.has(u.slug), `glossary cites Unit ${u.unit}`);
  }
  const plannedSlugs = new Set(planned.map(u => u.slug));
  ok(![...cited].some(c => plannedSlugs.has(c)),
     "no glossary entry links to an unwritten unit");
}

/* Every id the glossary offers, so unit back-links can be checked. */
const glossIds = new Set(
  [...readFileSync(`${SITE}reference/glossary.html`, "utf8")
      .matchAll(/<dt id="([^"]+)"/g)].map(m => m[1]));

/* ---------- 4. every written unit page ---------- */
for (const u of live) {
  head(`units/${u.slug}.html   (Unit ${u.unit})`);
  const w = await load(`units/${u.slug}.html`);
  const p = w.document;
  const at = (m) => `Unit ${u.unit}: ${m}`;

  ok(p.title.includes(`Unit ${u.unit}`), at("title names the unit"), p.title);
  ok(p.title.includes(u.title), at("title names the topic"));
  ok(p.querySelector(".masthead").textContent.includes(`Unit ${u.unit}`), at("masthead"));
  ok(p.querySelector(".unit-meta").textContent.includes(u.wooldridge), at("readings shown"));
  ok(!!p.querySelector(".box.key"), at("has a learning-objectives box"));
  ok(!!p.querySelector(".sources"), at("has a source list"));

  /* figures */
  const figs = [...p.querySelectorAll(".viz[data-viz]")];
  ok(figs.length >= 1, at("has at least one figure"));
  figs.forEach(f => {
    const name = f.getAttribute("data-viz");
    ok(!!f.querySelector("svg"), at(`figure "${name}" rendered`));
    ok(!f.querySelector(".viz-fallback"), at(`figure "${name}" replaced its fallback`));
    ok(!/NaN|Infinity/.test(f.innerHTML), at(`figure "${name}" has no NaN in its geometry`));
  });

  /* tutorial */
  const tqs = [...p.querySelectorAll(".tq")];
  ok(tqs.length >= 3, at("at least 3 tutorial questions"), String(tqs.length));
  tqs.forEach((t, i) => {
    const d = t.querySelector("details");
    ok(d && d.querySelector(".solution"), at(`tutorial Q${i + 1} has a solution`));
    ok(d && !d.hasAttribute("open"), at(`tutorial Q${i + 1} ships closed`));
  });

  /* quizzes — the house rules from assets/quiz.js */
  const qs = [...p.querySelectorAll(".quiz")];
  ok(qs.length >= 2, at("at least 2 self-test items"), String(qs.length));
  qs.forEach((q, i) => {
    const opts = [...q.querySelectorAll(".opt")].map(o => o.textContent.length);
    const spread = Math.max(...opts) - Math.min(...opts);
    const ans = +q.getAttribute("data-answer");
    ok(opts.length >= 3, at(`quiz ${i + 1} has 3+ options`));
    ok(spread <= 12, at(`quiz ${i + 1} option lengths within 12`), `spread ${spread}`);
    ok(Number.isInteger(ans) && ans >= 0 && ans < opts.length,
       at(`quiz ${i + 1} data-answer in range`), String(ans));
    ok(q.querySelector(".feedback.right") && q.querySelector(".feedback.wrong"),
       at(`quiz ${i + 1} has both feedback branches`));
  });

  /* glossary back-links — generated by dev/link-glossary.mjs */
  const gts = [...p.querySelectorAll("a.gt")];
  ok(gts.length >= 5, at("links terms back to the glossary"), String(gts.length));
  const badGt = gts.map(a => a.getAttribute("href") || "")
                   .filter(h => !glossIds.has(h.split("#")[1] || ""));
  ok(badGt.length === 0, at("every glossary back-link resolves"), badGt.join(" "));

  /* one link per term: a page peppered with the same link is worse to read */
  const gtIds = gts.map(a => (a.getAttribute("href") || "").split("#")[1]);
  ok(new Set(gtIds).size === gtIds.length,
     at("no term linked twice"),
     gtIds.filter((x, i) => gtIds.indexOf(x) !== i).join(" "));

  /* and never inside a self-test, a heading or an equation */
  const misplaced = gts.filter(a =>
    a.closest(".quiz, .eqn-report, h1, h2, h3, .qtext, p.math, .viz"));
  ok(misplaced.length === 0, at("no back-link inside a quiz, heading or equation"),
     String(misplaced.length));

  /* nav must never point at an unwritten unit */
  const i = C.units.indexOf(u);
  const prev = C.units[i - 1], next = C.units[i + 1];
  const hrefs = [...p.querySelectorAll(".lesson-nav a")].map(a => a.getAttribute("href"));
  ok(hrefs.includes("../index.html"), at("has a home link"));
  const wants = (n) => n && n.status !== "planned" ? `${n.slug}.html` : null;
  [["prev", wants(prev)], ["next", wants(next)]].forEach(([which, exp]) => {
    if (exp) ok(hrefs.includes(exp), at(`${which} arrow points at ${exp}`), hrefs.join(" "));
    else ok(!hrefs.some(h => /^\w.*\.html$/.test(h) && h !== "../index.html" &&
                             h !== wants(prev) && h !== wants(next)),
            at(`no ${which} arrow to an unwritten unit`));
  });
}

/* ---------- 5. reader controls and downloads ----------
   Every page carries the preferences bar, and every page must be able to
   export itself. The coverage assertion is the one that matters: an
   earlier walker silently dropped every callout box and assumption grid,
   which is thousands of words a unit, and nothing failed. */
head("reader controls and downloads");
for (const f of ["index.html", ...live.map(u => `units/${u.slug}.html`),
                 ...refLive.map(r => `reference/${r.slug}.html`)]) {
  const w = await load(f);
  const d = w.document;
  const at = (m) => `${f}: ${m}`;

  const src = readFileSync(SITE + f, "utf8");
  ok(/econ3049-theme/.test(src), at("carries the no-flash preference script"));
  ok(/assets\/reader\.js/.test(src) && /assets\/export\.js/.test(src),
     at("loads reader.js and export.js"));

  const bar = d.querySelector(".reader-bar");
  ok(!!bar && bar.children.length === 3, at("reader bar rendered with 3 groups"),
     bar ? String(bar.children.length) : "missing");

  /* theme and text size actually apply, and the figures survive a rebuild */
  const btn = (t) => [...bar.querySelectorAll("button")]
                     .find(b => b.textContent.trim() === t);
  btn("Dark").dispatchEvent(new w.MouseEvent("click"));
  ok(d.documentElement.getAttribute("data-theme") === "dark", at("Dark applies"));
  btn("Auto").dispatchEvent(new w.MouseEvent("click"));
  ok(!d.documentElement.hasAttribute("data-theme"), at("Auto clears the override"));
  btn("A+").dispatchEvent(new w.MouseEvent("click"));
  ok(d.documentElement.getAttribute("data-text") === "l", at("A+ steps the text size"));

  const figs = [...d.querySelectorAll(".viz[data-viz]")];
  ok(figs.every(v => !!v.querySelector("svg")), at("figures survive a theme rebuild"));
  ok(!figs.some(v => /NaN/.test(v.innerHTML)), at("no NaN after rebuild"));

  /* exports produce something, and something big enough to be the page */
  const visible = (d.querySelector(".wrap") || d.body).textContent
                    .replace(/\s+/g, " ").trim().length;
  for (const fmt of ["md", "tex", "doc"]) {
    const out = w.EXPORT.build(fmt);
    ok(out.length > 0, at(`exports ${fmt}`));
    if (fmt === "md") {
      ok(out.length > visible * 0.6,
         at("markdown keeps most of the page"),
         `${out.length} chars vs ${visible} visible`);
    }
  }
  /* a LaTeX file that will not compile is worse than none: no bare Greek
     or combining marks may survive the converter */
  const tex = w.EXPORT.build("tex");
  const stray = [...new Set((tex.match(/[\u0300-\u036f\u0370-\u03ff\u2070-\u209f]/g) || []))];
  ok(stray.length === 0, at("LaTeX has no unconverted Unicode"), stray.join(" "));
}

/* ---------- 6. house conventions, across the built site ---------- */
head("conventions");
for (const u of live) {
  const src = readFileSync(`${SITE}units/${u.slug}.html`, "utf8");
  const body = src.replace(/<div class="box warn">[\s\S]*?<\/div>/g, "")
                  .replace(/<ol class="sources">[\s\S]*?<\/ol>/g, "");
  ok(!/β<sub>0<\/sub>/.test(body),
     `Unit ${u.unit}: no Wooldridge β₀ outside the warning box and sources`);
  ok(!/heteroskedastic/i.test(src), `Unit ${u.unit}: uses the -sc- spelling`);
  ok(/<html lang="en">/.test(src), `Unit ${u.unit}: declares a language`);
  ok(/viewport/.test(src), `Unit ${u.unit}: has a viewport meta`);
}

console.log(`\n${count - fail}/${count} checks passed${fail ? ` — ${fail} FAILED` : ""}\n`);
process.exit(fail ? 1 : 0);
