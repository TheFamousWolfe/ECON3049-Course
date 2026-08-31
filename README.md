# ECON 3049 — Econometrics I

The course notes for ECON 3049 (UWI Cave Hill), written out as a small static
website. These pages replace the lecture slide decks: each unit page carries the
theory in full, the algebra worked through, an interactive figure, a worked
example in the reporting format used in the exam, tutorial questions with
revealable solutions, and a short self-test.

## Running it

There is no build step, no npm, no dependencies. Open `index.html`.

To check it the way GitHub Pages will serve it:

```sh
python3 -m http.server 8000     # then browse http://localhost:8000/
```

Do this before pushing — macOS is case-insensitive locally and Pages is not.

## Checking it

`dev/check-site.mjs` loads every written unit in a headless browser and checks it.
It derives its expectations from the manifest, so it keeps working as units are
added — no test to update when a unit flips to `ready`.

```sh
cd dev && npm install jsdom && cd .. && node dev/check-site.mjs
```

It verifies that the roadmap matches the manifest, that every figure actually
renders (and contains no `NaN` geometry), that tutorial solutions ship closed,
that quiz options obey the equal-length rule and every `data-answer` is in range,
that no navigation arrow points at an unwritten unit, and that Wooldridge's β₀
has not leaked in outside the notation warning.

For `reference/` it also checks that every linked page exists, that every
cross-link and in-page anchor resolves, and that the glossary cites every unit
that has been written and none that has not. Run it before every push.

**The site itself has no dependencies.** jsdom is a dev-only install and is
gitignored; nothing in `assets/`, `units/` or `reference/` requires it.

## Structure

```
index.html            roadmap, rendered from the manifest
assets/course.js      THE MANIFEST — course structure, dates, unit list
assets/nav.js         renders roadmap, breadcrumbs, prev/next from the manifest
assets/viz.js         interactive SVG figures, one per unit
assets/quiz.js        multiple-choice self-test widget
assets/glossary.js    glossary filter (progressive enhancement only)
assets/reader.js      text size, theme and the download menu
assets/export.js      Word / Markdown / LaTeX converters
assets/lesson.css     base typography and palette
assets/course.css     course-site components (.eqn-report, .tutorial, .viz …)
units/                one page per unit, 1A through 3C
reference/            glossary (written); EViews guide, formula sheet (planned)
```

## Writing a new unit — the actual sequence

Units are built from the lecture decks in `../Econ3049/LectureNotes/`. **The
decks are the source of truth** for what is taught and in what order — check the
deck filenames rather than the printed course outline, which differs from them in
places (Unit 1's topics and ordering, and the fact that 2A is delivered in two
parts). Where the two disagree, the decks win.

```sh
pdftotext -layout "../Econ3049/LectureNotes/UNIT 2B - Multicollinearity.pdf" -
```

Then, in this order — the checker enforces most of it, so a missed step fails
loudly rather than silently:

1. **Write `units/<slug>.html`.** Copy the shape of an existing unit: learning
   objectives in a `.box.key`, numbered sections, `.eqn-report` for every set of
   results, a `.tutorial` block, a "Check yourself" block, an `.ask-teacher`
   note, an `<ol class="sources">`, and the `.lesson-nav` footer. Every
   `data-unit` attribute must carry the manifest's unit code exactly —
   `"2A Part 1"`, not `"2A"`.
2. **Add the figures to `assets/viz.js`.** One `VIZ.register(name, fn)` per
   figure, with a `.viz-fallback` paragraph in the page so it degrades. Shared
   helpers already there: `ols`, `ols3`, `olsk` (k-variable, Gauss–Jordan),
   `tPdf` / `tCdf` / `tCrit`, `chart`, `pointAt`.
3. **Flip `status` to `"ready"`** in `assets/course.js`.
4. **Add the unit's new terms to the glossary**, each citing the new unit. If a
   term is only *named* in an earlier unit but *derived* in this one, re-point
   its `.g-unit` link here.
5. **`node dev/link-glossary.mjs`** to back-link the prose.
6. **`node dev/stamp-assets.mjs`** if you touched anything in `assets/`.
7. **`node dev/check-site.mjs`** until it is clean.

Step 7 catches, in practice: quiz options whose lengths give the answer away,
a unit the glossary forgot, missing back-links, figures that render `NaN`, and
`data-unit` codes that do not match the manifest.

**Verify the figures against theory before trusting them.** Every figure so far
has been checked by driving its controls from jsdom and comparing the readouts
with the closed-form result — the omitted-variable figure against
β₃δ̃₁, the variance-inflation figure against √(1/(1 − R²₂₃)), the t-distribution
against printed tables, the Chow figure against F(2, 96) = 3.09, the 2B ridge
against the invariance of RSS along β̂₂ + α₂β̂₃ = c, and the VIF curve against
1/(1 − R²ⱼ) = 10 at R²ⱼ = 0.9. In Unit 3A the dummy figures are checked against
identities rather than formulas, which is stronger: β̂₁ = Ȳ₀ and β̂₂ = Ȳ₁ − Ȳ₀ for a
lone dummy, the dummy's standard error against the pooled two-sample one, and — for
the fully interacted model — its two fitted lines against the two subsample
regressions and RSS_UR against RSS₁ + RSS₂. Three figures were wrong in ways that
only showed up that way; 3A's was a caption claiming an R² that changes when the
constant is dropped, which the centred R² the figure printed does not.

Figures that simulate should draw from a **seeded** generator rather than
`Math.random`, so that every reader sees the same sample and a tutorial answer
can quote it. `high-r2-low-t` uses MINSTD, whose products stay inside exact
double arithmetic.

**Do not use an LCG for anything you average over.** Unit 2C's `robust-se`
compares a Monte Carlo standard deviation against a closed form, and MINSTD's
lattice — consecutive pairs feeding Box–Muller — put the simulation about 4%
below the theory it was meant to confirm. `rng2c` is mulberry32 and lands on
it. A figure that quietly misses its own theory is worse than no figure.

**Check a fixed draw against every setting the figure offers.** With 23
observations per third, the first seed for `residual-plot-shapes` had a weak
middle third, which cancelled the arch-shaped variance exactly. The figure was
drawing the noise, not the form. Drive every control before believing any of
it.

**Where a deck's formula and the textbook's disagree, simulate before
printing either.** Unit 2D's slide 9 gives a compressed expression for
var(β̂₂) under AR(1) that a Monte Carlo does not reproduce; Gujarati's full
form, with the bracket in ρˢ·Σxₜxₜ₋ₛ/Σxₜ², matches to three decimals at every
ρ. The unit prints the form that the simulation confirms and flags the
difference in a box, rather than reproducing a result it cannot verify.

## Adding or changing a unit

Edit `assets/course.js` and nothing else. The roadmap, the breadcrumb, the
week labels and the prev/next arrows all read from it.

```js
{ unit: "2C", part: "2", week: 9, slug: "2c-heteroscedasticity",
  title: "Heteroscedasticity", blurb: "…",
  wooldridge: "Ch. 8", gujarati: "Ch. 11", slides: 32,
  deck: "UNIT 2C - Heteroscedasticity.pdf", status: "ready" }
```

- `status`: `"planned"` (listed, not linked) → `"draft"` (linked, amber pill)
  → `"ready"` (linked, green pill).
- `week`: `null` renders as an em dash. Re-timetabling means editing these
  numbers; because URLs are keyed to the unit code, no link ever breaks.
- `deckBaseUrl` at the top of the manifest: set it to your eLearning folder URL
  and every unit page grows a link to the original slides.

## The glossary

`reference/glossary.html` is written **as each unit is written**, not at the end.
It links in both directions: out to the unit that defines each term, and back
from the units to the glossary.
Every unit page introduces terms in bold; those terms belong in the glossary the
same day, each with a `<dt id="...">` and a `.g-unit` link back to the unit that
defines it.

```html
<dt id="autocorrelation">Autocorrelation <a class="g-unit" href="../units/1c-ols-assumptions-goodness-of-fit.html">Unit 1C</a></dt>
<dd>Correlation between the disturbances of different observations …</dd>
```

`check-site.mjs` fails if a written unit is never cited, or if an entry links to a
unit that does not exist yet, so a forgotten unit shows up on the next run.

### Linking the units back

Do not hand-write the back-links. After writing a unit:

```sh
node dev/link-glossary.mjs --dry     # show what it would link
node dev/link-glossary.mjs           # do it
node dev/link-glossary.mjs --unlink  # strip them all out again
```

It links the **first** occurrence of each glossary term in each unit, and only in
running prose — bare `<p>` blocks. Headings, `<p class="math">`, `.eqn-report`
displays, tutorial question text and quiz options are left alone: a link inside a
self-test is a distraction, and a link inside an equation is noise. Running it
twice changes nothing, so it is safe in a loop; if you re-flow a unit's prose and
want the links redistributed, `--unlink` first.

Spellings come from the glossary itself. A `<dt>` is matched by its own text plus
an optional plural; where that is not how the term reads in prose, give it a
`data-match` list:

```html
<dt id="endogeneity" data-match="endogeneity, endogenous">
<dt id="prf" data-match="population regression function, PRF">
```

ALL-CAPS phrases match case-sensitively, so the word "blue" is never mistaken for
BLUE. `check-site.mjs` verifies every back-link resolves to a real entry, that no
term is linked twice on a page, and that none landed somewhere it should not.

Entries are grouped `<h2>` + `<dl>` inside `<section class="gloss">` — headings
cannot sit inside a `<dl>`. `assets/glossary.js` adds the search box on top of that
markup and nothing else: **the page must read completely with JavaScript off.**

Reference pages are listed in the manifest's `reference` array with the same
`status` field the units use, so one that has not been written yet is named on the
home page but not linked.

## Asset caching

GitHub Pages serves assets with `cache-control: max-age=600`. For ten
minutes after a push, a returning reader can get **new HTML against an old
stylesheet** — which is exactly how the preferences bar first shipped
completely unstyled, markup arriving without the CSS that lays it out.

Every asset link therefore carries a stamp derived from a hash of the assets
themselves:

```html
<link rel="stylesheet" href="../assets/course.css?v=5ed93599">
```

Change any asset and the hash changes, so the URL changes, so no browser can
serve a stale copy. After editing anything in `assets/`:

```sh
node dev/stamp-assets.mjs           # rewrite the stamps
node dev/stamp-assets.mjs --check   # verify without writing
```

`check-site.mjs` runs the same verification, so a forgotten stamp fails the
suite rather than reaching a student.

## Reader preferences and downloads

Every page carries a small control bar: **text size**, **theme** and
**Download**. Preferences are stored per reader in `localStorage` and apply
across the site. With JavaScript off the bar does not appear, the page
follows the reader's system theme through `prefers-color-scheme`, and
printing still works from the browser's own menu.

### Themes

**Every colour in the site comes from a custom property on `:root`** — the
SVG figures included. `assets/viz.js` reads the tokens through
`getComputedStyle` at draw time, so adding or changing a theme means editing
the token block in `lesson.css` and nothing else. Never hard-code a colour in
a figure; there is a `P.accent` / `P.ink` / `P.paper` for it.

A theme change calls `VIZ.redraw()`, which rebuilds every figure from
scratch. That resets slider positions, which is a fair price for not
threading a recolour path through nineteen closures.

The no-flash behaviour is a tiny inline script in each page's `<head>` that
stamps `data-theme` and `data-text` before first paint. It has to be inline
and it has to be in the head — a deferred script would let a white flash
through on every navigation.

### Downloads

| Format | How it works | Quality |
| --- | --- | --- |
| PDF | `window.print()`, using the print stylesheet | Best. Respects what the reader expanded on screen |
| Word | HTML served as `application/msword` | Good. Not a real `.docx`; Word may warn about the extension |
| Markdown | DOM walk, Unicode sub/superscripts | Clean |
| LaTeX | DOM walk, real `\beta` / `_{}` / `\hat{}` | Compiles under pdfLaTeX; equations want a read-through |

`check-site.mjs` verifies that every page exports, that Markdown retains at
least 60% of the visible text, and that **no unconverted Greek, combining mark
or maths operator survives into the LaTeX** — a `.tex` that will not compile is
worse than no `.tex` at all. To check that claim properly, compile them:

```sh
node dev/check-site.mjs      # catches unconverted characters
# then, if you have a TeX toolchain:
pdflatex -interaction=nonstopmode <unit>.tex
```

All fourteen pages currently compile. Five of them did not on the first attempt,
and the failures were only visible by actually running `pdflatex` — bare
Greek inside `<sub>`, stacked accents (Y with *two* combining marks), and
`\sqrt` emitted with no radicand. Unit 2B added a sixth: a `≫` that no range
in the checker was watching. Compile after writing a unit even when the suite
is green — the character class can only catch what someone has thought of.

## House conventions

These are not stylistic preferences — breaking them creates real confusion for
students, so they are worth keeping.

- **Notation is Gujarati's.** β₁ is the intercept, β₂ the slope, with β₂X₂ᵢ +
  β₃X₃ᵢ in multiple regression and α's in auxiliary regressions. Wooldridge's
  β₀/β₁ must never appear, even though Wooldridge is a recommended text.
- **Results are reported as equations**, using `.eqn-report`: coefficients on
  the first row, standard errors in parentheses beneath, t-statistics below
  that. This is the form students must reproduce under exam conditions.
- **Spelling:** *heteroscedasticity*, with the `sc`, matching the course
  outline and the deck filenames.
- **Quiz options must all be about the same length.** Option length is a tell,
  and a widget that leaks the answer teaches nothing. The markup contract is
  documented at the top of `assets/quiz.js`.
- **Every figure degrades.** A unit page must still read correctly with
  JavaScript off; figures are illustration, never the only place an idea
  appears.

## What must not go in this repository

- **The textbooks.** `*.pdf` is in `.gitignore` for that reason. Gujarati &
  Porter and Wooldridge are copyrighted; students get them from eLearning.
- **Anything that answers the graded group assignment.** The EViews guide
  teaches the software; it does not work the assignment.

## Where things stand

**Published at https://thefamouswolfe.github.io/ECON3049-Course/** from the
`main` branch of a public GitHub repository. Pushing to `main` rebuilds the
live site in about half a minute, so the checker has to pass *before* the
push, not after — a broken push is publicly broken. The repository is public
because GitHub Pages on a free plan requires it, and because this site has no
build step: the source and the served artifact are the same files, so keeping
the repository private would have hidden nothing that is not already served.

Progress is recorded in the manifest, not here — `status: "ready"` is the
authority, and `node dev/check-site.mjs` prints every written unit. As of the
last session: **Units 1 and 2 are complete** — 1A–1F, 2A (both parts), 2B, 2C and
2D — and **Unit 3A is written**, leaving 3B (Endogeneity) and 3C (IV, 2SLS and
simultaneous equations) `"planned"`. Those two are one topic in two decks and are
best written together: 3B ends on the problem that 3C's instruments solve.

Three things are deliberately unfinished, and all three need input rather than
writing:

- **The calendar is empty.** `teachingPeriod`, every `when` in `assessment`, and
  every `week` from 1C onwards are `null`, so the home page says "teaching period
  to be confirmed" and the roadmap shows em dashes. This is one edit to
  `assets/course.js` once the dates are known — no page changes.
- **`reference/formula-sheet.html`** is `"planned"`. Units 1C to 1F have now
  derived essentially everything that belongs on it, so it is assembly work.
- **`reference/eviews-guide.html`** is `"planned"`. This is the one with stakes:
  the 25% group assignment is graded on EViews.

Both unwritten reference pages are named but not linked on the home page, so
nothing is broken by their absence.
