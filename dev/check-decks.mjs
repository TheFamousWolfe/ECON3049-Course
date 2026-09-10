/* Regression suite for the lecture decks.

   The decks are private and live outside the repository (by default in
   ../Econ3049/Slides beside the midterm), so check-site.mjs never sees
   them. This script loads each one in jsdom with the site's assets, as a
   browser would, and checks the things a lecturer would otherwise
   discover in front of the room.

     node dev/check-decks.mjs                          # ../Econ3049/Slides/*.html
     node dev/check-decks.mjs dev/fixtures             # the in-repo fixture
     node dev/check-decks.mjs path/to/one-deck.html

   It also runs a privacy guard over the public pages regardless of the
   argument: nothing served may point at the private folder.            */
import { JSDOM, VirtualConsole } from "jsdom";
import { readFileSync, existsSync, readdirSync, statSync } from "fs";
import { resolve, dirname, join, basename } from "path";

const SITE = new URL("../", import.meta.url).pathname;
const arg = process.argv[2] || join(SITE, "../Econ3049/Slides");
const target = resolve(arg);

let fail = 0, count = 0;
const ok = (c, m, x = "") => {
  count++;
  if (!c) fail++;
  if (!c || process.env.VERBOSE) console.log(`${c ? "  ok  " : "FAIL  "}${m}${x ? "  — " + x : ""}`);
};
const head = (s) => console.log(`\n${s}`);

/* jsdom has no window.open or fullscreen; the engine is written to
   tolerate that, and the "Not implemented" notices are noise. Anything
   else a page logs is a real problem and is shown. */
const vc = new VirtualConsole();
vc.on("jsdomError", e => { if (!/not implemented/i.test(e.message)) console.error("  jsdom:", e.message); });
vc.on("error", (...a) => console.error("  page:", ...a));

const load = async (file) => {
  const dom = await JSDOM.fromFile(file, {
    runScripts: "dangerously", resources: "usable", pretendToBeVisual: true, virtualConsole: vc
  });
  await new Promise(r => dom.window.addEventListener("load", r));
  await new Promise(r => setTimeout(r, 150));
  return dom.window;
};

/* ---------- 0. privacy guard over the public pages ---------- */
head("privacy guard (public pages)");
const publicPages = [
  join(SITE, "index.html"),
  ...readdirSync(join(SITE, "units")).filter(f => f.endsWith(".html")).map(f => join(SITE, "units", f)),
  ...readdirSync(join(SITE, "reference")).filter(f => f.endsWith(".html")).map(f => join(SITE, "reference", f))
];
const leaks = publicPages.filter(p => /Slides\/|Econ3049\//.test(readFileSync(p, "utf8")));
ok(leaks.length === 0, "no public page points at the private folder", leaks.map(basename).join(", "));

/* ---------- 1. the decks ---------- */
if (!existsSync(target)) {
  console.log(`\nno decks at ${target} — nothing more to check`);
  console.log(`\n${count - fail}/${count} checks passed`);
  process.exit(fail ? 1 : 0);
}
/* Dotfiles are skipped: check-fit.mjs measures a deck by writing a
   throwaway `.fit-…html` copy beside the original, and a crashed run can
   leave one behind. Checking it would report a phantom deck. */
const decks = statSync(target).isDirectory()
  ? readdirSync(target).filter(f => f.endsWith(".html") && !f.startsWith("."))
      .sort().map(f => join(target, f))
  : [target];

for (const file of decks) {
  const at = (m) => `${basename(file)}: ${m}`;
  head(basename(file));
  const src = readFileSync(file, "utf8");

  /* source */
  ok(/<html lang="en" data-theme="light">/.test(src), at("lang=en, and opens in the light palette"));
  ok(/<meta charset="utf-8">/.test(src), at("charset"));
  ok(!/econ3049-theme/.test(src), at("does not read the site's saved reader theme"));
  for (const a of ["slides.css", "slides.js", "viz.js", "course.js"]) {
    ok(new RegExp(`assets/${a.replace(".", "\\.")}"`).test(src), at(`loads ${a}`));
  }
  ok(!/reader\.js/.test(src), at("does not load reader.js"));
  ok(!/\?v=[0-9a-f]+/.test(src), at("no cache stamps (a local file needs none)"));
  ok(!/class="wrap"/.test(src), at("does not use .wrap"));
  const refs = [...src.matchAll(/(?:href|src)="([^"]+\.(?:css|js))"/g)].map(m => m[1]);
  const missing = refs.filter(r => !existsSync(resolve(dirname(file), r)));
  ok(missing.length === 0, at("every asset link resolves"), missing.join(", "));

  /* conventions, as on the unit pages */
  const bodyNoWarn = src.replace(/<div class="box warn">[\s\S]*?<\/div>/g, "");
  ok(!/β<sub>0<\/sub>/.test(bodyNoWarn), at("no Wooldridge β₀ outside the notation warning"));
  ok(!/heteroskedastic/i.test(src), at("heteroscedasticity, with the sc"));

  /* structure and engine, in a browser */
  const w = await load(file);
  const d = w.document;
  const slides = [...d.querySelectorAll("main.deck > section.slide")];
  ok(d.querySelectorAll("main.deck").length === 1, at("exactly one main.deck"));
  ok(slides.length >= 4, at("at least 4 slides"), String(slides.length));
  ok(slides.every(s => s.querySelector("h1, h2")), at("every slide has a heading"));
  ok(slides.every(s => (s.querySelector("aside.notes") || {}).textContent?.trim()), at("every slide has speaker notes"));
  const code = d.querySelector('[data-course="code"]');
  if (code) ok(code.textContent === w.COURSE.code, at("[data-course] fields filled"));

  const figs = [...d.querySelectorAll(".viz[data-viz]")];
  figs.forEach(f => {
    const name = f.getAttribute("data-viz");
    ok(!!f.querySelector("svg"), at(`figure "${name}" rendered`));
    ok(!f.querySelector(".viz-fallback"), at(`figure "${name}" replaced its fallback`));
    ok(!/NaN|Infinity/.test(f.innerHTML), at(`figure "${name}" has no NaN in its geometry`));
  });

  const current = () => slides.indexOf(d.querySelector("main.deck > section.slide.current")) + 1;
  const key = (k) => d.dispatchEvent(new w.KeyboardEvent("keydown", { key: k, bubbles: true }));
  ok(current() === 1, at("opens on slide 1"), String(current()));
  ok(w.location.hash === "#/1" || w.location.hash === "", at("hash is #/1"), w.location.hash);
  ok(!!d.querySelector(".deck-progress") && !!d.querySelector(".deck-hud"), at("progress bar and counter injected"));

  /* fragments: find the first slide with steps and walk them */
  const stepped = slides.find(s => s.querySelector(".fragment"));
  if (stepped) {
    const n = slides.indexOf(stepped) + 1;
    w.location.hash = "#/" + n; w.dispatchEvent(new w.Event("hashchange"));
    ok(current() === n, at(`hashchange goes to slide ${n}`), String(current()));
    const total = stepped.querySelectorAll(".fragment").length;
    ok(stepped.querySelectorAll(".fragment.visible").length === 0, at("steps start hidden"));
    for (let k = 1; k <= total; k++) {
      key("ArrowRight");
      ok(stepped.querySelectorAll(".fragment.visible").length === k && current() === n,
         at(`step ${k} of ${total} reveals one item and stays`));
    }
    key("ArrowRight");
    ok(current() === n + 1, at("after the last step, → moves on"), String(current()));
    key("ArrowLeft");
    ok(current() === n && stepped.querySelectorAll(".fragment.visible").length === total,
       at("← back onto a stepped slide shows every step"));
    key("Home");
    w.location.hash = "#/" + n + "/all"; w.dispatchEvent(new w.Event("hashchange"));
    ok(current() === n && stepped.querySelectorAll(".fragment.visible").length === total,
       at("#/n/all opens a slide with every step shown"));
  }

  key("End");  ok(current() === slides.length, at("End goes to the last slide"), String(current()));
  ok(w.location.hash === "#/" + slides.length, at("hash follows"), w.location.hash);
  key("Home"); ok(current() === 1, at("Home goes to the first"), String(current()));
  key("ArrowRight"); key("ArrowRight");
  const before = current();

  /* keys typed into a figure's slider must not move the deck */
  const range = d.querySelector('.viz input[type="range"]');
  if (range) {
    range.dispatchEvent(new w.KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    ok(current() === before, at("arrow keys inside a slider stay in the slider"));
  }

  /* opens light; t flips to dark for this window and rebuilds the figures */
  ok(d.documentElement.getAttribute("data-theme") === "light", at("opens in the light palette"));
  key("t");
  ok(d.documentElement.getAttribute("data-theme") === "dark", at("t switches to dark"));
  ok(figs.every(f => !!f.querySelector("svg")), at("figures survive the theme rebuild"));
  ok(!figs.some(f => /NaN/.test(f.innerHTML)), at("no NaN after rebuild"));
  let stored = null;
  try { stored = w.localStorage.getItem("econ3049-theme"); } catch (e) { /* opaque origin */ }
  ok(stored === null, at("t does not touch the site's reader preference"));
  key("t");
  ok(d.documentElement.getAttribute("data-theme") === "light", at("t again returns to light"));

  /* presenter key with no window.open available */
  let threw = false;
  try { key("p"); } catch (e) { threw = true; }
  ok(!threw && current() === before, at("p without a popup neither throws nor moves"));

  key("?"); ok(!d.querySelector(".deck-help").hidden, at("? shows the help"));
  key("Escape"); ok(d.querySelector(".deck-help").hidden, at("Escape hides it"));

  const notes = d.querySelector("aside.notes");
  ok(w.getComputedStyle(notes).display === "none", at("notes are hidden on screen"));

  /* print stylesheet present in slides.css */
  const cssPath = refs.find(r => /slides\.css$/.test(r));
  const css = readFileSync(resolve(dirname(file), cssPath), "utf8");
  ok(/@media print/.test(css) && /@page/.test(css), at("slides.css carries the print layout"));

  w.close();
}

console.log(`\n${count - fail}/${count} checks passed`);
process.exit(fail ? 1 : 0);
