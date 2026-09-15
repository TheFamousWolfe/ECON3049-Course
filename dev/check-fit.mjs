/* Projector-fit check for the lecture decks.

   check-decks.mjs loads a deck in jsdom, which has no layout engine: it
   can tell you a slide has a heading and notes, but not that the slide
   is taller than the screen and the heading has been pushed off the top.
   That is the failure a lecturer discovers in front of the room, and it
   is what this script catches.

   Each deck is loaded in headless Chrome at 1280 × 720 and 1920 × 1080,
   the two sizes the README asks you to walk a deck at. Every slide is
   made current in turn with all of its steps revealed — the worst case,
   since .fragment uses visibility and so occupies space either way — and
   its scrollHeight compared with its clientHeight. A slide taller than
   its frame is reported with the number of pixels lost.

     node dev/check-fit.mjs                          # ../Econ3049/Slides
     node dev/check-fit.mjs dev/fixtures             # the in-repo fixture
     node dev/check-fit.mjs path/to/one-deck.html

   Two thresholds, both calibrated against the pilot deck, which fits:

     TOLERANCE   24px of vertical overflow is invisible on a projector —
                 sub-pixel rounding in the flex column and the descenders
                 of the last line. Above it, content is genuinely cut.
     horizontal  not reported at all. Every figure slide, the pilot's
                 included, measures a constant ~34px of horizontal
                 overflow that does not correspond to anything clipped on
                 screen; flagging it would be thirteen false alarms.

   Chrome is found at the macOS default or $CHROME. Without it the script
   says so and exits 0, so it never fails a suite on a machine that has
   no browser — unlike the content checks, this one needs a real one. */
import { execFileSync } from "child_process";
import { readdirSync, statSync, readFileSync, writeFileSync, unlinkSync, existsSync } from "fs";
import { resolve, join, basename, dirname } from "path";

const SITE = new URL("../", import.meta.url).pathname;
const TOLERANCE = 24;
const SIZES = ["1280,720", "1920,1080"];

const CHROME = process.env.CHROME ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
if (!existsSync(CHROME)) {
  console.log(`no Chrome at ${CHROME} — skipping the projector-fit check`);
  console.log("set $CHROME to a Chrome or Chromium binary to run it");
  process.exit(0);
}

const arg = process.argv[2] || join(SITE, "../Econ3049/Slides");
const target = resolve(arg);
if (!existsSync(target)) {
  console.log(`no decks at ${target} — nothing to check`);
  process.exit(0);
}
const decks = statSync(target).isDirectory()
  ? readdirSync(target).filter(f => f.endsWith(".html") && !f.startsWith("."))
      .sort().map(f => join(target, f))
  : [target];

/* Injected into a throwaway copy of the deck. It cannot return a value,
   so it leaves the measurements in a <pre> for --dump-dom to carry out. */
const PROBE = `
<script>
window.addEventListener("load", function () {
  /* viz.js mounts the figures asynchronously. Measuring before they are
     drawn reads a slide as shorter than it is and quietly passes a deck
     that does not fit, so wait for every figure to have its <svg> (and
     for the fonts) before measuring, with a ceiling so a figure that
     never renders still reports rather than hanging. */
  function figuresReady() {
    var figs = document.querySelectorAll(".viz[data-viz]");
    for (var i = 0; i < figs.length; i++) if (!figs[i].querySelector("svg")) return false;
    return true;
  }
  var waited = 0;
  (function settle() {
    if ((!figuresReady() || !document.fonts || document.fonts.status !== "loaded") && waited < 4000) {
      waited += 100;
      return setTimeout(settle, 100);
    }
    setTimeout(measure, 250);
  })();

  function measure() {
    var out = [];
    document.querySelectorAll("main.deck > section.slide").forEach(function (s, i) {
      var prev = s.className;
      s.classList.add("current");
      s.querySelectorAll(".fragment").forEach(function (f) { f.classList.add("visible"); });
      void s.offsetHeight;
      var over = s.scrollHeight - s.clientHeight;
      if (over > ${TOLERANCE}) out.push((i + 1) + ":" + over);
      s.className = prev;
    });
    var pre = document.createElement("pre");
    pre.id = "FIT";
    pre.textContent = out.join(" ");
    document.body.appendChild(pre);
  }
});
</script>`;

/* The copy has to sit beside the original: a deck loads the site's
   assets by a relative path, and from anywhere else they would 404 and
   every slide would measure as fitting. */
function measure(file, size) {
  const probe = join(dirname(file), `.fit-${process.pid}-${size.replace(",", "x")}-${basename(file)}`);
  writeFileSync(probe, readFileSync(file, "utf8") + PROBE);
  try {
    const dom = execFileSync(CHROME, [
      "--headless=new", "--disable-gpu", "--window-size=" + size,
      "--virtual-time-budget=6000", "--dump-dom", "file://" + probe
    ], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 64 * 1024 * 1024 });
    const m = /<pre id="FIT">([^<]*)<\/pre>/.exec(dom);
    if (!m) return null;
    return m[1].trim() ? m[1].trim().split(/\s+/) : [];
  } finally {
    unlinkSync(probe);
  }
}
let fail = 0, checked = 0;
for (const file of decks) {
  const name = basename(file);
  const bad = new Map();          /* slide -> worst overflow seen */
  let broken = false;
  for (const size of SIZES) {
    const over = measure(file, size);
    if (over === null) { broken = true; break; }
    for (const entry of over) {
      const [slide, px] = entry.split(":").map(Number);
      if (!bad.has(slide) || bad.get(slide) < px) bad.set(slide, px);
    }
  }
  checked++;
  if (broken) {
    fail++;
    console.log(`FAIL  ${name} — Chrome returned no measurement`);
  } else if (bad.size) {
    fail++;
    const worst = [...bad.entries()].sort((a, b) => b[1] - a[1])
      .map(([s, px]) => `${s} (${px}px)`).join(", ");
    console.log(`FAIL  ${name} — ${bad.size} slide(s) taller than the screen: ${worst}`);
  } else if (process.env.VERBOSE) {
    console.log(`  ok  ${name}`);
  }
}

console.log(`\n${checked - fail}/${checked} deck(s) fit a 16:9 projector at ${SIZES.join(" and ")}`);
if (fail) {
  console.log("A slide taller than the frame loses content off the top and bottom.");
  console.log("Move detail into aside.notes, tighten the prose, or split the slide.");
}
process.exit(fail ? 1 : 0);
