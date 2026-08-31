/* ============================================================
   ECON 3049 — Navigation renderer

   Reads window.COURSE (assets/course.js) and fills in everything
   that would otherwise have to be hand-maintained across pages:

     <div class="masthead"  data-unit="2C"></div>   breadcrumb
     <p   class="unit-meta" data-unit="2C"></p>     unit · readings · scope
     <p   class="deck-link" data-unit="2C"></p>     slide provenance
     <div class="lesson-nav" data-unit="2C"></div>  prev / next
     <div id="roadmap"></div>                       index: all units
     <div id="calendar"></div>                      index: dates + assessment
     <p   id="reference-links"></p>                 index: reference/ pages
     <span data-course="title">                     any manifest field

   Add a unit by editing course.js alone. Nothing here changes.
   ============================================================ */
(function () {
  var C = window.COURSE;
  if (!C) return;

  var DASH = "—";

  /* ---------- tiny DOM helpers ---------- */
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function link(href, text, cls) {
    var a = el("a", cls, text);
    a.href = href;
    return a;
  }
  /* Pages live one directory deep (units/, reference/); index.html is at root. */
  function atRoot() {
    return !/\/(units|reference)\//.test(location.pathname);
  }
  function root(path) {
    return (atRoot() ? "" : "../") + path;
  }
  function inUnits() {
    return /\/units\//.test(location.pathname);
  }
  /* Sibling units link by bare filename; everywhere else goes through the root. */
  function unitHref(u) {
    return inUnits() ? u.slug + ".html" : root("units/" + u.slug + ".html");
  }
  function findUnit(code) {
    for (var i = 0; i < C.units.length; i++) {
      if (C.units[i].unit === code) return i;
    }
    return -1;
  }
  /* Units the class has actually reached, from COURSE.covered. Compared
     on the unit code, so "2A Part 1" works as well as "2B". */
  var COVERED = {};
  (C.covered || []).forEach(function (code) { COVERED[code] = true; });
  function isCovered(u) { return !!COVERED[u.unit]; }

  /* ---------- masthead breadcrumb ---------- */
  function renderMasthead(node) {
    var u = C.units[findUnit(node.getAttribute("data-unit"))];
    if (!u) return;
    var left = el("span");
    left.appendChild(link(root("index.html"), C.code));
    left.appendChild(document.createTextNode(" · "));
    left.appendChild(el("span", "course", C.title));
    node.appendChild(left);
    /* Just the unit code. The covered marker belongs on the meta line
       under the title, where it has room to say what it means; twice on
       one screen is once too many. */
    node.appendChild(el("span", null, "Unit " + u.unit));
  }

  /* ---------- unit meta line ---------- */
  function renderUnitMeta(node) {
    var u = C.units[findUnit(node.getAttribute("data-unit"))];
    if (!u) return;
    var bits = [
      "Unit " + u.unit,
      "Wooldridge " + u.wooldridge,
      "Gujarati " + u.gujarati
    ];
    var scope = u.part === "1"
      ? "On the midterm"
      : "On the final examination";
    bits.push(scope);
    node.textContent = bits.join("  ·  ");
    if (isCovered(u)) {
      node.appendChild(document.createTextNode("  "));
      node.appendChild(el("span", "covered-tag", "✓ covered in class"));
    }
  }

  /* ---------- slide provenance ---------- */
  function renderDeckLink(node) {
    var u = C.units[findUnit(node.getAttribute("data-unit"))];
    if (!u) return;
    node.appendChild(document.createTextNode(
      "This page replaces the Unit " + u.unit + " lecture slides (" + u.slides + " slides). "
    ));
    if (C.deckBaseUrl) {
      node.appendChild(link(C.deckBaseUrl + encodeURIComponent(u.deck),
                            "Download the original deck"));
    }
  }

  /* ---------- prev / next ---------- */
  function renderUnitNav(node) {
    var i = findUnit(node.getAttribute("data-unit"));
    if (i < 0) return;
    var prev = C.units[i - 1], next = C.units[i + 1];
    var live = function (u) { return u && u.status !== "planned"; };

    /* An unwritten neighbour is never linked — a dead arrow in the middle of
       a lesson is worse than no arrow. */
    node.appendChild(live(prev)
      ? link(unitHref(prev), "← Unit " + prev.unit)
      : el("span", "nav-end", prev ? "Unit " + prev.unit + " — coming soon" : ""));

    node.appendChild(link(root("index.html"), "Course home ↑"));

    node.appendChild(live(next)
      ? link(unitHref(next), "Unit " + next.unit + " →")
      : el("span", "nav-end", next ? "Unit " + next.unit + " — coming soon" : "End of course"));
  }

  /* ---------- index: the roadmap ---------- */
  function renderRoadmap(node) {
    /* Where the class has got to, in course order rather than the order
       the codes were added. Nothing is rendered before the first lecture,
       when the honest summary would be "none". */
    var done = C.units.filter(isCovered);
    if (done.length) {
      var p = el("p", "covered-line");
      p.appendChild(el("strong", null, "Covered in class so far: "));
      p.appendChild(document.createTextNode(
        done.map(function (u) { return u.unit; }).join(" · ")
        + "   (" + done.length + " of " + C.units.length + " units)"));
      node.appendChild(p);
    }

    C.units_meta.forEach(function (part) {
      var box = el("div", "part");
      box.appendChild(el("h2", null, "Unit " + part.id + " · " + part.title));
      box.appendChild(el("p", "part-sub", part.note));

      var list = el("ol", "units");
      C.units.filter(function (u) { return u.part === part.id; })
             .forEach(function (u) {
        var li = el("li", u.status === "planned" ? "todo" : null);
        li.appendChild(el("span", "num", u.unit));

        if (u.status === "planned") {
          li.appendChild(el("span", "u-title", u.title));
        } else {
          li.appendChild(link(unitHref(u), u.title, "u-title"));
          li.appendChild(el("span", "status-pill " + u.status,
                            u.status === "ready" ? "Ready" : "Draft"));
        }
        li.appendChild(el("span", "blurb", u.blurb));
        if (isCovered(u)) {
          li.classList.add("covered");
          li.appendChild(el("span", "done", "✓ covered"));
        }
        list.appendChild(li);
      });

      box.appendChild(list);
      node.appendChild(box);
    });
  }

  /* ---------- index: dates and assessment ---------- */
  function renderCalendar(node) {
    var tp = C.teachingPeriod || {};
    var head = el("p", "cal-period",
      tp.start && tp.end
        ? "Teaching period: " + tp.start + " to " + tp.end
        : "Teaching period to be confirmed");
    node.appendChild(head);

    var table = el("table", "cal");
    C.assessment.forEach(function (a) {
      var tr = el("tr");
      tr.appendChild(el("th", null, a.name));
      tr.appendChild(el("td", "wt", a.weight + "%"));
      tr.appendChild(el("td", "cov", a.covers));
      tr.appendChild(el("td", "when", a.when || DASH));
      table.appendChild(tr);
    });
    node.appendChild(table);
  }

  /* ---------- reference/ pages ----------
     Same rule as the prev/next arrows: a page that has not been
     written yet is named but not linked. */
  function renderReferenceLinks(node) {
    (C.reference || []).forEach(function (r, i) {
      if (i) node.appendChild(document.createTextNode(" · "));
      if (r.status === "planned") {
        var span = el("span", "pending", r.title);
        span.title = r.blurb + " Not written yet.";
        node.appendChild(span);
      } else {
        var a = link(root("reference/" + r.slug + ".html"), r.title);
        a.title = r.blurb;
        node.appendChild(a);
      }
    });
  }

  /* ---------- <span data-course="lecturer"> etc. ---------- */
  function renderFields() {
    document.querySelectorAll("[data-course]").forEach(function (n) {
      var v = C[n.getAttribute("data-course")];
      if (typeof v === "string") n.textContent = v;
    });
  }

  function boot() {
    renderFields();
    document.querySelectorAll(".masthead[data-unit]").forEach(renderMasthead);
    document.querySelectorAll(".unit-meta[data-unit]").forEach(renderUnitMeta);
    document.querySelectorAll(".deck-link[data-unit]").forEach(renderDeckLink);
    document.querySelectorAll(".lesson-nav[data-unit]").forEach(renderUnitNav);
    var r = document.getElementById("roadmap");   if (r) renderRoadmap(r);
    var c = document.getElementById("calendar");  if (c) renderCalendar(c);
    var rl = document.getElementById("reference-links"); if (rl) renderReferenceLinks(rl);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
