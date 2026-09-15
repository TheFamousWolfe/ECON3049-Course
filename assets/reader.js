/* ============================================================
   ECON 3049 — Reader preferences

   Renders the small control bar at the top of every page: text size,
   theme, and the download menu. Preferences persist per reader in
   localStorage and apply across the whole site.

   Markup contract — one empty element per page:

     <div class="reader-bar"></div>

   THE NO-FLASH PART IS NOT HERE. Each page carries a tiny inline
   script in its <head> that reads localStorage and stamps data-theme
   and data-text on <html> before the first paint. Without it a reader
   who chose dark would see a white flash on every navigation. This
   file only draws the controls and handles clicks.

   Nothing here is required to read the page. With JavaScript off the
   bar simply does not appear, the site renders in the reader's system
   theme via prefers-color-scheme, and printing still works from the
   browser's own menu.
   ============================================================ */
(function () {
  var KEY_THEME = "econ3049-theme";
  var KEY_TEXT  = "econ3049-text";
  var root = document.documentElement;

  /* localStorage throws in some privacy modes; a reader who cannot
     save a preference should still get working controls. */
  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } }

  var theme = get(KEY_THEME) || "auto";
  var text  = get(KEY_TEXT)  || "m";

  function applyTheme() {
    if (theme === "auto") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);
    /* the figures read their colours from the stylesheet, so they have
       to be rebuilt once the new tokens are in place */
    if (window.VIZ && window.VIZ.redraw) window.VIZ.redraw();
  }
  function applyText() {
    if (text === "m") root.removeAttribute("data-text");
    else root.setAttribute("data-text", text);
  }

  function el(tag, cls, txt) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  }

  function group(label) {
    var g = el("span", "rb-group");
    g.appendChild(el("span", "rb-label", label));
    return g;
  }

  function build(bar) {
    bar.innerHTML = "";

    /* ---- text size ---- */
    var STEPS = ["s", "m", "l", "xl"];
    var gT = group("Text");
    var smaller = el("button", "rb-btn", "A−");
    var bigger  = el("button", "rb-btn", "A+");
    var shown   = el("span", "rb-value");
    function label() {
      shown.textContent = { s: "small", m: "normal", l: "large", xl: "largest" }[text];
      smaller.disabled = text === "s";
      bigger.disabled  = text === "xl";
    }
    smaller.title = "Smaller text";
    bigger.title  = "Larger text";
    smaller.addEventListener("click", function () {
      var i = STEPS.indexOf(text);
      if (i > 0) { text = STEPS[i - 1]; set(KEY_TEXT, text); applyText(); label(); }
    });
    bigger.addEventListener("click", function () {
      var i = STEPS.indexOf(text);
      if (i < STEPS.length - 1) { text = STEPS[i + 1]; set(KEY_TEXT, text); applyText(); label(); }
    });
    gT.appendChild(smaller);
    gT.appendChild(bigger);
    gT.appendChild(shown);
    label();
    bar.appendChild(gT);

    /* ---- theme ---- */
    var gTh = group("Theme");
    var themes = [["auto", "Auto"], ["light", "Light"], ["dark", "Dark"]];
    var tbtns = {};
    themes.forEach(function (t) {
      var b = el("button", "rb-btn", t[1]);
      b.title = t[0] === "auto" ? "Follow the system setting" : "Always " + t[1].toLowerCase();
      b.addEventListener("click", function () {
        theme = t[0];
        set(KEY_THEME, theme);
        applyTheme();
        Object.keys(tbtns).forEach(function (k) {
          tbtns[k].classList.toggle("on", k === theme);
        });
      });
      tbtns[t[0]] = b;
      gTh.appendChild(b);
    });
    tbtns[theme].classList.add("on");
    bar.appendChild(gTh);

    /* ---- downloads ---- */
    var gD = el("details", "rb-downloads");
    var sum = document.createElement("summary");
    sum.textContent = "Download";
    gD.appendChild(sum);
    var menu = el("div", "rb-menu");

    var FORMATS = [
      ["pdf",  "PDF",       "Opens your browser's print dialogue — choose “Save as PDF”"],
      ["doc",  "Word",      "A .doc file Word and Google Docs both open"],
      ["md",   "Markdown",  "Plain text, for Obsidian, Notion or a plain editor"],
      ["tex",  "LaTeX",     "A .tex scaffold — expect to tidy the equations"]
    ];
    FORMATS.forEach(function (f) {
      var b = el("button", "rb-item");
      b.appendChild(el("span", "rb-item-name", f[1]));
      b.appendChild(el("span", "rb-item-note", f[2]));
      b.addEventListener("click", function () {
        gD.removeAttribute("open");
        if (!window.EXPORT) return;
        if (f[0] === "pdf") window.print();
        else window.EXPORT.download(f[0]);
      });
      menu.appendChild(b);
    });
    gD.appendChild(menu);
    bar.appendChild(gD);

    /* clicking anywhere else closes the menu */
    document.addEventListener("click", function (ev) {
      if (gD.hasAttribute("open") && !gD.contains(ev.target)) gD.removeAttribute("open");
    });
  }

  function boot() {
    applyTheme();
    applyText();
    var bars = document.querySelectorAll(".reader-bar");
    if (!bars.length) return;
    Array.prototype.forEach.call(bars, build);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
