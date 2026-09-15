/* ============================================================
   ECON 3049 — Glossary filter

   PROGRESSIVE ENHANCEMENT ONLY. The glossary is plain <dl> markup
   and reads completely with JavaScript off; this file adds a search
   box on top of it. Nothing here may be the only place a definition
   or a link appears.

   Markup contract (reference/glossary.html):

     <div class="g-tools"></div>        <- filled in here
     <section class="gloss">
       <h2 id="g-a">A</h2>
       <dl>
         <dt id="autocorrelation">Autocorrelation <a class="g-unit">…</a></dt>
         <dd>…</dd>
       </dl>
     </section>

   A term matches if the query appears in its <dt> or its <dd>, so
   searching "variance" finds homoscedasticity as well as var(β̂₂).
   ============================================================ */
(function () {
  function boot() {
    var gloss = document.querySelector(".gloss");
    var tools = document.querySelector(".g-tools");
    if (!gloss || !tools) return;

    /* pair each dt with the dd that follows it */
    var entries = [];
    Array.prototype.forEach.call(gloss.querySelectorAll("dt"), function (dt) {
      var dd = dt.nextElementSibling;
      if (!dd || dd.tagName !== "DD") return;
      entries.push({
        dt: dt, dd: dd,
        hay: (dt.textContent + " " + dd.textContent).toLowerCase()
      });
    });
    var heads = Array.prototype.slice.call(gloss.querySelectorAll("h2"));

    /* the range of units covered, read off the entries themselves so it
       cannot go stale as units are added */
    var codes = [...new Set(Array.prototype.map.call(
      gloss.querySelectorAll(".g-unit"), function (a) { return a.textContent.trim(); }))].sort();
    var range = codes.length
      ? (codes.length === 1 ? codes[0]
         : codes[0] + "–" + codes[codes.length - 1].replace(/^Unit /, ""))
      : "";
    Array.prototype.forEach.call(document.querySelectorAll("[data-gloss-range]"), function (n) {
      if (range) n.textContent = range.replace(/^Unit /, "Units ");
    });

    var box = document.createElement("input");
    box.type = "search";
    box.placeholder = "Filter " + entries.length + " terms — try “variance” or a unit code";
    box.setAttribute("aria-label", "Filter glossary terms");

    var count = document.createElement("span");
    count.className = "g-count";

    var empty = document.createElement("p");
    empty.className = "g-empty";
    empty.textContent = "No term matches that. Try a shorter word, or a unit code such as 1B.";
    gloss.parentNode.insertBefore(empty, gloss);

    function apply() {
      var q = box.value.trim().toLowerCase();
      var shown = 0;

      entries.forEach(function (e) {
        var hit = !q || e.hay.indexOf(q) !== -1;
        e.dt.classList.toggle("hidden", !hit);
        e.dd.classList.toggle("hidden", !hit);
        if (hit) shown++;
      });

      /* a letter heading whose list is now empty is noise — hide both */
      heads.forEach(function (hh) {
        var list = hh.nextElementSibling;
        if (!list || list.tagName !== "DL") return;
        var any = !!list.querySelector("dt:not(.hidden)");
        hh.classList.toggle("hidden", !any);
        list.classList.toggle("hidden", !any);
      });

      count.textContent = q
        ? shown + " of " + entries.length + " terms"
        : entries.length + " terms" + (range ? ", " + range.replace(/^Unit /, "Units ") : "");
      empty.classList.toggle("show", shown === 0);
    }

    box.addEventListener("input", apply);
    box.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape") { box.value = ""; apply(); }
    });

    tools.appendChild(box);
    tools.appendChild(count);
    apply();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
