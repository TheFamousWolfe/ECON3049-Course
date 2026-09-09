/* ============================================================
   ECON 3049 — lecture-deck engine

   A deck is a plain HTML page whose body is

     <main class="deck">
       <section class="slide">
         <h2>…</h2>
         …any of the site's components: .box, .assumption-grid, p.math,
           ol.stages, and .viz[data-viz] figures, which viz.js mounts
           exactly as it does on a unit page…
         <aside class="notes">Speaker notes — never shown to the room.</aside>
       </section>
       …
     </main>

   Slides are the section.slide children of main.deck, in order, numbered
   from 1. Put class="fragment" on anything that should appear on a
   keypress; the engine adds .visible. Everything else on screen — the
   progress bar, the counter, the help overlay, the presenter panes — is
   injected here, so a deck file carries content and nothing else.

   Keys:  → ↓ space PgDn enter   next step or slide
          ← ↑ PgUp backspace     previous
          home / end             first / last slide
          t   toggle light/dark (rebuilds every figure — slider state resets)
          f   fullscreen
          p   presenter window (notes, next slide, clock)
          n   include notes when printing
          ?   this list

   The URL hash is #/n, so a slide can be linked to or returned to on
   refresh; #/n/all opens it with every step already shown. Figures need
   nothing special: viz.js mounts every
   .viz[data-viz] in the document at load, hidden or not, because the
   SVGs are sized by viewBox and read no layout when drawn.

   Presenter mode opens the same file again in a popup, with
   window.name = "econ3049-presenter". The two windows talk by
   postMessage, which works between an opener and its popup even over
   file:// (where BroadcastChannel does not, because each file document
   is its own opaque origin). The audience window is the source of
   truth: keys in the presenter window are forwarded to it, it applies
   them, and it broadcasts the resulting state back.

   Not built: an overview grid (o). A 20-slide deck is navigated fine
   with home/end and the hash; the grid is the natural next feature.
   ============================================================ */
(function () {
  "use strict";

  var deck = document.querySelector("main.deck");
  if (!deck) return;

  var slides = Array.prototype.filter.call(deck.children, function (el) {
    return el.matches("section.slide");
  });
  var n = slides.length;
  if (!n) return;

  var root = document.documentElement;
  var cur = 0;                 /* 0-based inside; 1-based in the hash and HUD */
  var win = null;              /* the presenter popup, when we opened one */
  var isPresenter = !!(window.opener && window.name === "econ3049-presenter");
  var started = Date.now();

  function h(tag, cls, text) {
    var el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text != null) el.textContent = text;
    return el;
  }
  function frags(s) { return s.querySelectorAll(".fragment"); }
  function visibleCount(s) { return s.querySelectorAll(".fragment.visible").length; }

  /* ---------- HUD ---------- */
  var progress = h("div", "deck-progress");
  var hud = h("div", "deck-hud");
  var flashTimer = null;
  document.body.appendChild(progress);
  document.body.appendChild(hud);

  function renderHud() {
    progress.style.width = ((cur + 1) / n * 100) + "%";
    hud.textContent = (cur + 1) + " / " + n;
  }
  function flash(msg) {
    hud.textContent = msg;
    clearTimeout(flashTimer);
    flashTimer = setTimeout(renderHud, 3500);
  }

  /* ---------- showing a slide ---------- */
  function show(i, mode) {
    if (i < 0) i = 0;
    if (i > n - 1) i = n - 1;
    slides.forEach(function (s) { s.classList.remove("current"); });
    var s = slides[i];
    s.classList.add("current");
    Array.prototype.forEach.call(frags(s), function (f) {
      f.classList.toggle("visible", mode === "all");
    });
    cur = i;
    syncHash();
    renderHud();
    broadcast();
    if (isPresenter) renderPresenter();
  }

  function next() {
    var f = slides[cur].querySelector(".fragment:not(.visible)");
    if (f) { f.classList.add("visible"); broadcast(); if (isPresenter) renderPresenter(); return; }
    if (cur < n - 1) show(cur + 1, "first");
  }
  function prev() {
    var vis = slides[cur].querySelectorAll(".fragment.visible");
    if (vis.length) { vis[vis.length - 1].classList.remove("visible"); broadcast(); if (isPresenter) renderPresenter(); return; }
    if (cur > 0) show(cur - 1, "all");
  }

  /* Every navigation goes through here. In the presenter window the
     action is forwarded to the audience window instead of applied, so
     the two can never disagree about where the lecture is. */
  function nav(action, index) {
    if (isPresenter && window.opener && !window.opener.closed) {
      window.opener.postMessage({ econ3049: "deck", type: "nav", action: action, index: index }, "*");
      return;
    }
    if (action === "next") next();
    else if (action === "prev") prev();
    else if (action === "home") show(0, "first");
    else if (action === "end") show(n - 1, "all");
    else if (action === "go") show((index || 1) - 1, "first");
  }

  /* ---------- hash ----------
     #/n opens slide n with its steps hidden; #/n/all opens it with every
     step shown — for linking to a finished slide, and for checking the
     layout of one whose content is all steps. */
  function hashIndex() {
    var m = /^#\/(\d+)(\/all)?$/.exec(location.hash);
    return m ? Math.min(n, Math.max(1, +m[1])) - 1 : 0;
  }
  function hashMode() { return /\/all$/.test(location.hash) ? "all" : "first"; }
  function syncHash() {
    var want = "#/" + (cur + 1);
    if (location.hash === want || location.hash === want + "/all") return;
    try { history.replaceState(null, "", want); }
    catch (e) { location.hash = want; }
  }
  window.addEventListener("hashchange", function () {
    var i = hashIndex(), mode = hashMode();
    if (i !== cur || mode === "all") show(i, mode);
  });

  /* ---------- theme, fullscreen, print ---------- */
  function redraw() { if (window.VIZ && window.VIZ.redraw) window.VIZ.redraw(); }

  function isDark() {
    var t = root.getAttribute("data-theme");
    if (t) return t === "dark";
    return typeof window.matchMedia === "function" &&
           window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  function toggleTheme() {
    var next = isDark() ? "light" : "dark";
    root.setAttribute("data-theme", next);
    try { localStorage.setItem("econ3049-theme", next); } catch (e) { /* private mode */ }
    redraw();
  }

  function toggleFullscreen() {
    if (document.fullscreenElement && typeof document.exitFullscreen === "function") {
      document.exitFullscreen();
    } else if (typeof root.requestFullscreen === "function") {
      root.requestFullscreen();
    }
  }

  /* Figures are drawn in whatever palette was current when they were
     built. Printing from the dark theme would put pale lines on white
     paper, so force the light palette for the print run and put back
     whatever the lecturer had afterwards. */
  var themeBeforePrint = null;
  window.addEventListener("beforeprint", function () {
    themeBeforePrint = root.getAttribute("data-theme");
    root.setAttribute("data-theme", "light");
    redraw();
  });
  window.addEventListener("afterprint", function () {
    if (themeBeforePrint) root.setAttribute("data-theme", themeBeforePrint);
    else root.removeAttribute("data-theme");
    redraw();
  });

  /* ---------- help ---------- */
  var help = h("div", "deck-help");
  help.hidden = true;
  var KEYS = [
    ["→  ↓  space  enter", "next step, then next slide"],
    ["←  ↑  backspace", "previous step or slide"],
    ["home  /  end", "first / last slide"],
    ["t", "light / dark — rebuilds every figure, so a slider goes back to its start"],
    ["f", "fullscreen"],
    ["p", "presenter window: notes, next slide, clock"],
    ["n", "include the notes when printing (Cmd/Ctrl-P, landscape)"],
    ["?", "this list"]
  ];
  var dl = h("dl");
  KEYS.forEach(function (k) {
    dl.appendChild(h("dt", null, k[0]));
    dl.appendChild(h("dd", null, k[1]));
  });
  help.appendChild(h("p", "deck-help-title", "Keys"));
  help.appendChild(dl);
  help.appendChild(h("p", "deck-help-foot",
    "Drive figures from the audience window; the presenter window's copy moves only itself. Escape closes this."));
  document.body.appendChild(help);
  function toggleHelp(force) { help.hidden = force === undefined ? !help.hidden : !force; }

  /* ---------- presenter window ---------- */
  function openPresenter() {
    if (win && !win.closed) { win.focus(); return; }
    var url = location.href.replace(/#.*$/, "") + "#/" + (cur + 1);
    var w = null;
    try { w = window.open(url, "econ3049-presenter", "popup,width=1280,height=800"); }
    catch (e) { w = null; }
    if (!w) { flash("Presenter window blocked — allow pop-ups for this page and press p again"); return; }
    win = w;
  }

  function stateMessage() {
    return { econ3049: "deck", type: "state", index: cur + 1,
             fragment: visibleCount(slides[cur]), total: n };
  }
  function broadcast() {
    if (win && !win.closed) win.postMessage(stateMessage(), "*");
  }

  /* the presenter side: panes, and rendering from a state message */
  var presNext, presNotes, presClock;
  if (isPresenter) {
    root.setAttribute("data-mode", "presenter");
    presNext = h("div", "pres-next");
    presNotes = h("div", "pres-notes");
    presClock = h("div", "pres-clock");
    document.body.appendChild(presNext);
    document.body.appendChild(presNotes);
    document.body.appendChild(presClock);
    setInterval(function () {
      var s = Math.floor((Date.now() - started) / 1000);
      presClock.textContent = Math.floor(s / 60) + ":" + ("0" + s % 60).slice(-2);
    }, 1000);
  }

  function renderPresenter() {
    while (presNext.firstChild) presNext.removeChild(presNext.firstChild);
    var nx = slides[cur + 1];
    if (nx) {
      var clone = nx.cloneNode(true);
      clone.classList.add("current");
      Array.prototype.forEach.call(clone.querySelectorAll(".fragment"), function (f) { f.classList.add("visible"); });
      Array.prototype.forEach.call(clone.querySelectorAll("aside.notes"), function (a) { a.parentNode.removeChild(a); });
      presNext.appendChild(clone);
    } else {
      presNext.appendChild(h("p", "pres-end", "End of deck"));
    }
    var notes = slides[cur].querySelector("aside.notes");
    presNotes.innerHTML = notes ? notes.innerHTML : "<p><em>No notes for this slide.</em></p>";
    if (window.opener && window.opener.closed) flash("Audience window closed");
  }

  function applyState(m) {
    show(m.index - 1, "first");
    var fs = frags(slides[cur]);
    for (var k = 0; k < Math.min(m.fragment, fs.length); k++) fs[k].classList.add("visible");
    if (isPresenter) renderPresenter();
  }

  window.addEventListener("message", function (ev) {
    var m = ev.data;
    if (!m || m.econ3049 !== "deck") return;
    if (isPresenter) {
      if (ev.source !== window.opener) return;
      if (m.type === "state") applyState(m);
    } else {
      if (!win || ev.source !== win) return;
      if (m.type === "hello") broadcast();
      else if (m.type === "nav") nav(m.action, m.index);
    }
  });

  /* ---------- input ---------- */
  document.addEventListener("keydown", function (ev) {
    if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
    var t = ev.target;
    if (t && t.closest && t.closest("input, textarea, select, button, [contenteditable]")) return;
    var k = ev.key, handled = true;
    if (k === "ArrowRight" || k === "ArrowDown" || k === " " || k === "PageDown" || k === "Enter") nav("next");
    else if (k === "ArrowLeft" || k === "ArrowUp" || k === "PageUp" || k === "Backspace") nav("prev");
    else if (k === "Home") nav("home");
    else if (k === "End") nav("end");
    else if (k === "t") toggleTheme();
    else if (k === "f") toggleFullscreen();
    else if (k === "p") openPresenter();
    else if (k === "n") root.toggleAttribute("data-print-notes");
    else if (k === "?") toggleHelp();
    else if (k === "Escape") toggleHelp(false);
    else handled = false;
    if (handled) ev.preventDefault();
  });

  deck.addEventListener("click", function (ev) {
    var t = ev.target;
    if (t && t.closest && t.closest(".viz, a, button, input, label, details, summary, .deck-help")) return;
    nav(ev.clientX < window.innerWidth * 0.25 ? "prev" : "next");
  });

  /* ---------- boot ---------- */
  show(hashIndex(), hashMode());
  if (isPresenter && window.opener) {
    window.opener.postMessage({ econ3049: "deck", type: "hello" }, "*");
  }
})();
