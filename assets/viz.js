/* ============================================================
   ECON 3049 — Interactive figures

   Hand-rolled SVG. No libraries, no CDN, works over file://.

   Usage in a unit page:
     <div class="viz" data-viz="ols-drag"></div>

   Each figure is registered by name below. A page that asks for
   a name nobody registered simply shows its fallback text, so a
   half-built widget can never break a lesson.

   Adding a figure:
     VIZ.register("name", function (host) { ... });
   ============================================================ */
(function () {
  var NS = "http://www.w3.org/2000/svg";
  var registry = {};

  /* ---------- element helpers ---------- */
  function s(tag, attrs) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    return n;
  }
  function h(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  /* ---------- a minimal cartesian frame ----------
     chart({w,h,pad,xd:[min,max],yd:[min,max]})
     -> {svg, x(v), y(v), ix(px), iy(px), plot, axes(xLabel,yLabel)}
     The svg carries a viewBox and no width/height, so CSS scales it. */
  function chart(o) {
    var w = o.w || 640, ht = o.h || 380;
    var p = o.pad || { t: 16, r: 16, b: 40, l: 48 };
    var xd = o.xd, yd = o.yd;

    var svg = s("svg", {
      viewBox: "0 0 " + w + " " + ht,
      preserveAspectRatio: "xMidYMid meet",
      role: "img"
    });

    function x(v) { return p.l + (v - xd[0]) / (xd[1] - xd[0]) * (w - p.l - p.r); }
    function y(v) { return ht - p.b - (v - yd[0]) / (yd[1] - yd[0]) * (ht - p.t - p.b); }
    function ix(px) { return xd[0] + (px - p.l) / (w - p.l - p.r) * (xd[1] - xd[0]); }
    function iy(py) { return yd[0] + (ht - p.b - py) / (ht - p.t - p.b) * (yd[1] - yd[0]); }

    var plot = s("g");

    function axes(xLabel, yLabel) {
      var g = s("g");
      g.appendChild(s("line", { x1: p.l, y1: ht - p.b, x2: w - p.r, y2: ht - p.b,
                                stroke: P.ink, "stroke-width": 1 }));
      g.appendChild(s("line", { x1: p.l, y1: p.t, x2: p.l, y2: ht - p.b,
                                stroke: P.ink, "stroke-width": 1 }));
      var xl = s("text", { x: (p.l + w - p.r) / 2, y: ht - 6,
                           "text-anchor": "middle", "font-size": 12, fill: P.inkSoft });
      xl.textContent = xLabel;
      g.appendChild(xl);
      var yl = s("text", { x: 12, y: (p.t + ht - p.b) / 2,
                           "text-anchor": "middle", "font-size": 12, fill: P.inkSoft,
                           transform: "rotate(-90 12 " + (p.t + ht - p.b) / 2 + ")" });
      yl.textContent = yLabel;
      g.appendChild(yl);
      svg.insertBefore(g, plot);
      return g;
    }

    svg.appendChild(plot);
    return { svg: svg, x: x, y: y, ix: ix, iy: iy, plot: plot, axes: axes, w: w, h: ht, pad: p };
  }

  /* ---------- convert a pointer event to svg user units ---------- */
  function pointAt(svg, ev) {
    var pt = svg.createSVGPoint();
    pt.x = ev.clientX; pt.y = ev.clientY;
    var m = svg.getScreenCTM();
    return m ? pt.matrixTransform(m.inverse()) : { x: 0, y: 0 };
  }

  /* ---------- OLS on {x,y} pairs, Gujarati notation ---------- */
  function ols(pts) {
    var n = pts.length, sx = 0, sy = 0, i;
    for (i = 0; i < n; i++) { sx += pts[i].x; sy += pts[i].y; }
    var mx = sx / n, my = sy / n, num = 0, den = 0;
    for (i = 0; i < n; i++) {
      num += (pts[i].x - mx) * (pts[i].y - my);
      den += (pts[i].x - mx) * (pts[i].x - mx);
    }
    var b2 = den === 0 ? 0 : num / den;
    var b1 = my - b2 * mx;
    var rss = 0, tss = 0;
    for (i = 0; i < n; i++) {
      var e = pts[i].y - (b1 + b2 * pts[i].x);
      rss += e * e;
      tss += (pts[i].y - my) * (pts[i].y - my);
    }
    return { b1: b1, b2: b2, rss: rss, tss: tss, r2: tss === 0 ? 0 : 1 - rss / tss };
  }

  /* ---------- three-variable OLS, Gujarati's deviation formulas ----------
     Returns the partial slopes β̂2 and β̂3 and the intercept β̂1. Used to
     show what "holding X3 constant" recovers that a simple regression
     cannot. */
  function ols3(x2, x3, y) {
    var n = y.length, i, m2 = 0, m3 = 0, my = 0;
    for (i = 0; i < n; i++) { m2 += x2[i]; m3 += x3[i]; my += y[i]; }
    m2 /= n; m3 /= n; my /= n;

    var s22 = 0, s33 = 0, s23 = 0, s2y = 0, s3y = 0, syy = 0;
    for (i = 0; i < n; i++) {
      var a = x2[i] - m2, b = x3[i] - m3, c = y[i] - my;
      s22 += a * a; s33 += b * b; s23 += a * b;
      s2y += a * c; s3y += b * c; syy += c * c;
    }
    var den = s22 * s33 - s23 * s23;
    var b2 = den === 0 ? 0 : (s2y * s33 - s3y * s23) / den;
    var b3 = den === 0 ? 0 : (s3y * s22 - s2y * s23) / den;
    var ess = b2 * s2y + b3 * s3y;
    return {
      b1: my - b2 * m2 - b3 * m3, b2: b2, b3: b3,
      tss: syy, ess: ess, rss: syy - ess,
      r2: syy === 0 ? 0 : ess / syy
    };
  }

  /* ---------- k-variable OLS by Gauss-Jordan on the normal equations ----------
     X is an array of rows, each row already carrying its leading 1 for
     the intercept. Solves (X'X)β = X'y directly; n is small in every
     figure here, so the simplest stable-enough method is the right one.
     Returns null if X'X is singular — perfect collinearity, which is
     assumption 8 failing rather than a bug. */
  function olsk(X, y) {
    var n = X.length, k = X[0].length, i, j, p, q;
    var A = [];
    for (i = 0; i < k; i++) {
      A.push(new Array(k + 1).fill(0));
      for (j = 0; j < k; j++) {
        for (p = 0; p < n; p++) A[i][j] += X[p][i] * X[p][j];
      }
      for (p = 0; p < n; p++) A[i][k] += X[p][i] * y[p];
    }

    for (i = 0; i < k; i++) {
      var piv = i;
      for (q = i + 1; q < k; q++) if (Math.abs(A[q][i]) > Math.abs(A[piv][i])) piv = q;
      if (Math.abs(A[piv][i]) < 1e-10) return null;
      var t = A[i]; A[i] = A[piv]; A[piv] = t;
      var d = A[i][i];
      for (j = i; j <= k; j++) A[i][j] /= d;
      for (q = 0; q < k; q++) {
        if (q === i) continue;
        var f = A[q][i];
        for (j = i; j <= k; j++) A[q][j] -= f * A[i][j];
      }
    }

    var beta = [];
    for (i = 0; i < k; i++) beta.push(A[i][k]);

    var my = 0;
    for (p = 0; p < n; p++) my += y[p];
    my /= n;
    var rss = 0, tss = 0;
    for (p = 0; p < n; p++) {
      var fit = 0;
      for (j = 0; j < k; j++) fit += beta[j] * X[p][j];
      rss += (y[p] - fit) * (y[p] - fit);
      tss += (y[p] - my) * (y[p] - my);
    }
    return { beta: beta, rss: rss, tss: tss, r2: tss === 0 ? 0 : 1 - rss / tss };
  }

  /* ---------- the t distribution ----------
     Unit 1F needs real critical values, not a hard-coded table: the
     figures let the reader move the degrees of freedom and alpha, and
     what they report has to agree with the tables they will use in the
     exam. lnGamma is Lanczos; the CDF is Simpson over the density;
     tCrit inverts the CDF by bisection. Accurate to ~1e-6 over the
     range these figures use, which is well past what is printed in a
     statistical table. */
  function lnGamma(z) {
    var C = [0.99999999999980993, 676.5203681218851, -1259.1392167224028,
             771.32342877765313, -176.61502916214059, 12.507343278686905,
             -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lnGamma(1 - z);
    z -= 1;
    var x = C[0];
    for (var i = 1; i < 9; i++) x += C[i] / (z + i);
    var t = z + 7.5;
    return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
  }

  function tPdf(t, v) {
    return Math.exp(lnGamma((v + 1) / 2) - lnGamma(v / 2))
         / Math.sqrt(v * Math.PI)
         * Math.pow(1 + t * t / v, -(v + 1) / 2);
  }

  function tCdf(t, v) {
    if (t < -40) return 0;
    if (t > 40) return 1;
    if (t < 0) return 1 - tCdf(-t, v);          /* symmetry, so we only integrate right */
    var n = 400, a = 0, b = t, h2 = (b - a) / n, sum = tPdf(a, v) + tPdf(b, v), k;
    for (k = 1; k < n; k++) sum += (k % 2 ? 4 : 2) * tPdf(a + k * h2, v);
    return 0.5 + sum * h2 / 3;
  }

  /* the t value with cumulative probability p — i.e. what a t-table prints */
  function tCrit(p, v) {
    var lo = 0, hi = 60, mid, i;
    for (i = 0; i < 80; i++) {
      mid = (lo + hi) / 2;
      if (tCdf(mid, v) < p) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  }

  /* ---------- the palette, read from the stylesheet ----------
     Every colour below comes from a CSS custom property, so the
     figures follow whatever theme is active instead of carrying their
     own hard-coded hexes. Read once per render rather than per shape:
     getComputedStyle is not free, and 19 figures is a lot of calls.
     The fallbacks are the light palette, for the case where a figure
     is somehow drawn before the stylesheet has applied. */
  var P = {};
  function palette() {
    var cs = window.getComputedStyle(document.documentElement);
    function g(name, fallback) {
      var v = cs.getPropertyValue(name);
      return (v && v.trim()) || fallback;
    }
    P.ink      = g("--ink",       "#1a1a1a");
    P.inkSoft  = g("--ink-soft",  "#555");
    P.inkFaint = g("--ink-faint", "#8a8378");
    P.paper    = g("--paper",     "#fffff8");
    P.rule     = g("--rule",      "#e4e0d4");
    P.ruleSoft = g("--rule-soft", "#c9c2b6");
    P.accent   = g("--accent",    "#7a1f2b");
    P.accent2  = g("--accent-2",  "#2c5f7c");
    P.good     = g("--good",      "#3a6230");
    P.warnBg   = g("--warn-bg",   "#fcefec");
  }

  var VIZ = {
    register: function (name, fn) { registry[name] = fn; },
    s: s, h: h, chart: chart, pointAt: pointAt, ols: ols, ols3: ols3, olsk: olsk,
    tPdf: tPdf, tCdf: tCdf, tCrit: tCrit
  };
  window.VIZ = VIZ;

  /* ============================================================
     Unit 1A — the deterministic model becomes an econometric one

     Figures 1 and 2 of the Unit 1A deck are the same picture at two
     settings of one dial. Turning it yourself is the point: a
     mathematical model claims every household sits on the line, and
     no economic relationship has ever done that.

     Deviates are fixed, not random, so returning the slider to zero
     returns exactly to Figure 1.
     ============================================================ */
  VIZ.register("deterministic-vs-stochastic", function (host) {
    var B1 = 20, B2 = 0.6;                    /* the PRF students will meet in 1B */
    var XS = [10, 17, 24, 31, 38, 45, 52, 59, 66, 73, 80, 90];
    var E  = [0.8, -1.25, 0.35, -0.6, 1.5, -0.95, 0.55, -1.4, 1.15, -0.35, 0.7, -1.05];
    var sigma = 0;

    var c = chart({ w: 640, h: 380, xd: [0, 100], yd: [0, 100] });
    c.axes("Income  X", "Consumption expenditure  Y");

    var drops = s("g", { stroke: P.accent, "stroke-width": 1.2, opacity: 0.8 });
    var prf   = s("line", { stroke: P.accent2, "stroke-width": 2.5 });
    var dots  = s("g");
    c.plot.appendChild(drops);
    c.plot.appendChild(prf);
    c.plot.appendChild(dots);

    prf.setAttribute("x1", c.x(0));  prf.setAttribute("y1", c.y(B1));
    prf.setAttribute("x2", c.x(100)); prf.setAttribute("y2", c.y(B1 + B2 * 100));

    var label = s("text", {
      x: c.x(72), y: c.y(B1 + B2 * 72) - 10,
      "font-size": 13, "font-style": "italic", fill: P.accent2
    });
    label.textContent = "E(Y | X) = β1 + β2X";
    c.plot.appendChild(label);

    XS.forEach(function () {
      dots.appendChild(s("circle", { r: 5.5, fill: P.ink }));
    });

    function draw() {
      while (drops.firstChild) drops.removeChild(drops.firstChild);
      XS.forEach(function (xv, i) {
        var mean = B1 + B2 * xv;
        var yv = mean + E[i] * sigma;
        var dot = dots.children[i];
        dot.setAttribute("cx", c.x(xv));
        dot.setAttribute("cy", c.y(yv));
        if (sigma > 0) {
          drops.appendChild(s("line", {
            x1: c.x(xv), y1: c.y(yv), x2: c.x(xv), y2: c.y(mean)
          }));
        }
      });

      slider.setAttribute("aria-valuenow", sigma);
      if (sigma === 0) {
        readout.textContent = "u = 0 for every household — the deterministic model";
        caption.textContent = "This is Figure 1. Every household consumes exactly what the "
          + "equation says. No economic relationship behaves like this.";
      } else {
        readout.textContent = "spread of u = " + sigma
          + "   ·   0 of " + XS.length + " households sit on the line";
        caption.textContent = "This is Figure 2. The line is still the average relationship — "
          + "E(Y | X) — but each household departs from it by its own u, and that "
          + "departure is what the disturbance term stands for.";
      }
    }

    var controls = h("div", "viz-controls");
    var wrap = h("label", null, "Size of the disturbance u:");
    var slider = document.createElement("input");
    slider.type = "range"; slider.min = "0"; slider.max = "14";
    slider.step = "1"; slider.value = "0";
    slider.setAttribute("aria-label", "Size of the disturbance term");
    slider.addEventListener("input", function () {
      sigma = +slider.value;
      draw();
    });
    wrap.appendChild(slider);

    var readout = h("span", "viz-readout");
    controls.appendChild(wrap);
    controls.appendChild(readout);

    var caption = h("p", "viz-caption");

    host.appendChild(c.svg);
    host.appendChild(controls);
    host.appendChild(caption);

    draw();
  });

  /* ============================================================
     Unit 1B — drag the data, watch the OLS line follow

     Students derive beta-hat-2 = sum(xy)/sum(x^2) on paper. This
     shows the same estimator responding to the data in real time,
     and shows RSS as the quantity the line is chosen to minimise.
     ============================================================ */
  VIZ.register("ols-drag", function (host) {
    /* Scattered on purpose: r² starts near 0.80 so the residual drops are
       plainly visible. A tighter cloud looks better and teaches less. */
    var START = [
      { x: 20, y: 38 }, { x: 30, y: 32 }, { x: 40, y: 50 }, { x: 50, y: 44 },
      { x: 60, y: 62 }, { x: 70, y: 54 }, { x: 80, y: 74 }, { x: 90, y: 68 }
    ];
    var pts = START.map(function (p) { return { x: p.x, y: p.y }; });

    var c = chart({ w: 640, h: 380, xd: [0, 100], yd: [0, 100] });
    c.axes("Income  X", "Consumption  Y");

    var resid = s("g", { stroke: P.accent, "stroke-width": 1,
                         "stroke-dasharray": "3 3", opacity: 0.75 });
    var line  = s("line", { stroke: P.accent2, "stroke-width": 2.5 });
    var dots  = s("g");
    c.plot.appendChild(resid);
    c.plot.appendChild(line);
    c.plot.appendChild(dots);

    var circles = pts.map(function (p, i) {
      var el = s("circle", { r: 7, fill: P.ink, cursor: "grab" });
      el.setAttribute("tabindex", "0");
      el.setAttribute("role", "slider");
      el.setAttribute("aria-label", "Observation " + (i + 1) + ", drag to move");
      dots.appendChild(el);
      return el;
    });

    var showResid = true;

    function draw() {
      var r = ols(pts);

      line.setAttribute("x1", c.x(0));
      line.setAttribute("y1", c.y(r.b1));
      line.setAttribute("x2", c.x(100));
      line.setAttribute("y2", c.y(r.b1 + r.b2 * 100));

      while (resid.firstChild) resid.removeChild(resid.firstChild);
      pts.forEach(function (p, i) {
        circles[i].setAttribute("cx", c.x(p.x));
        circles[i].setAttribute("cy", c.y(p.y));
        if (showResid) {
          resid.appendChild(s("line", {
            x1: c.x(p.x), y1: c.y(p.y),
            x2: c.x(p.x), y2: c.y(r.b1 + r.b2 * p.x)
          }));
        }
      });

      readout.textContent =
        "β̂1 = " + r.b1.toFixed(2) +
        "   β̂2 = " + r.b2.toFixed(3) +
        "   RSS = " + r.rss.toFixed(1) +
        "   r² = " + r.r2.toFixed(3);
      c.svg.setAttribute("aria-label",
        "Scatter of consumption against income with the fitted OLS line. " +
        "Intercept " + r.b1.toFixed(2) + ", slope " + r.b2.toFixed(3) + ".");
    }

    /* --- dragging --- */
    var active = -1;
    function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

    circles.forEach(function (el, i) {
      el.addEventListener("pointerdown", function (ev) {
        active = i;
        el.setPointerCapture(ev.pointerId);
        el.setAttribute("cursor", "grabbing");
        ev.preventDefault();
      });
      el.addEventListener("pointermove", function (ev) {
        if (active !== i) return;
        var pt = pointAt(c.svg, ev);
        pts[i].x = clamp(c.ix(pt.x), 2, 98);
        pts[i].y = clamp(c.iy(pt.y), 2, 98);
        draw();
      });
      el.addEventListener("pointerup", function () {
        active = -1;
        el.setAttribute("cursor", "grab");
      });
      /* keyboard: arrow keys nudge the point */
      el.addEventListener("keydown", function (ev) {
        var d = ev.shiftKey ? 5 : 1, moved = true;
        if (ev.key === "ArrowUp")         pts[i].y = clamp(pts[i].y + d, 2, 98);
        else if (ev.key === "ArrowDown")  pts[i].y = clamp(pts[i].y - d, 2, 98);
        else if (ev.key === "ArrowRight") pts[i].x = clamp(pts[i].x + d, 2, 98);
        else if (ev.key === "ArrowLeft")  pts[i].x = clamp(pts[i].x - d, 2, 98);
        else moved = false;
        if (moved) { ev.preventDefault(); draw(); }
      });
    });

    /* --- controls --- */
    var controls = h("div", "viz-controls");
    var readout  = h("span", "viz-readout");

    var toggle = h("button", null, "Hide residuals");
    toggle.addEventListener("click", function () {
      showResid = !showResid;
      toggle.textContent = showResid ? "Hide residuals" : "Show residuals";
      draw();
    });

    var reset = h("button", null, "Reset data");
    reset.addEventListener("click", function () {
      pts.forEach(function (p, i) { p.x = START[i].x; p.y = START[i].y; });
      draw();
    });

    controls.appendChild(toggle);
    controls.appendChild(reset);
    controls.appendChild(readout);

    host.appendChild(c.svg);
    host.appendChild(controls);
    host.appendChild(h("p", "viz-caption",
      "Drag any observation, or focus one and use the arrow keys. " +
      "The line is always the OLS line — the one choice of β̂1 and β̂2 " +
      "that makes the sum of those squared dashed distances as small as it can be."));

    draw();
  });

  /* ============================================================
     Unit 1B — the PRF you never see, and the SRF you estimate

     Slide 15 of the deck draws the true line and an estimated line
     on one diagram. The trouble with a still picture is that it
     shows one sample, so the estimated line looks like a fixed
     object. Redrawing the sample shows what it really is: a
     quantity that moves. Averaging beta-hat-2 over many draws then
     demonstrates unbiasedness rather than merely asserting it.
     ============================================================ */
  VIZ.register("prf-vs-srf", function (host) {
    var B1 = 20, B2 = 0.6, SIGMA = 9, N = 15;
    var draws = 0, sumB2 = 0;
    var pts = [];

    var c = chart({ w: 640, h: 380, xd: [0, 100], yd: [0, 100] });
    c.axes("Income  X", "Consumption  Y");

    var prf = s("line", { stroke: P.accent2, "stroke-width": 2.5 });
    var srf = s("line", { stroke: P.accent, "stroke-width": 2.5,
                          "stroke-dasharray": "7 4" });
    var dots = s("g");
    c.plot.appendChild(prf);
    c.plot.appendChild(srf);
    c.plot.appendChild(dots);

    prf.setAttribute("x1", c.x(0));   prf.setAttribute("y1", c.y(B1));
    prf.setAttribute("x2", c.x(100)); prf.setAttribute("y2", c.y(B1 + B2 * 100));

    function legend(text, colour, dy, dash) {
      var g = s("g");
      g.appendChild(s("line", { x1: c.x(4), y1: dy, x2: c.x(12), y2: dy,
                                stroke: colour, "stroke-width": 2.5,
                                "stroke-dasharray": dash }));
      var t = s("text", { x: c.x(14), y: dy + 4, "font-size": 11.5, fill: colour });
      t.textContent = text;
      g.appendChild(t);
      c.plot.appendChild(g);
    }
    legend("PRF  E(Y | X) = β1 + β2X   (never observed)", P.accent2, 22, null);
    legend("SRF  Ŷ = β̂1 + β̂2X   (what you estimate)", P.accent, 40, "7 4");

    /* box–muller, so the scatter is genuinely normal rather than uniform */
    function gauss() {
      var u = 1 - Math.random(), v = Math.random();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    }

    function sample() {
      pts = [];
      for (var i = 0; i < N; i++) {
        var xv = 8 + i * (84 / (N - 1));
        pts.push({ x: xv, y: B1 + B2 * xv + gauss() * SIGMA });
      }
      while (dots.firstChild) dots.removeChild(dots.firstChild);
      pts.forEach(function (p) {
        dots.appendChild(s("circle", {
          cx: c.x(p.x), cy: c.y(Math.max(2, Math.min(98, p.y))), r: 5, fill: P.ink
        }));
      });

      var r = ols(pts);
      srf.setAttribute("x1", c.x(0));
      srf.setAttribute("y1", c.y(r.b1));
      srf.setAttribute("x2", c.x(100));
      srf.setAttribute("y2", c.y(r.b1 + r.b2 * 100));

      draws++; sumB2 += r.b2;
      readout.textContent =
        "β̂1 = " + r.b1.toFixed(2) + "   β̂2 = " + r.b2.toFixed(3) +
        "   (true β2 = 0.600)";
      average.textContent =
        "Mean of β̂2 over " + draws + " sample" + (draws === 1 ? "" : "s") +
        " = " + (sumB2 / draws).toFixed(3);
    }

    var controls = h("div", "viz-controls");
    var again = h("button", null, "Draw a new sample");
    again.addEventListener("click", sample);
    var readout = h("span", "viz-readout");
    var average = h("span", "viz-readout");
    controls.appendChild(again);
    controls.appendChild(readout);
    controls.appendChild(average);

    host.appendChild(c.svg);
    host.appendChild(controls);
    host.appendChild(h("p", "viz-caption",
      "The solid line is the population regression function. It is fixed, and in real work "
      + "you never see it. The dashed line is estimated from the sample in front of you, and "
      + "it lands somewhere different every time. Keep drawing: no single β̂2 equals 0.600, "
      + "but their average closes in on it. That is what unbiased means."));

    sample();
  });

  /* ============================================================
     Unit 1C — Figure 1: E(u | X) = 0, and what constant variance is

     The deck's Figure 1 draws consumption observations stacked above
     and below the population line at each level of income. Two of the
     seven assumptions are visible in that one picture, so both dials
     are exposed here.

     The deviates are a FIXED symmetric list, not random draws. They
     sum to zero at every X by construction, which is exactly the
     claim of assumption 4 — so the conditional mean ring always
     lands on the population line, no matter where the spread dial is.
     ============================================================ */
  VIZ.register("conditional-means", function (host) {
    var B1 = 20, B2 = 0.6;
    var XS = [12, 26, 40, 54, 68, 82];
    var D = [-1.45, -0.95, -0.4, 0, 0.4, 0.95, 1.45];   /* Σ = 0 */
    var sigma = 8, hetero = false;

    var c = chart({ w: 640, h: 380, xd: [0, 100], yd: [0, 100] });
    c.axes("Income  X", "Consumption  Y");

    var prf = s("line", { stroke: P.accent2, "stroke-width": 2.5 });
    prf.setAttribute("x1", c.x(0));   prf.setAttribute("y1", c.y(B1));
    prf.setAttribute("x2", c.x(100)); prf.setAttribute("y2", c.y(B1 + B2 * 100));
    var g = s("g");
    c.plot.appendChild(prf);
    c.plot.appendChild(g);

    var lg = s("text", { x: c.x(4), y: 24, "font-size": 11.5, fill: P.accent2 });
    lg.textContent = "PRF  E(Y | X) = β1 + β2X";
    c.plot.appendChild(lg);

    /* the spread at a given income: constant, or fanning out with X */
    function sd(xv) { return hetero ? sigma * (0.3 + 1.4 * xv / 100) : sigma; }

    function draw() {
      while (g.firstChild) g.removeChild(g.firstChild);

      XS.forEach(function (xv) {
        var mean = B1 + B2 * xv, sp = sd(xv);

        /* the conditional distribution, sketched as a light spine */
        g.appendChild(s("line", {
          x1: c.x(xv), y1: c.y(mean - 2.1 * sp),
          x2: c.x(xv), y2: c.y(mean + 2.1 * sp),
          stroke: P.ruleSoft, "stroke-width": 1
        }));

        D.forEach(function (d) {
          var yv = mean + d * sp;
          g.appendChild(s("circle", {
            cx: c.x(xv), cy: c.y(yv), r: 3.4,
            fill: d > 0 ? P.accent : d < 0 ? P.accent2 : P.inkFaint
          }));
        });

        /* the circled mean of the deck's Figure 1 — always on the line */
        g.appendChild(s("circle", {
          cx: c.x(xv), cy: c.y(mean), r: 7.5,
          fill: "none", stroke: P.ink, "stroke-width": 2
        }));
      });

      readout.textContent =
        "Spread of u at X = 12: " + sd(12).toFixed(1) +
        "    at X = 82: " + sd(82).toFixed(1) +
        (hetero ? "    — not constant" : "    — constant");
      c.svg.setAttribute("aria-label",
        "Population regression line with observations stacked above and below it at "
        + "six income levels; the ringed conditional mean sits on the line at every one.");
    }

    var controls = h("div", "viz-controls");

    var lab = h("label", null, "spread of u");
    var rng = document.createElement("input");
    rng.type = "range"; rng.min = "2"; rng.max = "14"; rng.step = "0.5"; rng.value = "8";
    rng.addEventListener("input", function () { sigma = +rng.value; draw(); });
    lab.appendChild(rng);
    controls.appendChild(lab);

    var tog = h("button", null, "Let the variance grow with X");
    tog.addEventListener("click", function () {
      hetero = !hetero;
      tog.textContent = hetero ? "Restore constant variance" : "Let the variance grow with X";
      draw();
    });
    controls.appendChild(tog);

    var readout = h("span", "viz-readout");
    controls.appendChild(readout);

    host.appendChild(c.svg);
    host.appendChild(controls);
    host.appendChild(h("p", "viz-caption",
      "Two assumptions are in this one picture. Assumption 4 says the ringed average of the "
      + "disturbances at each income sits exactly on the population line — the observations "
      + "above it (red) are cancelled by those below (blue), whatever the spread. That never "
      + "breaks here, because it is built into the arithmetic. Assumption 5 is the other "
      + "dial: press the button and the spread fans out with income. The rings stay on the "
      + "line, so OLS is still unbiased — but every variance formula in this unit has just "
      + "become wrong, which is the whole of Unit 2C."));

    draw();
  });

  /* ============================================================
     Unit 1C — Figure 2: correlated and non-correlated disturbances

     The deck's Figure 2 is a pair of static pictures. One slider
     turns one into the other, because the point is that they are the
     same object at different values of a single parameter.

     Shocks are drawn once and then held, so moving the slider shows
     the effect of ρ alone rather than a fresh scatter each time.
     ============================================================ */
  VIZ.register("error-correlation", function (host) {
    var N = 40, rho = 0, shocks = [];

    function gauss() {
      var u = 1 - Math.random(), v = Math.random();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    }
    for (var i = 0; i < N; i++) shocks.push(gauss());

    var c = chart({ w: 640, h: 320, xd: [0, N + 1], yd: [-3.2, 3.2] });
    c.axes("Observation  i", "Disturbance  u");

    var zero = s("line", {
      x1: c.x(0), y1: c.y(0), x2: c.x(N + 1), y2: c.y(0),
      stroke: P.ink, "stroke-width": 1, "stroke-dasharray": "4 3", opacity: 0.6
    });
    var path = s("polyline", { fill: "none", stroke: P.accent2, "stroke-width": 1.6, opacity: 0.75 });
    var dots = s("g");
    c.plot.appendChild(zero);
    c.plot.appendChild(path);
    c.plot.appendChild(dots);

    function draw() {
      var u = [], prev = 0, k, pts = [];
      var scale = Math.sqrt(1 - rho * rho);       /* keep the variance comparable */
      for (k = 0; k < N; k++) {
        prev = rho * prev + scale * shocks[k];
        u.push(prev);
      }

      while (dots.firstChild) dots.removeChild(dots.firstChild);
      for (k = 0; k < N; k++) {
        var yv = Math.max(-3.1, Math.min(3.1, u[k]));
        pts.push(c.x(k + 1) + "," + c.y(yv));
        dots.appendChild(s("circle", {
          cx: c.x(k + 1), cy: c.y(yv), r: 3.2,
          fill: u[k] >= 0 ? P.accent : P.accent2
        }));
      }
      path.setAttribute("points", pts.join(" "));

      /* the sample first-order autocorrelation actually present */
      var num = 0, den = 0;
      for (k = 0; k < N; k++) den += u[k] * u[k];
      for (k = 1; k < N; k++) num += u[k] * u[k - 1];
      var r1 = den === 0 ? 0 : num / den;

      /* runs: how often the sign changes from one observation to the next */
      var flips = 0;
      for (k = 1; k < N; k++) if ((u[k] >= 0) !== (u[k - 1] >= 0)) flips++;

      readout.textContent =
        "ρ set to " + rho.toFixed(2) +
        "    sample r₁ = " + r1.toFixed(2) +
        "    sign changes: " + flips + " of " + (N - 1);
      c.svg.setAttribute("aria-label",
        "Disturbances plotted against observation number, with first-order "
        + "autocorrelation set to " + rho.toFixed(2) + ".");
    }

    var controls = h("div", "viz-controls");
    var lab = h("label", null, "correlation ρ between uᵢ and uᵢ₋₁");
    var rng = document.createElement("input");
    rng.type = "range"; rng.min = "-0.9"; rng.max = "0.9"; rng.step = "0.05"; rng.value = "0";
    rng.addEventListener("input", function () { rho = +rng.value; draw(); });
    lab.appendChild(rng);
    controls.appendChild(lab);

    var reset = h("button", null, "Back to ρ = 0");
    reset.addEventListener("click", function () { rho = 0; rng.value = "0"; draw(); });
    controls.appendChild(reset);

    var readout = h("span", "viz-readout");
    controls.appendChild(readout);

    host.appendChild(c.svg);
    host.appendChild(controls);
    host.appendChild(h("p", "viz-caption",
      "At ρ = 0 the sign of one disturbance tells you nothing about the next, and the series "
      + "crosses the zero line constantly — that is assumption 6 holding. Slide ρ up and the "
      + "disturbances arrive in long runs on the same side of zero; slide it down and they "
      + "alternate almost every period. Both are autocorrelation, and both leave the OLS "
      + "variance formulae in this unit understating the true uncertainty. Unit 2D is about "
      + "detecting this from the residuals, which are all you ever actually see."));

    draw();
  });

  /* ============================================================
     Unit 1C — Figure 3: TSS = ESS + RSS, and where r² comes from

     One slider moves the scatter from "every point on the line" to
     "no relationship visible", and the decomposition bar underneath
     is redrawn from the same numbers the readout reports. The point
     is that r² is not a separate quantity — it is the share of the
     bar that the line accounts for.
     ============================================================ */
  VIZ.register("r2-decomposition", function (host) {
    var B1 = 20, B2 = 0.6, N = 16, noise = 8;
    var xs = [], dev = [];

    function gauss() {
      var u = 1 - Math.random(), v = Math.random();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    }
    for (var i = 0; i < N; i++) {
      xs.push(8 + i * (84 / (N - 1)));
      dev.push(gauss());
    }

    var c = chart({ w: 640, h: 360, xd: [0, 100], yd: [0, 100] });
    c.axes("Income  X", "Consumption  Y");

    var meanLine = s("line", { stroke: P.inkFaint, "stroke-width": 1.6, "stroke-dasharray": "6 4" });
    var fit = s("line", { stroke: P.accent, "stroke-width": 2.5 });
    var drops = s("g");
    var dots = s("g");
    c.plot.appendChild(meanLine);
    c.plot.appendChild(fit);
    c.plot.appendChild(drops);
    c.plot.appendChild(dots);

    /* the decomposition bar lives in its own small svg beneath the plot */
    var bar = s("svg", { viewBox: "0 0 640 62", preserveAspectRatio: "xMidYMid meet" });
    var ess = s("rect", { x: 60, y: 14, height: 22, fill: P.accent2 });
    var rss = s("rect", { y: 14, height: 22, fill: P.ruleSoft });
    var essT = s("text", { y: 52, "font-size": 11.5, fill: P.accent2, "text-anchor": "middle" });
    var rssT = s("text", { y: 52, "font-size": 11.5, fill: P.inkSoft, "text-anchor": "middle" });
    var tssT = s("text", { x: 8, y: 30, "font-size": 11.5, fill: P.ink });
    tssT.textContent = "TSS";
    bar.appendChild(ess); bar.appendChild(rss);
    bar.appendChild(essT); bar.appendChild(rssT); bar.appendChild(tssT);

    function draw() {
      var pts = [], k;
      for (k = 0; k < N; k++) {
        pts.push({ x: xs[k], y: B1 + B2 * xs[k] + dev[k] * noise });
      }
      var r = ols(pts);
      var my = 0;
      for (k = 0; k < N; k++) my += pts[k].y;
      my /= N;

      meanLine.setAttribute("x1", c.x(0));   meanLine.setAttribute("y1", c.y(my));
      meanLine.setAttribute("x2", c.x(100)); meanLine.setAttribute("y2", c.y(my));
      fit.setAttribute("x1", c.x(0));   fit.setAttribute("y1", c.y(r.b1));
      fit.setAttribute("x2", c.x(100)); fit.setAttribute("y2", c.y(r.b1 + r.b2 * 100));

      while (drops.firstChild) drops.removeChild(drops.firstChild);
      while (dots.firstChild) dots.removeChild(dots.firstChild);
      for (k = 0; k < N; k++) {
        var yh = r.b1 + r.b2 * pts[k].x;
        drops.appendChild(s("line", {
          x1: c.x(pts[k].x), y1: c.y(pts[k].y),
          x2: c.x(pts[k].x), y2: c.y(yh),
          stroke: P.accent, "stroke-width": 1, "stroke-dasharray": "3 3", opacity: 0.7
        }));
        dots.appendChild(s("circle", {
          cx: c.x(pts[k].x), cy: c.y(pts[k].y), r: 4, fill: P.ink
        }));
      }

      /* TSS = ESS + RSS, taken straight from the same fit */
      var TSS = r.tss, RSS = r.rss, ESS = TSS - RSS;
      var full = 560, wE = TSS === 0 ? 0 : full * (ESS / TSS), wR = full - wE;
      ess.setAttribute("width", Math.max(0, wE));
      rss.setAttribute("x", 60 + Math.max(0, wE));
      rss.setAttribute("width", Math.max(0, wR));
      essT.setAttribute("x", 60 + wE / 2);
      rssT.setAttribute("x", 60 + wE + wR / 2);
      essT.textContent = wE > 90 ? "ESS  " + ESS.toFixed(0) : "";
      rssT.textContent = wR > 90 ? "RSS  " + RSS.toFixed(0) : "";

      readout.textContent =
        "TSS = " + TSS.toFixed(0) + "    ESS = " + ESS.toFixed(0) +
        "    RSS = " + RSS.toFixed(0);
      r2out.textContent = "r² = ESS/TSS = " + r.r2.toFixed(3);
      c.svg.setAttribute("aria-label",
        "Scatter with the fitted line and the residual drops, at r squared of "
        + r.r2.toFixed(3) + ".");
    }

    var controls = h("div", "viz-controls");
    var lab = h("label", null, "scatter about the line");
    var rng = document.createElement("input");
    rng.type = "range"; rng.min = "0"; rng.max = "22"; rng.step = "0.5"; rng.value = "8";
    rng.addEventListener("input", function () { noise = +rng.value; draw(); });
    lab.appendChild(rng);
    controls.appendChild(lab);
    var readout = h("span", "viz-readout");
    var r2out = h("span", "viz-readout");
    controls.appendChild(readout);
    controls.appendChild(r2out);

    host.appendChild(c.svg);
    host.appendChild(bar);
    host.appendChild(controls);
    host.appendChild(h("p", "viz-caption",
      "The dashed horizontal line is Ȳ. Total variation — TSS, the whole bar — is how far "
      + "the observations sit from it. The line accounts for the blue part (ESS); the grey "
      + "part is what is left in the residuals (RSS). r² is nothing more than the blue "
      + "share. Slide the scatter to zero and every point lands on the line: RSS vanishes "
      + "and r² = 1. Widen it and the blue share collapses — but notice that the fitted "
      + "slope stays near 0.600 throughout. A low r² is not the same thing as a wrong "
      + "coefficient."));

    draw();
  });

  /* ============================================================
     Unit 1D — Figure 1: what a variable left in the error term does

     The deck's test-score example says an omitted family-income
     variable biases the estimated effect of spending "because per
     student spending is correlated with average family income".
     The size of that bias is a function of one number, so that
     number gets a slider.

     Truth: Y = 20 + 0.6·X2 + 0.5·X3 + u, and the figure reports what
     a regression of Y on X2 ALONE recovers as X2 and X3 are made to
     move together.

     The disturbance is deliberately small. This figure is about BIAS,
     and sampling error large enough to be visible at corr = 0 would
     muddy exactly the comparison being drawn. The expected drift is
     β3 × corr(X2, X3) = 0.5ρ, so the readout should track that.
     ============================================================ */
  VIZ.register("omitted-variable-bias", function (host) {
    var B1 = 20, B2 = 0.6, B3 = 0.5, N = 40, rho = 0;
    var a = [], b = [], e = [];

    function gauss() {
      var u = 1 - Math.random(), v = Math.random();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    }
    for (var i = 0; i < N; i++) { a.push(gauss()); b.push(gauss()); e.push(gauss()); }

    var c = chart({ w: 640, h: 380, xd: [0, 100], yd: [0, 130] });
    c.axes("Spending per student  X₂", "Average test score  Y");

    var truth = s("line", { stroke: P.accent2, "stroke-width": 2.5 });
    var naive = s("line", { stroke: P.accent, "stroke-width": 2.5, "stroke-dasharray": "7 4" });
    var dots = s("g");
    c.plot.appendChild(truth);
    c.plot.appendChild(naive);
    c.plot.appendChild(dots);

    function legend(text, colour, dy, dash) {
      var g = s("g");
      g.appendChild(s("line", { x1: c.x(3), y1: dy, x2: c.x(11), y2: dy,
                                stroke: colour, "stroke-width": 2.5, "stroke-dasharray": dash }));
      var t = s("text", { x: c.x(13), y: dy + 4, "font-size": 11.5, fill: colour });
      t.textContent = text;
      g.appendChild(t);
      c.plot.appendChild(g);
    }
    legend("true partial slope β2 = 0.600", P.accent2, 22, null);
    legend("Y regressed on X2 alone", P.accent, 40, "7 4");

    function draw() {
      var pts = [], x2 = [], x3 = [], y = [], k;
      var mix = Math.sqrt(1 - rho * rho);

      for (k = 0; k < N; k++) {
        var v2 = 50 + 18 * a[k];
        var v3 = 50 + 18 * (rho * a[k] + mix * b[k]);
        var yv = B1 + B2 * v2 + B3 * v3 + 2.2 * e[k];
        x2.push(v2); x3.push(v3); y.push(yv);
        pts.push({ x: v2, y: yv });
      }

      var simple = ols(pts);                       /* Y on X2 only */
      var full = ols3(x2, x3, y);                  /* Y on X2 and X3 */

      while (dots.firstChild) dots.removeChild(dots.firstChild);
      pts.forEach(function (p) {
        dots.appendChild(s("circle", {
          cx: c.x(Math.max(0, Math.min(100, p.x))),
          cy: c.y(Math.max(0, Math.min(130, p.y))),
          r: 4, fill: P.ink
        }));
      });

      /* the truth line is drawn through the data's own centre of
         gravity, so the comparison is of slopes and not of levels */
      var mx = 0, my = 0;
      for (k = 0; k < N; k++) { mx += x2[k]; my += y[k]; }
      mx /= N; my /= N;
      truth.setAttribute("x1", c.x(0));   truth.setAttribute("y1", c.y(my - B2 * mx));
      truth.setAttribute("x2", c.x(100)); truth.setAttribute("y2", c.y(my + B2 * (100 - mx)));
      naive.setAttribute("x1", c.x(0));   naive.setAttribute("y1", c.y(simple.b1));
      naive.setAttribute("x2", c.x(100)); naive.setAttribute("y2", c.y(simple.b1 + simple.b2 * 100));

      readout.textContent =
        "Y on X₂ alone: β̂₂ = " + simple.b2.toFixed(3) +
        "    Y on X₂ and X₃: β̂₂ = " + full.b2.toFixed(3);
      biasout.textContent =
        "corr(X₂, X₃) = " + rho.toFixed(2) +
        "    bias from omitting X₃ = " + (simple.b2 - B2 >= 0 ? "+" : "") +
        (simple.b2 - B2).toFixed(3);
      c.svg.setAttribute("aria-label",
        "Test scores against spending, with the true partial slope and the slope "
        + "recovered by omitting family income, at a correlation of " + rho.toFixed(2) + ".");
    }

    var controls = h("div", "viz-controls");
    var lab = h("label", null, "corr(X₂, X₃)");
    var rng = document.createElement("input");
    rng.type = "range"; rng.min = "0"; rng.max = "0.95"; rng.step = "0.05"; rng.value = "0";
    rng.addEventListener("input", function () { rho = +rng.value; draw(); });
    lab.appendChild(rng);
    controls.appendChild(lab);
    var readout = h("span", "viz-readout");
    var biasout = h("span", "viz-readout");
    controls.appendChild(readout);
    controls.appendChild(biasout);

    host.appendChild(c.svg);
    host.appendChild(controls);
    host.appendChild(h("p", "viz-caption",
      "X₃ is average family income, and it is left out of the regression — so it sits in the "
      + "disturbance. At corr(X₂, X₃) = 0 that is harmless: the dashed line tracks the true "
      + "partial slope of 0.600, because a variable in the error term that is unrelated to the "
      + "regressor does no damage. Slide the correlation up and the dashed line tilts away. "
      + "Spending is now partly standing in for income, and the estimate collects both effects. "
      + "Note that the multiple regression recovers 0.600 throughout: that is what "
      + "“holding X₃ constant” buys you. Assumption 3 is what has failed here, and the "
      + "full account is Unit 2A Part 1."));

    draw();
  });

  /* ============================================================
     Unit 1D — Figure 2: why R² cannot be used to choose a model

     R² is a non-decreasing function of the number of regressors.
     The cleanest way to see that is to add regressors that are known
     to be pure noise and watch it rise anyway. The adjusted R²,
     which charges for the degrees of freedom spent, does not.
     ============================================================ */
  VIZ.register("r2-vs-adjusted", function (host) {
    var N = 30, junk = 0, MAXJ = 15;
    var xs = [], ys = [], noise = [];

    function gauss() {
      var u = 1 - Math.random(), v = Math.random();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    }
    for (var i = 0; i < N; i++) {
      xs.push(10 + i * (80 / (N - 1)));
      ys.push(20 + 0.6 * xs[i] + 11 * gauss());
      noise.push([]);
      for (var j = 0; j < MAXJ; j++) noise[i].push(gauss());   /* held fixed */
    }

    var W = 640, H = 300, PAD = { t: 18, r: 16, b: 42, l: 48 };
    var c = chart({ w: W, h: H, pad: PAD, xd: [0, MAXJ], yd: [0, 1] });
    c.axes("Regressors of pure noise added", "");

    /* gridlines, so the reader can see 0.5 without counting */
    [0.25, 0.5, 0.75, 1].forEach(function (g) {
      c.plot.appendChild(s("line", {
        x1: c.x(0), y1: c.y(g), x2: c.x(MAXJ), y2: c.y(g),
        stroke: P.rule, "stroke-width": 1
      }));
      var t = s("text", { x: c.x(0) - 6, y: c.y(g) + 4, "font-size": 10.5,
                          fill: P.inkFaint, "text-anchor": "end" });
      t.textContent = g.toFixed(2);
      c.plot.appendChild(t);
    });

    var pR2 = s("polyline", { fill: "none", stroke: P.accent2, "stroke-width": 2.5 });
    var pAdj = s("polyline", { fill: "none", stroke: P.accent, "stroke-width": 2.5,
                               "stroke-dasharray": "7 4" });
    var marks = s("g");
    c.plot.appendChild(pR2);
    c.plot.appendChild(pAdj);
    c.plot.appendChild(marks);

    var lg1 = s("text", { x: c.x(0.4), y: c.y(0.06), "font-size": 11.5, fill: P.accent2 });
    lg1.textContent = "R²  — never falls";
    var lg2 = s("text", { x: c.x(0.4), y: c.y(0.02), "font-size": 11.5, fill: P.accent });
    lg2.textContent = "adjusted R²  — charges for each regressor";
    c.plot.appendChild(lg1);
    c.plot.appendChild(lg2);

    /* fit with j noise columns bolted on, for every j up to MAXJ */
    function fitWith(j) {
      var X = [], k, m;
      for (k = 0; k < N; k++) {
        var row = [1, xs[k]];
        for (m = 0; m < j; m++) row.push(noise[k][m]);
        X.push(row);
      }
      var r = olsk(X, ys);
      var kk = 2 + j;                       /* parameters, intercept included */
      var adj = 1 - (1 - r.r2) * (N - 1) / (N - kk);
      return { r2: r.r2, adj: adj };
    }

    var series = [];
    for (var j = 0; j <= MAXJ; j++) series.push(fitWith(j));

    function draw() {
      var a = [], b = [], j;
      for (j = 0; j <= junk; j++) {
        a.push(c.x(j) + "," + c.y(Math.max(0, Math.min(1, series[j].r2))));
        b.push(c.x(j) + "," + c.y(Math.max(0, Math.min(1, series[j].adj))));
      }
      pR2.setAttribute("points", a.join(" "));
      pAdj.setAttribute("points", b.join(" "));

      while (marks.firstChild) marks.removeChild(marks.firstChild);
      marks.appendChild(s("circle", { cx: c.x(junk), cy: c.y(series[junk].r2), r: 4.5, fill: P.accent2 }));
      marks.appendChild(s("circle", { cx: c.x(junk), cy: c.y(Math.max(0, series[junk].adj)), r: 4.5, fill: P.accent }));

      readout.textContent =
        junk + " noise regressor" + (junk === 1 ? "" : "s") +
        "    k = " + (2 + junk) + "    n − k = " + (N - 2 - junk);
      valout.textContent =
        "R² = " + series[junk].r2.toFixed(3) +
        "    adjusted R² = " + series[junk].adj.toFixed(3);
      c.svg.setAttribute("aria-label",
        "R squared and adjusted R squared against the number of noise regressors added, "
        + "currently " + junk + ".");
    }

    var controls = h("div", "viz-controls");
    var lab = h("label", null, "noise regressors");
    var rng = document.createElement("input");
    rng.type = "range"; rng.min = "0"; rng.max = String(MAXJ); rng.step = "1"; rng.value = "0";
    rng.addEventListener("input", function () { junk = +rng.value; draw(); });
    lab.appendChild(rng);
    controls.appendChild(lab);
    var readout = h("span", "viz-readout");
    var valout = h("span", "viz-readout");
    controls.appendChild(readout);
    controls.appendChild(valout);

    host.appendChild(c.svg);
    host.appendChild(controls);
    host.appendChild(h("p", "viz-caption",
      "Only X₂ belongs in this model. Every regressor added by the slider is a column of "
      + "random numbers with no connection to Y whatsoever. R² climbs anyway, and by the far "
      + "end a model that is almost entirely noise is “explaining” far more of Y than "
      + "the correct one did — because adding a regressor can only ever shrink the residual "
      + "sum of squares. The adjusted R² charges n − k for the privilege and falls, which is "
      + "why it, and not R², is the one to quote when comparing models of different size. "
      + "Neither is a substitute for asking whether the variable belongs there on theory."));

    draw();
  });

  /* ============================================================
     Unit 1E — Figure 1: the central limit theorem, as an argument

     The deck justifies assuming normality by appeal to the CLT: the
     disturbance is the total influence of a large number of omitted
     factors, and a sum of many independent influences tends to a
     normal distribution however the individual influences are shaped.

     The influences here are uniform — deliberately the least
     bell-shaped thing available — so the convergence is not smuggled
     in. Draws are generated once and held, so moving the slider adds
     influences to the SAME experiment rather than running a new one.
     ============================================================ */
  VIZ.register("clt-error", function (host) {
    var T = 3000, MAXM = 24, m = 1;
    var pool = [], i, j;
    for (i = 0; i < T; i++) {
      var row = [];
      for (j = 0; j < MAXM; j++) row.push(Math.random() * 2 - 1);   /* uniform(−1, 1) */
      pool.push(row);
    }

    var BINS = 41, LO = -3.6, HI = 3.6;
    var c = chart({ w: 640, h: 330, pad: { t: 18, r: 16, b: 42, l: 44 },
                    xd: [LO, HI], yd: [0, 0.55] });
    c.axes("Sum of the omitted influences, standardised", "");

    var bars = s("g");
    var curve = s("path", { fill: "none", stroke: P.accent, "stroke-width": 2.5 });
    c.plot.appendChild(bars);
    c.plot.appendChild(curve);

    var lg = s("text", { x: c.x(LO + 0.15), y: c.y(0.51), "font-size": 11.5, fill: P.accent });
    lg.textContent = "N(0, 1) — what the CLT promises";
    c.plot.appendChild(lg);

    /* the normal density, drawn once: it never moves */
    var d = "", t;
    for (t = 0; t <= 160; t++) {
      var xv = LO + (HI - LO) * t / 160;
      var yv = Math.exp(-xv * xv / 2) / Math.sqrt(2 * Math.PI);
      d += (t ? "L" : "M") + c.x(xv) + " " + c.y(yv);
    }
    curve.setAttribute("d", d);

    function draw() {
      /* a sum of m uniforms has variance m/3, so divide by its own sd
         to keep the picture on one scale as m grows */
      var sd = Math.sqrt(m / 3), counts = new Array(BINS).fill(0), k, q;
      for (k = 0; k < T; k++) {
        var sum = 0;
        for (q = 0; q < m; q++) sum += pool[k][q];
        var z = sum / sd;
        var b = Math.floor((z - LO) / (HI - LO) * BINS);
        if (b >= 0 && b < BINS) counts[b]++;
      }

      var w = (HI - LO) / BINS;
      while (bars.firstChild) bars.removeChild(bars.firstChild);
      for (k = 0; k < BINS; k++) {
        var dens = counts[k] / (T * w);
        if (dens <= 0) continue;
        var x0 = LO + k * w;
        bars.appendChild(s("rect", {
          x: c.x(x0) + 0.5, y: c.y(Math.min(0.55, dens)),
          width: Math.max(0.5, c.x(x0 + w) - c.x(x0) - 1),
          height: Math.max(0, c.y(0) - c.y(Math.min(0.55, dens))),
          fill: P.accent2, opacity: 0.62
        }));
      }

      readout.textContent = m === 1
        ? "1 influence — flat, nothing like a bell"
        : m + " influences summed";
      c.svg.setAttribute("aria-label",
        "Histogram of the standardised sum of " + m
        + " uniform influences, against the standard normal density.");
    }

    var controls = h("div", "viz-controls");
    var lab = h("label", null, "influences in u");
    var rng = document.createElement("input");
    rng.type = "range"; rng.min = "1"; rng.max = String(MAXM); rng.step = "1"; rng.value = "1";
    rng.addEventListener("input", function () { m = +rng.value; draw(); });
    lab.appendChild(rng);
    controls.appendChild(lab);
    var readout = h("span", "viz-readout");
    controls.appendChild(readout);

    host.appendChild(c.svg);
    host.appendChild(controls);
    host.appendChild(h("p", "viz-caption",
      "Each influence here is uniform — every value between −1 and 1 equally likely, which is "
      + "about as far from a bell as a distribution gets. At one influence the histogram is "
      + "flat and the normal curve is plainly wrong. By three it is already close; by ten it "
      + "is hard to tell apart. That is the central limit theorem, and it is the reason the "
      + "normality assumption is defensible: nobody claims any single omitted factor is "
      + "normal, only that u is the sum of many of them. Note what the argument needs — the "
      + "influences must be numerous, independent, and none of them dominant. When one "
      + "omitted factor does dominate, this argument gives you nothing."));

    draw();
  });

  /* ============================================================
     Unit 1E — Figure 2: maximising the likelihood IS minimising RSS

     The deck's punchline is that the ML normal equations are the OLS
     normal equations, "and this equality is not accidental — the last
     term of the log-likelihood enters with a negative sign".

     Here β1 is concentrated out (the line is held through the point of
     means, as OLS requires) and σ² is profiled out at its own maximum
     σ̃² = RSS/n, leaving ln L a strictly decreasing function of RSS.
     One slider therefore moves both curves at once, and their turning
     points cannot help but coincide.
     ============================================================ */
  VIZ.register("ml-equals-ols", function (host) {
    var N = 14, B1 = 20, B2T = 0.6;
    var pts = [];

    function gauss() {
      var u = 1 - Math.random(), v = Math.random();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    }
    for (var i = 0; i < N; i++) {
      var xv = 10 + i * (78 / (N - 1));
      pts.push({ x: xv, y: B1 + B2T * xv + 8 * gauss() });
    }

    var fit = ols(pts);
    var mx = 0, my = 0;
    pts.forEach(function (p) { mx += p.x; my += p.y; });
    mx /= N; my /= N;

    var LO = fit.b2 - 0.45, HI = fit.b2 + 0.45;
    var b2 = LO;

    /* --- top panel: the data and the candidate line --- */
    var c = chart({ w: 640, h: 300, xd: [0, 100], yd: [0, 100] });
    c.axes("Income  X", "Consumption  Y");
    var line = s("line", { stroke: P.accent, "stroke-width": 2.5 });
    var drops = s("g");
    var dots = s("g");
    c.plot.appendChild(line);
    c.plot.appendChild(drops);
    c.plot.appendChild(dots);
    pts.forEach(function (p) {
      dots.appendChild(s("circle", { cx: c.x(p.x), cy: c.y(p.y), r: 4, fill: P.ink }));
    });

    /* --- bottom panel: RSS and ln L over the same β2 axis --- */
    var g2 = chart({ w: 640, h: 230, pad: { t: 20, r: 16, b: 42, l: 44 },
                     xd: [LO, HI], yd: [0, 1] });
    g2.axes("candidate value of β2", "");
    var pRSS = s("polyline", { fill: "none", stroke: P.accent2, "stroke-width": 2.5 });
    var pLL = s("polyline", { fill: "none", stroke: P.accent, "stroke-width": 2.5,
                              "stroke-dasharray": "7 4" });
    var vline = s("line", { stroke: P.ink, "stroke-width": 1, "stroke-dasharray": "3 3" });
    var markR = s("circle", { r: 4.5, fill: P.accent2 });
    var markL = s("circle", { r: 4.5, fill: P.accent });
    g2.plot.appendChild(vline);
    g2.plot.appendChild(pRSS);
    g2.plot.appendChild(pLL);
    g2.plot.appendChild(markR);
    g2.plot.appendChild(markL);

    var t1 = s("text", { x: g2.x(LO) + 8, y: g2.y(0.93), "font-size": 11.5, fill: P.accent2 });
    t1.textContent = "Σû²  — OLS drives this DOWN";
    var t2 = s("text", { x: g2.x(LO) + 8, y: g2.y(0.80), "font-size": 11.5, fill: P.accent });
    t2.textContent = "ln L  — ML drives this UP";
    g2.plot.appendChild(t1);
    g2.plot.appendChild(t2);

    function rssAt(b) {
      var r = 0;
      pts.forEach(function (p) {
        var e = p.y - (my - b * mx) - b * p.x;
        r += e * e;
      });
      return r;
    }
    function llAt(b) {
      /* profile log-likelihood: σ̃² = RSS/n substituted back in */
      var r = rssAt(b);
      return -(N / 2) * Math.log(r / N) - (N / 2) * Math.log(2 * Math.PI) - N / 2;
    }

    /* pre-compute both curves and their ranges, for scaling to [0,1] */
    var STEPS = 120, rs = [], ls = [], k;
    for (k = 0; k <= STEPS; k++) {
      var bb = LO + (HI - LO) * k / STEPS;
      rs.push(rssAt(bb));
      ls.push(llAt(bb));
    }
    var rMin = Math.min.apply(null, rs), rMax = Math.max.apply(null, rs);
    var lMin = Math.min.apply(null, ls), lMax = Math.max.apply(null, ls);
    var nR = function (v) { return 0.08 + 0.62 * (v - rMin) / (rMax - rMin || 1); };
    var nL = function (v) { return 0.08 + 0.62 * (v - lMin) / (lMax - lMin || 1); };

    var aR = [], aL = [];
    for (k = 0; k <= STEPS; k++) {
      var bx = g2.x(LO + (HI - LO) * k / STEPS);
      aR.push(bx + "," + g2.y(nR(rs[k])));
      aL.push(bx + "," + g2.y(nL(ls[k])));
    }
    pRSS.setAttribute("points", aR.join(" "));
    pLL.setAttribute("points", aL.join(" "));

    function draw() {
      var b1 = my - b2 * mx;
      line.setAttribute("x1", c.x(0));   line.setAttribute("y1", c.y(b1));
      line.setAttribute("x2", c.x(100)); line.setAttribute("y2", c.y(b1 + b2 * 100));

      while (drops.firstChild) drops.removeChild(drops.firstChild);
      pts.forEach(function (p) {
        drops.appendChild(s("line", {
          x1: c.x(p.x), y1: c.y(p.y), x2: c.x(p.x), y2: c.y(b1 + b2 * p.x),
          stroke: P.accent, "stroke-width": 1, "stroke-dasharray": "3 3", opacity: 0.7
        }));
      });

      var r = rssAt(b2), l = llAt(b2);
      vline.setAttribute("x1", g2.x(b2)); vline.setAttribute("y1", g2.y(0));
      vline.setAttribute("x2", g2.x(b2)); vline.setAttribute("y2", g2.y(1));
      markR.setAttribute("cx", g2.x(b2)); markR.setAttribute("cy", g2.y(nR(r)));
      markL.setAttribute("cx", g2.x(b2)); markL.setAttribute("cy", g2.y(nL(l)));

      readout.textContent =
        "β2 = " + b2.toFixed(3) + "    Σû² = " + r.toFixed(1) + "    ln L = " + l.toFixed(2);
      best.textContent =
        Math.abs(b2 - fit.b2) < 0.008
          ? "at the OLS estimate β̂2 = " + fit.b2.toFixed(3) + " — both are at their turning point"
          : "OLS β̂2 = " + fit.b2.toFixed(3);
      c.svg.setAttribute("aria-label",
        "Scatter with a candidate regression line at slope " + b2.toFixed(3) + ".");
    }

    var controls = h("div", "viz-controls");
    var lab = h("label", null, "β2");
    var rng = document.createElement("input");
    rng.type = "range"; rng.min = String(LO); rng.max = String(HI);
    rng.step = "0.005"; rng.value = String(LO);
    rng.addEventListener("input", function () { b2 = +rng.value; draw(); });
    lab.appendChild(rng);
    controls.appendChild(lab);
    var snap = h("button", null, "Snap to β̂2");
    snap.addEventListener("click", function () { b2 = fit.b2; rng.value = String(fit.b2); draw(); });
    controls.appendChild(snap);
    var readout = h("span", "viz-readout");
    var best = h("span", "viz-readout");
    controls.appendChild(readout);
    controls.appendChild(best);

    host.appendChild(c.svg);
    host.appendChild(g2.svg);
    host.appendChild(controls);
    host.appendChild(h("p", "viz-caption",
      "Drag β2 and watch both curves. Σû² is the quantity least squares makes as small as it "
      + "can; ln L is the quantity maximum likelihood makes as large as it can. They are not "
      + "two coincidentally aligned criteria — substituting σ̃² = Σû²/n back into the "
      + "log-likelihood leaves ln L a strictly decreasing function of Σû², so the trough of "
      + "one is necessarily the peak of the other. Press the button to land on β̂2. This is "
      + "why the ML and OLS estimators of the βs are identical under normality, and it is "
      + "also why they part company over σ²: ML divides by n and OLS by n − 2."));

    draw();
  });

  /* ============================================================
     Unit 1F — Figure 1: the test, drawn

     Every t-test in this unit is the same picture with different
     numbers in it: a density, a shaded region the null does not
     survive, and one vertical line. Rather than three static figures
     for the three tail choices, this is one figure with the tail as a
     control — because they ARE one procedure.

     Critical values are computed, not tabulated, so what the figure
     reports is what the t-tables would give you.
     ============================================================ */
  VIZ.register("t-critical-regions", function (host) {
    var df = 29, alpha = 0.05, tail = "two", tstat = 1.2;
    var LO = -4.6, HI = 4.6;

    var c = chart({ w: 640, h: 340, pad: { t: 20, r: 16, b: 44, l: 44 },
                    xd: [LO, HI], yd: [0, 0.42] });
    c.axes("t", "");

    var shade = s("path", { fill: P.accent, opacity: 0.18 });
    var curve = s("path", { fill: "none", stroke: P.accent2, "stroke-width": 2.5 });
    var stat = s("line", { stroke: P.ink, "stroke-width": 2 });
    var statLab = s("text", { "font-size": 11.5, fill: P.ink, "text-anchor": "middle" });
    var critG = s("g");
    c.plot.appendChild(shade);
    c.plot.appendChild(curve);
    c.plot.appendChild(critG);
    c.plot.appendChild(stat);
    c.plot.appendChild(statLab);

    function critical() {
      return tail === "two" ? tCrit(1 - alpha / 2, df) : tCrit(1 - alpha, df);
    }

    function draw() {
      var k, d = "", xv, yv;
      for (k = 0; k <= 240; k++) {
        xv = LO + (HI - LO) * k / 240;
        yv = tPdf(xv, df);
        d += (k ? "L" : "M") + c.x(xv) + " " + c.y(yv);
      }
      curve.setAttribute("d", d);

      /* the rejection region, as one filled path per tail */
      var cv = critical(), regions = [];
      if (tail === "two") regions.push([LO, -cv], [cv, HI]);
      else if (tail === "left") regions.push([LO, -cv]);
      else regions.push([cv, HI]);

      var sd = "";
      regions.forEach(function (r) {
        var a = Math.max(LO, r[0]), b = Math.min(HI, r[1]);
        if (b <= a) return;
        sd += "M" + c.x(a) + " " + c.y(0);
        for (k = 0; k <= 60; k++) {
          xv = a + (b - a) * k / 60;
          sd += "L" + c.x(xv) + " " + c.y(tPdf(xv, df));
        }
        sd += "L" + c.x(b) + " " + c.y(0) + "Z";
      });
      shade.setAttribute("d", sd || "M0 0");

      while (critG.firstChild) critG.removeChild(critG.firstChild);
      var cuts = tail === "two" ? [-cv, cv] : tail === "left" ? [-cv] : [cv];
      cuts.forEach(function (v) {
        critG.appendChild(s("line", {
          x1: c.x(v), y1: c.y(0), x2: c.x(v), y2: c.y(0.40),
          stroke: P.accent, "stroke-width": 1.4, "stroke-dasharray": "5 3"
        }));
        var t = s("text", { x: c.x(v), y: c.y(0.41), "font-size": 11,
                            fill: P.accent, "text-anchor": "middle" });
        t.textContent = v.toFixed(3);
        critG.appendChild(t);
      });

      var shown = Math.max(LO + 0.05, Math.min(HI - 0.05, tstat));
      stat.setAttribute("x1", c.x(shown)); stat.setAttribute("y1", c.y(0));
      stat.setAttribute("x2", c.x(shown)); stat.setAttribute("y2", c.y(0.32));
      statLab.setAttribute("x", c.x(shown));
      statLab.setAttribute("y", c.y(0.335));
      statLab.textContent = "t = " + tstat.toFixed(3);

      var reject = tail === "two" ? Math.abs(tstat) > cv
                 : tail === "left" ? tstat < -cv
                 : tstat > cv;

      readout.textContent =
        "df = " + df + "    α = " + alpha.toFixed(2) +
        "    crit = " + (tail === "left" ? "−" : "") + cv.toFixed(3);
      verdict.textContent = reject
        ? "reject H₀"
        : "do not reject H₀";
      verdict.style.color = reject ? P.accent : P.good;
      c.svg.setAttribute("aria-label",
        "t distribution with " + df + " degrees of freedom, " + tail
        + "-tailed rejection region at alpha " + alpha + ", test statistic " + tstat.toFixed(3)
        + ": " + (reject ? "reject" : "do not reject") + " the null.");
    }

    var controls = h("div", "viz-controls");

    function chooser(labelText, options, onPick) {
      var wrap = h("label", null, labelText);
      options.forEach(function (o) {
        var b = h("button", null, o.text);
        b.addEventListener("click", function () {
          onPick(o.value);
          Array.prototype.forEach.call(wrap.querySelectorAll("button"), function (n) {
            n.style.borderColor = "";
          });
          b.style.borderColor = P.accent;
          draw();
        });
        wrap.appendChild(b);
      });
      controls.appendChild(wrap);
      return wrap;
    }

    var tailBox = chooser("tail", [
      { text: "two", value: "two" }, { text: "left", value: "left" }, { text: "right", value: "right" }
    ], function (v) { tail = v; });
    var alphaBox = chooser("α", [
      { text: "0.10", value: 0.10 }, { text: "0.05", value: 0.05 }, { text: "0.01", value: 0.01 }
    ], function (v) { alpha = v; });

    var dfLab = h("label", null, "df = n − k");
    var dfRng = document.createElement("input");
    dfRng.type = "range"; dfRng.min = "3"; dfRng.max = "120"; dfRng.step = "1"; dfRng.value = "29";
    dfRng.addEventListener("input", function () { df = +dfRng.value; draw(); });
    dfLab.appendChild(dfRng);
    controls.appendChild(dfLab);

    var tLab = h("label", null, "t");
    var tRng = document.createElement("input");
    tRng.type = "range"; tRng.min = "-4.5"; tRng.max = "4.5"; tRng.step = "0.01"; tRng.value = "1.2";
    tRng.addEventListener("input", function () { tstat = +tRng.value; draw(); });
    tLab.appendChild(tRng);
    controls.appendChild(tLab);

    var readout = h("span", "viz-readout");
    var verdict = h("span", "viz-readout");
    controls.appendChild(readout);
    controls.appendChild(verdict);

    host.appendChild(c.svg);
    host.appendChild(controls);
    host.appendChild(h("p", "viz-caption",
      "The shaded area is α — the probability of landing there when the null is in fact true, "
      + "which is the risk of a wrong rejection you have agreed to run. Three things are worth "
      + "doing here. Switch between two-tailed and one-tailed at the same α and watch the "
      + "critical value fall: a one-tailed test puts the whole of α in one side, which is "
      + "exactly why it must be chosen before seeing the estimate. Drop α from 0.10 to 0.01 "
      + "and watch the bar for rejection rise. And drag the degrees of freedom up: the tails "
      + "thin out and the critical value settles towards the normal 1.96, which is what "
      + "“t → Z as n → ∞” means."));

    /* default highlighting on the two chooser rows */
    tailBox.querySelectorAll("button")[0].style.borderColor = P.accent;
    alphaBox.querySelectorAll("button")[1].style.borderColor = P.accent;
    draw();
  });

  /* ============================================================
     Unit 1F — Figure 2: what "95% confident" actually claims

     A confidence interval is a statement about the PROCEDURE, not
     about any one interval. The only way to see that is to run the
     procedure many times over and count.
     ============================================================ */
  VIZ.register("ci-coverage", function (host) {
    var B1 = 20, B2 = 0.6, SIGMA = 9, N = 20, RUNS = 40;
    var level = 0.95, intervals = [];

    function gauss() {
      var u = 1 - Math.random(), v = Math.random();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    }

    function build() {
      intervals = [];
      for (var r = 0; r < RUNS; r++) {
        var pts = [], i;
        for (i = 0; i < N; i++) {
          var xv = 8 + i * (84 / (N - 1));
          pts.push({ x: xv, y: B1 + B2 * xv + SIGMA * gauss() });
        }
        var f = ols(pts);
        var mx = 0;
        for (i = 0; i < N; i++) mx += pts[i].x;
        mx /= N;
        var sxx = 0;
        for (i = 0; i < N; i++) sxx += (pts[i].x - mx) * (pts[i].x - mx);
        var se = Math.sqrt((f.rss / (N - 2)) / sxx);
        intervals.push({ b2: f.b2, se: se });
      }
    }
    build();

    var c = chart({ w: 640, h: 400, pad: { t: 18, r: 20, b: 44, l: 40 },
                    xd: [0.2, 1.0], yd: [0, RUNS + 1] });
    c.axes("β̂2, with its confidence interval", "");

    var truth = s("line", {
      x1: c.x(B2), y1: c.y(0), x2: c.x(B2), y2: c.y(RUNS + 1),
      stroke: P.accent2, "stroke-width": 2
    });
    var bars = s("g");
    c.plot.appendChild(truth);
    c.plot.appendChild(bars);
    var lg = s("text", { x: c.x(B2) + 6, y: c.y(RUNS + 0.6), "font-size": 11.5, fill: P.accent2 });
    lg.textContent = "true β2 = 0.600";
    c.plot.appendChild(lg);

    function draw() {
      var crit = tCrit(1 - (1 - level) / 2, N - 2), hit = 0;
      while (bars.firstChild) bars.removeChild(bars.firstChild);

      intervals.forEach(function (iv, r) {
        var lo = iv.b2 - crit * iv.se, hi = iv.b2 + crit * iv.se;
        var covers = lo <= B2 && B2 <= hi;
        if (covers) hit++;
        var col = covers ? P.inkFaint : P.accent;
        var y = c.y(r + 1);
        bars.appendChild(s("line", {
          x1: c.x(Math.max(0.2, lo)), y1: y, x2: c.x(Math.min(1.0, hi)), y2: y,
          stroke: col, "stroke-width": covers ? 1.6 : 2.4
        }));
        bars.appendChild(s("circle", { cx: c.x(iv.b2), cy: y, r: 2.4, fill: col }));
      });

      readout.textContent =
        Math.round(level * 100) + "% intervals    critical value " + crit.toFixed(3);
      hitout.textContent =
        hit + " of " + RUNS + " contain β2 — " + (100 * hit / RUNS).toFixed(0) + "%";
      c.svg.setAttribute("aria-label",
        RUNS + " confidence intervals from " + RUNS + " samples; " + hit + " contain the true value.");
    }

    var controls = h("div", "viz-controls");
    var lab = h("label", null, "confidence");
    [0.90, 0.95, 0.99].forEach(function (L) {
      var b = h("button", null, Math.round(L * 100) + "%");
      b.addEventListener("click", function () {
        level = L;
        Array.prototype.forEach.call(lab.querySelectorAll("button"), function (n) { n.style.borderColor = ""; });
        b.style.borderColor = P.accent;
        draw();
      });
      lab.appendChild(b);
    });
    controls.appendChild(lab);
    var again = h("button", null, "Draw 40 new samples");
    again.addEventListener("click", function () { build(); draw(); });
    controls.appendChild(again);
    var readout = h("span", "viz-readout");
    var hitout = h("span", "viz-readout");
    controls.appendChild(readout);
    controls.appendChild(hitout);

    host.appendChild(c.svg);
    host.appendChild(controls);
    host.appendChild(h("p", "viz-caption",
      "Forty samples from the same population, forty intervals. The true β2 = 0.600 is fixed "
      + "and does not move; the intervals do, because each is built from a different sample. "
      + "Roughly 95% of them cover the truth, and the ones drawn in red do not — that is the "
      + "entire content of “95% confident”. It is a claim about how often the PROCEDURE works, "
      + "not about any one interval, and you never know which kind you are holding. Widen to "
      + "99% and more intervals cover, at the cost of saying much less; narrow to 90% and more "
      + "miss. Notice too that every interval that fails to cover 0.600 would also reject a "
      + "true null at that level — the interval and the test are the same arithmetic."));

    lab.querySelectorAll("button")[1].style.borderColor = P.accent;
    draw();
  });

  /* ============================================================
     Unit 2A Part 1 — Figure 1: the direction-of-bias table, live

     The deck's Table 1 is a 2 x 2 of signs: the bias in β̂2* is
     upward when β3 and δ̃1 share a sign and downward when they do
     not. Rather than reprint the table, this draws it and lights up
     the cell the two sliders put you in — with the arithmetic beside
     it, so the rule can be checked rather than memorised.

     Truth: Y = 20 + 0.6·X2 + β3·X3 + u. Bias(β̂2*) = β3·δ̃1, where δ̃1
     is the slope from regressing the OMITTED X3 on the INCLUDED X2.
     ============================================================ */
  VIZ.register("bias-direction", function (host) {
    var B2 = 0.6, N = 60, b3 = 0.5, rho = 0.6;
    var a = [], b = [], e = [];

    function gauss() {
      var u = 1 - Math.random(), v = Math.random();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    }
    for (var i = 0; i < N; i++) { a.push(gauss()); b.push(gauss()); e.push(gauss()); }

    /* Make b exactly orthogonal to a (Gram-Schmidt), and rescale it to a's
       spread. Without this the SAMPLE correlation differs from the slider's
       value by ~1/√N, so setting the slider to zero would still show a
       visible bias — and "either factor zero kills the bias" is precisely
       what this figure exists to demonstrate. */
    (function orthogonalise() {
      var i, ma = 0, mb = 0;
      for (i = 0; i < N; i++) { ma += a[i]; mb += b[i]; }
      ma /= N; mb /= N;
      for (i = 0; i < N; i++) { a[i] -= ma; b[i] -= mb; }

      var ab = 0, aa = 0;
      for (i = 0; i < N; i++) { ab += a[i] * b[i]; aa += a[i] * a[i]; }
      for (i = 0; i < N; i++) b[i] -= (ab / aa) * a[i];

      var bb = 0;
      for (i = 0; i < N; i++) bb += b[i] * b[i];
      var k = Math.sqrt(aa / bb);
      for (i = 0; i < N; i++) b[i] *= k;
    })();

    /* --- the estimate, on a number line against the truth --- */
    var c = chart({ w: 640, h: 150, pad: { t: 28, r: 24, b: 42, l: 24 },
                    xd: [-0.4, 1.6], yd: [0, 1] });
    var axis = s("line", { x1: c.x(-0.4), y1: c.y(0.42), x2: c.x(1.6), y2: c.y(0.42),
                           stroke: P.ink, "stroke-width": 1 });
    c.plot.appendChild(axis);
    [-0.4, 0, 0.4, 0.6, 0.8, 1.2, 1.6].forEach(function (v) {
      c.plot.appendChild(s("line", { x1: c.x(v), y1: c.y(0.42), x2: c.x(v), y2: c.y(0.36),
                                     stroke: P.inkFaint, "stroke-width": 1 }));
      var t = s("text", { x: c.x(v), y: c.y(0.20), "font-size": 10.5, fill: P.inkFaint,
                          "text-anchor": "middle" });
      t.textContent = v.toFixed(1);
      c.plot.appendChild(t);
    });

    var truthMark = s("line", { x1: c.x(B2), y1: c.y(0.30), x2: c.x(B2), y2: c.y(0.78),
                                stroke: P.accent2, "stroke-width": 2.5 });
    var truthLab = s("text", { x: c.x(B2), y: c.y(0.86), "font-size": 11.5, fill: P.accent2,
                               "text-anchor": "middle" });
    truthLab.textContent = "true β2 = 0.600";
    var arrow = s("line", { stroke: P.accent, "stroke-width": 3 });
    var estMark = s("circle", { r: 6, fill: P.accent });
    var estLab = s("text", { "font-size": 11.5, fill: P.accent, "text-anchor": "middle" });
    c.plot.appendChild(arrow);
    c.plot.appendChild(truthMark);
    c.plot.appendChild(truthLab);
    c.plot.appendChild(estMark);
    c.plot.appendChild(estLab);

    /* --- the deck's Table 1, drawn --- */
    var TW = 640, TH = 150;
    var tbl = s("svg", { viewBox: "0 0 " + TW + " " + TH, preserveAspectRatio: "xMidYMid meet" });
    var CX = [150, 330, 510], CY = [46, 86, 122];
    var cells = {};
    [["pp", 1, 1, "Upward (positive)"], ["pn", 2, 1, "Downward (negative)"],
     ["np", 1, 2, "Downward (negative)"], ["nn", 2, 2, "Upward (positive)"]].forEach(function (d) {
      var g = s("g");
      var box = s("rect", { x: CX[d[1]] - 145, y: CY[d[2]] - 20, width: 290, height: 34,
                            fill: P.paper, stroke: P.rule });
      var t = s("text", { x: CX[d[1]], y: CY[d[2]] + 3, "font-size": 12,
                          fill: P.ink, "text-anchor": "middle" });
      t.textContent = d[3];
      g.appendChild(box); g.appendChild(t);
      tbl.appendChild(g);
      cells[d[0]] = { box: box, text: t };
    });
    function head(x, y, txt, anchor) {
      var t = s("text", { x: x, y: y, "font-size": 11.5, fill: P.inkSoft,
                          "text-anchor": anchor || "middle" });
      t.textContent = txt;
      tbl.appendChild(t);
    }
    head(CX[1], 20, "corr(X₂, X₃) > 0  ⇒  δ̃₁ > 0");
    head(CX[2], 20, "corr(X₂, X₃) < 0  ⇒  δ̃₁ < 0");
    head(24, CY[1] + 3, "β₃ > 0", "start");
    head(24, CY[2] + 3, "β₃ < 0", "start");

    function draw() {
      var x2 = [], x3 = [], y = [], k, mix = Math.sqrt(1 - rho * rho);
      for (k = 0; k < N; k++) {
        var v2 = 50 + 15 * a[k];
        var v3 = 50 + 15 * (rho * a[k] + mix * b[k]);
        x2.push(v2); x3.push(v3);
        y.push(20 + B2 * v2 + b3 * v3 + 1.5 * e[k]);
      }

      var pts = [], d3 = [];
      for (k = 0; k < N; k++) { pts.push({ x: x2[k], y: y[k] }); d3.push({ x: x2[k], y: x3[k] }); }
      var naive = ols(pts);            /* Y on X2 alone — the underfit model */
      var delta = ols(d3);             /* X3 on X2 — this is δ̃1 */
      var bias = naive.b2 - B2;
      var predicted = b3 * delta.b2;

      var shown = Math.max(-0.38, Math.min(1.58, naive.b2));
      estMark.setAttribute("cx", c.x(shown));
      estMark.setAttribute("cy", c.y(0.42));
      estLab.setAttribute("x", c.x(shown));
      estLab.setAttribute("y", c.y(0.06));
      estLab.textContent = "β̂2* = " + naive.b2.toFixed(3);
      arrow.setAttribute("x1", c.x(B2)); arrow.setAttribute("y1", c.y(0.42));
      arrow.setAttribute("x2", c.x(shown)); arrow.setAttribute("y2", c.y(0.42));

      /* light up the cell the sliders put us in — but light NOTHING when
         either factor is zero, since then there is no bias to have a
         direction, which is the point the table exists to make */
      var dead = Math.abs(b3) < 0.03 || Math.abs(delta.b2) < 0.03;
      var key = dead ? null : (b3 >= 0 ? "p" : "n") + (delta.b2 >= 0 ? "p" : "n");
      Object.keys(cells).forEach(function (kk) {
        var on = kk === key;
        cells[kk].box.setAttribute("fill", on ? P.warnBg : P.paper);
        cells[kk].box.setAttribute("stroke", on ? P.accent : P.rule);
        cells[kk].box.setAttribute("stroke-width", on ? 2 : 1);
        cells[kk].text.setAttribute("fill", on ? P.accent : P.inkFaint);
      });

      readout.textContent =
        "β₃ = " + b3.toFixed(2) + "    δ̃₁ = " + delta.b2.toFixed(3) +
        "    β₃δ̃₁ = " + (predicted >= 0 ? "+" : "") + predicted.toFixed(3);
      actual.textContent =
        "actual bias = " + (bias >= 0 ? "+" : "") + bias.toFixed(3) +
        (Math.abs(b3) < 0.03 || Math.abs(delta.b2) < 0.03 ? "    — no bias: one factor is zero" : "");
      c.svg.setAttribute("aria-label",
        "The underfit estimate sits at " + naive.b2.toFixed(3)
        + " against a true value of 0.600.");
    }

    var controls = h("div", "viz-controls");
    var l1 = h("label", null, "β₃ (effect of the omitted X₃)");
    var r1 = document.createElement("input");
    r1.type = "range"; r1.min = "-1"; r1.max = "1"; r1.step = "0.05"; r1.value = "0.5";
    r1.addEventListener("input", function () { b3 = +r1.value; draw(); });
    l1.appendChild(r1);
    controls.appendChild(l1);

    var l2 = h("label", null, "corr(X₂, X₃)");
    var r2 = document.createElement("input");
    r2.type = "range"; r2.min = "-0.9"; r2.max = "0.9"; r2.step = "0.05"; r2.value = "0.6";
    r2.addEventListener("input", function () { rho = +r2.value; draw(); });
    l2.appendChild(r2);
    controls.appendChild(l2);

    var readout = h("span", "viz-readout");
    var actual = h("span", "viz-readout");
    controls.appendChild(readout);
    controls.appendChild(actual);

    host.appendChild(c.svg);
    host.appendChild(tbl);
    host.appendChild(controls);
    host.appendChild(h("p", "viz-caption",
      "Bias(β̂2*) = β₃δ̃₁ — a product of two numbers, so its sign follows the ordinary rule of "
      + "signs, and that is the whole of Table 1. Set either slider to zero and the bias "
      + "vanishes however large the other is: an omitted variable that does not belong in the "
      + "model (β₃ = 0) is harmless, and so is one uncorrelated with what you did include "
      + "(δ̃₁ = 0). Everywhere else there is bias, and the table tells you which way. Note that "
      + "you can usually sign both factors from theory even when you cannot measure the "
      + "omitted variable — which means you can often say which way your estimate is wrong."));

    draw();
  });

  /* ============================================================
     Unit 2A Part 1 — Figure 2: what an irrelevant variable costs

     Overfitting does NOT bias anything — both estimators stay
     centred on the truth. What it costs is precision, by exactly the
     factor 1/(1 − R²23). Two sampling distributions, built from the
     same 300 samples, make the difference visible where a single
     regression cannot.
     ============================================================ */
  VIZ.register("irrelevant-variable-cost", function (host) {
    var B1 = 20, B2 = 0.6, N = 25, RUNS = 300, rho = 0.5;
    var base = [];

    function gauss() {
      var u = 1 - Math.random(), v = Math.random();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    }
    /* held fixed, so the slider changes the correlation and nothing else */
    for (var r = 0; r < RUNS; r++) {
      var A = [], B = [], E = [];
      for (var i = 0; i < N; i++) { A.push(gauss()); B.push(gauss()); E.push(gauss()); }
      base.push({ a: A, b: B, e: E });
    }

    var LO = 0.25, HI = 0.95, BINS = 34;
    var c = chart({ w: 640, h: 330, pad: { t: 22, r: 16, b: 44, l: 44 },
                    xd: [LO, HI], yd: [0, 1] });
    c.axes("estimated slope on X₂", "");

    var barsA = s("g"), barsB = s("g");
    c.plot.appendChild(barsA);
    c.plot.appendChild(barsB);
    var truth = s("line", { x1: c.x(B2), y1: c.y(0), x2: c.x(B2), y2: c.y(0.95),
                            stroke: P.ink, "stroke-width": 2, "stroke-dasharray": "4 3" });
    c.plot.appendChild(truth);
    var tl = s("text", { x: c.x(B2), y: c.y(0.99), "font-size": 11.5, fill: P.ink,
                         "text-anchor": "middle" });
    tl.textContent = "true β2 = 0.600";
    c.plot.appendChild(tl);

    function legend(text, colour, dy) {
      var t = s("text", { x: c.x(LO) + 8, y: dy, "font-size": 11.5, fill: colour });
      t.textContent = text;
      c.plot.appendChild(t);
    }
    legend("correct model:  Y on X₂", P.accent2, 34);
    legend("overfitted:  Y on X₂ and an irrelevant X₃", P.accent, 50);

    function hist(vals, g, colour, up) {
      var counts = new Array(BINS).fill(0), k;
      vals.forEach(function (v) {
        var b = Math.floor((v - LO) / (HI - LO) * BINS);
        if (b >= 0 && b < BINS) counts[b]++;
      });
      var max = Math.max.apply(null, counts) || 1;
      var w = (HI - LO) / BINS;
      while (g.firstChild) g.removeChild(g.firstChild);
      for (k = 0; k < BINS; k++) {
        if (!counts[k]) continue;
        var hgt = 0.42 * counts[k] / max;
        var x0 = LO + k * w;
        g.appendChild(s("rect", {
          x: c.x(x0) + 0.5,
          y: up ? c.y(0.46 + hgt) : c.y(0.44),
          width: Math.max(0.5, c.x(x0 + w) - c.x(x0) - 1),
          height: Math.max(0, c.y(0) - c.y(hgt)),
          fill: colour, opacity: 0.6
        }));
      }
    }

    function sd(v) {
      var m = 0, i;
      for (i = 0; i < v.length; i++) m += v[i];
      m /= v.length;
      var s2 = 0;
      for (i = 0; i < v.length; i++) s2 += (v[i] - m) * (v[i] - m);
      return { m: m, sd: Math.sqrt(s2 / (v.length - 1)) };
    }

    function draw() {
      var simple = [], over = [], mix = Math.sqrt(1 - rho * rho);
      base.forEach(function (B) {
        var x2 = [], x3 = [], y = [], pts = [], i;
        for (i = 0; i < N; i++) {
          var v2 = 50 + 15 * B.a[i];
          var v3 = 50 + 15 * (rho * B.a[i] + mix * B.b[i]);
          /* X3 is genuinely irrelevant: it does NOT appear in the truth */
          var yv = B1 + B2 * v2 + 7 * B.e[i];
          x2.push(v2); x3.push(v3); y.push(yv);
          pts.push({ x: v2, y: yv });
        }
        simple.push(ols(pts).b2);
        over.push(ols3(x2, x3, y).b2);
      });

      hist(simple, barsA, P.accent2, true);
      hist(over, barsB, P.accent, false);

      var a = sd(simple), b = sd(over);
      readout.textContent =
        "R₂₃ = " + rho.toFixed(2) +
        "    sd(β̂₂) = " + a.sd.toFixed(3) +
        "    sd(α̂₂) = " + b.sd.toFixed(3);
      ratio.textContent =
        "ratio " + (b.sd / a.sd).toFixed(2) +
        "    theory √(1/(1 − R₂₃²)) = " + Math.sqrt(1 / (1 - rho * rho)).toFixed(2);
      c.svg.setAttribute("aria-label",
        "Two sampling distributions of the slope on X2, both centred on 0.600; the overfitted "
        + "one is wider by a factor of " + (b.sd / a.sd).toFixed(2) + ".");
    }

    var controls = h("div", "viz-controls");
    var lab = h("label", null, "R₂₃ — correlation with the irrelevant X₃");
    var rng = document.createElement("input");
    rng.type = "range"; rng.min = "0"; rng.max = "0.95"; rng.step = "0.05"; rng.value = "0.5";
    rng.addEventListener("input", function () { rho = +rng.value; draw(); });
    lab.appendChild(rng);
    controls.appendChild(lab);
    var readout = h("span", "viz-readout");
    var ratio = h("span", "viz-readout");
    controls.appendChild(readout);
    controls.appendChild(ratio);

    host.appendChild(c.svg);
    host.appendChild(controls);
    host.appendChild(h("p", "viz-caption",
      "Three hundred samples from a world where X₃ genuinely does not belong. Both histograms "
      + "sit on 0.600 at every setting of the slider — including an irrelevant variable costs "
      + "you no bias at all, which is exactly why the temptation to throw everything in is so "
      + "strong. What it costs is spread. Push R₂₃ towards 0.95 and the overfitted "
      + "distribution fans out while the correct one does not move, and the measured ratio "
      + "tracks the theoretical √(1/(1 − R₂₃²)). A wider sampling distribution means larger "
      + "standard errors, smaller t-statistics, and real effects you can no longer detect."));

    draw();
  });

  /* ============================================================
     Unit 2A Part 1 — Figure 3: the residual plot that gives it away

     "If a variable is missing, we are likely to see some pattern in
     the residuals." That is the informal detection method, and it is
     also the intuition behind RESET — so it is worth seeing what the
     pattern actually looks like.
     ============================================================ */
  VIZ.register("omitted-residual-pattern", function (host) {
    var B1 = 20, B2 = 0.6, B3 = 0.9, N = 45, omit = true;
    var x2 = [], x3 = [], y = [];

    function gauss() {
      var u = 1 - Math.random(), v = Math.random();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    }
    for (var i = 0; i < N; i++) {
      var v2 = 50 + 15 * gauss();
      var v3 = 50 + 15 * gauss();
      x2.push(v2); x3.push(v3);
      y.push(B1 + B2 * v2 + B3 * v3 + 4 * gauss());
    }

    var c = chart({ w: 640, h: 320, xd: [10, 90], yd: [-32, 32] });
    c.axes("the omitted variable  X₃", "residual  û");
    var zero = s("line", { x1: c.x(10), y1: c.y(0), x2: c.x(90), y2: c.y(0),
                           stroke: P.ink, "stroke-width": 1, "stroke-dasharray": "4 3" });
    var trend = s("line", { stroke: P.accent, "stroke-width": 2.5 });
    var dots = s("g");
    c.plot.appendChild(zero);
    c.plot.appendChild(trend);
    c.plot.appendChild(dots);

    function draw() {
      var res = [], i, k;
      if (omit) {
        var pts = [];
        for (i = 0; i < N; i++) pts.push({ x: x2[i], y: y[i] });
        var f = ols(pts);
        for (i = 0; i < N; i++) res.push(y[i] - (f.b1 + f.b2 * x2[i]));
      } else {
        var f3 = ols3(x2, x3, y);
        for (i = 0; i < N; i++) res.push(y[i] - (f3.b1 + f3.b2 * x2[i] + f3.b3 * x3[i]));
      }

      while (dots.firstChild) dots.removeChild(dots.firstChild);
      var rp = [];
      for (k = 0; k < N; k++) {
        rp.push({ x: x3[k], y: res[k] });
        dots.appendChild(s("circle", {
          cx: c.x(Math.max(10, Math.min(90, x3[k]))),
          cy: c.y(Math.max(-31, Math.min(31, res[k]))),
          r: 4, fill: res[k] >= 0 ? P.accent : P.accent2
        }));
      }
      var t = ols(rp);
      trend.setAttribute("x1", c.x(10)); trend.setAttribute("y1", c.y(t.b1 + t.b2 * 10));
      trend.setAttribute("x2", c.x(90)); trend.setAttribute("y2", c.y(t.b1 + t.b2 * 90));

      readout.textContent = omit
        ? "X₃ omitted — slope of û on X₃ = " + t.b2.toFixed(3)
        : "X₃ included — slope of û on X₃ = " + t.b2.toFixed(3);
      note.textContent = omit
        ? "the residuals still carry X₃'s effect"
        : "no pattern left to find";
      note.style.color = omit ? P.accent : P.good;
      c.svg.setAttribute("aria-label",
        "Residuals plotted against the omitted variable, with X3 "
        + (omit ? "omitted" : "included") + "; the fitted slope is " + t.b2.toFixed(3) + ".");
    }

    var controls = h("div", "viz-controls");
    var tog = h("button", null, "Put X₃ back in the model");
    tog.addEventListener("click", function () {
      omit = !omit;
      tog.textContent = omit ? "Put X₃ back in the model" : "Omit X₃ again";
      draw();
    });
    controls.appendChild(tog);
    var readout = h("span", "viz-readout");
    var note = h("span", "viz-readout");
    controls.appendChild(readout);
    controls.appendChild(note);

    host.appendChild(c.svg);
    host.appendChild(controls);
    host.appendChild(h("p", "viz-caption",
      "With X₃ left out, its effect has nowhere to go but the residuals — so plotting them "
      + "against X₃ shows a clear upward slope, and E(u | X) = 0 has plainly failed. Put X₃ "
      + "back and the pattern disappears completely. The catch is the one that makes omitted "
      + "variable bias hard to detect in practice: this plot needs the omitted variable, and "
      + "if you had it you would have included it. What you can actually plot is û against "
      + "the variables you DO have and against Ŷ — which is precisely what RESET automates, "
      + "by asking whether powers of Ŷ can add anything the model has missed."));

    draw();
  });

  /* ============================================================
     Unit 2A Part 2 — Figure 1: the harm in suppressing the constant

     The deck has a slide titled "The Harmful Effect of Suppressing
     the Constant Term" carrying a picture. This is that picture, with
     the constant switchable, so the damage can be watched rather than
     described: forcing the line through the origin tilts the slope,
     and the residuals stop summing to zero.
     ============================================================ */
  VIZ.register("suppressed-constant", function (host) {
    var B1 = 34, B2 = 0.42, N = 18, useConst = true;
    var pts = [];

    function gauss() {
      var u = 1 - Math.random(), v = Math.random();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    }
    for (var i = 0; i < N; i++) {
      var xv = 30 + i * (55 / (N - 1));
      pts.push({ x: xv, y: B1 + B2 * xv + 4 * gauss() });
    }

    var c = chart({ w: 640, h: 380, xd: [0, 95], yd: [0, 80] });
    c.axes("Output  Q", "Total cost  C");

    var line = s("line", { stroke: P.accent, "stroke-width": 2.5 });
    var drops = s("g");
    var dots = s("g");
    c.plot.appendChild(line);
    c.plot.appendChild(drops);
    c.plot.appendChild(dots);
    pts.forEach(function (p) {
      dots.appendChild(s("circle", { cx: c.x(p.x), cy: c.y(p.y), r: 4, fill: P.ink }));
    });

    var origin = s("circle", { cx: c.x(0), cy: c.y(0), r: 5, fill: "none",
                               stroke: P.accent2, "stroke-width": 2 });
    c.plot.appendChild(origin);

    function draw() {
      var b1, b2, i, num = 0, den = 0;
      if (useConst) {
        var f = ols(pts);
        b1 = f.b1; b2 = f.b2;
      } else {
        /* regression through the origin: minimise Σ(Y − bX)² */
        for (i = 0; i < N; i++) { num += pts[i].x * pts[i].y; den += pts[i].x * pts[i].x; }
        b1 = 0; b2 = num / den;
      }

      line.setAttribute("x1", c.x(0));  line.setAttribute("y1", c.y(b1));
      line.setAttribute("x2", c.x(95)); line.setAttribute("y2", c.y(b1 + b2 * 95));

      while (drops.firstChild) drops.removeChild(drops.firstChild);
      var sumRes = 0, rss = 0;
      pts.forEach(function (p) {
        var e = p.y - (b1 + b2 * p.x);
        sumRes += e; rss += e * e;
        drops.appendChild(s("line", {
          x1: c.x(p.x), y1: c.y(p.y), x2: c.x(p.x), y2: c.y(b1 + b2 * p.x),
          stroke: P.accent, "stroke-width": 1, "stroke-dasharray": "3 3", opacity: 0.65
        }));
      });

      origin.setAttribute("opacity", useConst ? 0.3 : 1);
      readout.textContent =
        (useConst ? "with a constant:  " : "constant suppressed:  ") +
        "β̂1 = " + b1.toFixed(2) + "    β̂2 = " + b2.toFixed(3) +
        "    (true 34.00 and 0.420)";
      resid.textContent = "Σû = " + sumRes.toFixed(2) + "    Σû² = " + rss.toFixed(1);
      resid.style.color = Math.abs(sumRes) > 0.5 ? P.accent : P.good;
      c.svg.setAttribute("aria-label",
        "Cost against output, fitted " + (useConst ? "with" : "without")
        + " an intercept; the slope is " + b2.toFixed(3) + ".");
    }

    var controls = h("div", "viz-controls");
    var tog = h("button", null, "Suppress the constant");
    tog.addEventListener("click", function () {
      useConst = !useConst;
      tog.textContent = useConst ? "Suppress the constant" : "Put the constant back";
      draw();
    });
    controls.appendChild(tog);
    var readout = h("span", "viz-readout");
    var resid = h("span", "viz-readout");
    controls.appendChild(readout);
    controls.appendChild(resid);

    host.appendChild(c.svg);
    host.appendChild(controls);
    host.appendChild(h("p", "viz-caption",
      "The true relationship has fixed costs of 34: at zero output there is still a bill to "
      + "pay. Suppress the constant and the line is dragged through the origin, so the only "
      + "way it can reach the data is by tilting — the slope inflates well above 0.420, and "
      + "the marginal cost you would report is simply wrong. Watch Σû as you switch: with a "
      + "constant it is zero by construction, which is what guarantees E(u) = 0. Without one "
      + "it is not, and the intercept's job has been forced onto the slope coefficient."));

    draw();
  });

  /* ============================================================
     Unit 2A Part 2 — Figure 2: the four functional forms

     One dataset, four specifications, drawn back in the Y–X plane so
     the shapes are comparable, with the interpretation of β̂2 shown
     for each — because the interpretation is the whole reason for
     choosing between them.

     The truth here is multiplicative, Y = 3·X^0.6·e^u, so the
     double-log is the correct specification and the others are all
     wrong in instructive ways.
     ============================================================ */
  VIZ.register("functional-forms", function (host) {
    var N = 40, form = "linear";
    var xs = [], ys = [];

    function gauss() {
      var u = 1 - Math.random(), v = Math.random();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    }
    for (var i = 0; i < N; i++) {
      var xv = 5 + i * (90 / (N - 1));
      xs.push(xv);
      ys.push(3 * Math.pow(xv, 0.6) * Math.exp(0.10 * gauss()));
    }

    var c = chart({ w: 640, h: 360, xd: [0, 100], yd: [0, 60] });
    c.axes("X", "Y");
    var curve = s("path", { fill: "none", stroke: P.accent, "stroke-width": 2.5 });
    var dots = s("g");
    c.plot.appendChild(curve);
    c.plot.appendChild(dots);
    for (i = 0; i < N; i++) {
      dots.appendChild(s("circle", { cx: c.x(xs[i]), cy: c.y(ys[i]), r: 3.6, fill: P.ink }));
    }

    var FORMS = {
      linear: {
        label: "linear",
        eqn: "Y = β1 + β2X + u",
        fit: function () {
          var p = [], k;
          for (k = 0; k < N; k++) p.push({ x: xs[k], y: ys[k] });
          var f = ols(p);
          return { b1: f.b1, b2: f.b2, at: function (x) { return f.b1 + f.b2 * x; } };
        },
        say: function (b2) {
          return "a 1-unit rise in X raises Y by " + b2.toFixed(3) + " units";
        }
      },
      doublelog: {
        label: "double-log",
        eqn: "ln Y = β1 + β2 ln X + u",
        fit: function () {
          var p = [], k;
          for (k = 0; k < N; k++) p.push({ x: Math.log(xs[k]), y: Math.log(ys[k]) });
          var f = ols(p);
          return { b1: f.b1, b2: f.b2,
                   at: function (x) { return Math.exp(f.b1 + f.b2 * Math.log(x)); } };
        },
        say: function (b2) {
          return "a 1% rise in X raises Y by " + b2.toFixed(3) + "% — an elasticity";
        }
      },
      loglin: {
        label: "semi-log 1  (log–lin)",
        eqn: "ln Y = β1 + β2X + u",
        fit: function () {
          var p = [], k;
          for (k = 0; k < N; k++) p.push({ x: xs[k], y: Math.log(ys[k]) });
          var f = ols(p);
          return { b1: f.b1, b2: f.b2,
                   at: function (x) { return Math.exp(f.b1 + f.b2 * x); } };
        },
        say: function (b2) {
          return "a 1-unit rise in X raises Y by about " + (100 * b2).toFixed(2)
               + "% (exactly " + (100 * (Math.exp(b2) - 1)).toFixed(2) + "%)";
        }
      },
      linlog: {
        label: "semi-log 2  (lin–log)",
        eqn: "Y = β1 + β2 ln X + u",
        fit: function () {
          var p = [], k;
          for (k = 0; k < N; k++) p.push({ x: Math.log(xs[k]), y: ys[k] });
          var f = ols(p);
          return { b1: f.b1, b2: f.b2,
                   at: function (x) { return f.b1 + f.b2 * Math.log(x); } };
        },
        say: function (b2) {
          return "a 1% rise in X raises Y by " + (b2 / 100).toFixed(4) + " units";
        }
      }
    };

    function draw() {
      var F = FORMS[form], f = F.fit(), d = "", k, xv, yv;
      for (k = 0; k <= 200; k++) {
        xv = 1 + 99 * k / 200;
        yv = f.at(xv);
        if (!isFinite(yv)) continue;
        yv = Math.max(-5, Math.min(65, yv));
        d += (d ? "L" : "M") + c.x(xv) + " " + c.y(yv);
      }
      curve.setAttribute("d", d || "M0 0");

      eqnOut.textContent = F.eqn + "     β̂2 = " + f.b2.toFixed(4);
      sayOut.textContent = F.say(f.b2);
      c.svg.setAttribute("aria-label",
        "Data generated by a multiplicative relationship, fitted by the "
        + F.label + " form.");
    }

    var controls = h("div", "viz-controls");
    var lab = h("label", null, "form");
    var buttons = {};
    ["linear", "doublelog", "loglin", "linlog"].forEach(function (kk) {
      var b = h("button", null, FORMS[kk].label);
      b.addEventListener("click", function () {
        form = kk;
        Object.keys(buttons).forEach(function (q) { buttons[q].style.borderColor = ""; });
        b.style.borderColor = P.accent;
        draw();
      });
      buttons[kk] = b;
      lab.appendChild(b);
    });
    controls.appendChild(lab);
    var eqnOut = h("span", "viz-readout");
    var sayOut = h("span", "viz-readout");
    controls.appendChild(eqnOut);
    controls.appendChild(sayOut);

    host.appendChild(c.svg);
    host.appendChild(controls);
    host.appendChild(h("p", "viz-caption",
      "The same forty observations, four times over. The truth here is multiplicative — "
      + "Y = 3·X^0.6·e^u — so the double-log is the correctly specified one, and it recovers "
      + "an elasticity of about 0.6. Read the sentence under each form as you switch: the "
      + "choice of form is a choice about what the coefficient MEANS, not just about the shape "
      + "of a curve. The linear form forces a straight line through curved data and its slope "
      + "answers a question nobody asked. One warning: do not pick between these on R², "
      + "because the forms with ln Y have a different dependent variable, and an R² computed "
      + "on ln Y is not comparable with one computed on Y."));

    buttons.linear.style.borderColor = P.accent;
    draw();
  });

  /* ============================================================
     Unit 2A Part 2 — Figure 3: quadratics and the turning point

     "How would we use the regression output to find the value of X
     that gives the max or min?" — the deck asks and moves on. Setting
     the derivative to zero gives X* = −β2 / 2β3, and the sign of β3
     decides whether that point is a peak or a trough.
     ============================================================ */
  VIZ.register("quadratic-turning-point", function (host) {
    var B1 = 10, B2 = 1.6, b3 = -0.024;

    var c = chart({ w: 640, h: 340, xd: [0, 70], yd: [-30, 70] });
    c.axes("X", "Y");
    /* the y = 0 line, so the U case reads properly */
    c.plot.appendChild(s("line", { x1: c.x(0), y1: c.y(0), x2: c.x(70), y2: c.y(0),
                                   stroke: P.ruleSoft, "stroke-width": 1 }));

    var curve = s("path", { fill: "none", stroke: P.accent, "stroke-width": 2.5 });
    var vline = s("line", { stroke: P.accent2, "stroke-width": 2, "stroke-dasharray": "5 3" });
    var star = s("circle", { r: 5.5, fill: P.accent2 });
    var slab = s("text", { "font-size": 11.5, fill: P.accent2, "text-anchor": "middle" });
    c.plot.appendChild(curve);
    c.plot.appendChild(vline);
    c.plot.appendChild(star);
    c.plot.appendChild(slab);

    function draw() {
      var d = "", k, xv, yv;
      for (k = 0; k <= 200; k++) {
        xv = 70 * k / 200;
        yv = B1 + B2 * xv + b3 * xv * xv;
        d += (k ? "L" : "M") + c.x(xv) + " " + c.y(Math.max(-32, Math.min(72, yv)));
      }
      curve.setAttribute("d", d);

      var flat = Math.abs(b3) < 0.0015;
      var xstar = flat ? null : -B2 / (2 * b3);
      var inRange = xstar !== null && xstar > 0 && xstar < 70;

      vline.setAttribute("opacity", inRange ? 1 : 0);
      star.setAttribute("opacity", inRange ? 1 : 0);
      slab.setAttribute("opacity", inRange ? 1 : 0);
      if (inRange) {
        var ystar = B1 + B2 * xstar + b3 * xstar * xstar;
        var ys = Math.max(-30, Math.min(68, ystar));
        vline.setAttribute("x1", c.x(xstar)); vline.setAttribute("y1", c.y(-30));
        vline.setAttribute("x2", c.x(xstar)); vline.setAttribute("y2", c.y(ys));
        star.setAttribute("cx", c.x(xstar));
        star.setAttribute("cy", c.y(ys));
        slab.setAttribute("x", c.x(xstar));
        slab.setAttribute("y", c.y(ys) + (b3 < 0 ? -12 : 20));
        slab.textContent = "X* = " + xstar.toFixed(1);
      }

      readout.textContent =
        "β̂2 = " + B2.toFixed(2) + "    β̂3 = " + b3.toFixed(4) +
        (flat ? "    — no curvature, the form is linear"
              : "    X* = −β̂2/2β̂3 = " + xstar.toFixed(1));
      shape.textContent = flat ? "the quadratic term is doing nothing"
        : !inRange ? (b3 < 0 ? "inverted U, but X* lies outside the data"
                             : "U-shaped, but X* lies outside the data")
        : b3 < 0 ? "inverted U — rises, then falls: X* is a MAXIMUM"
                 : "U-shaped — falls, then rises: X* is a MINIMUM";
      shape.style.color = b3 < 0 ? P.accent : P.accent2;
      c.svg.setAttribute("aria-label",
        "A quadratic with squared coefficient " + b3.toFixed(4)
        + (inRange ? ", turning at X = " + xstar.toFixed(1) : ", with no turning point in range"));
    }

    var controls = h("div", "viz-controls");
    var lab2 = h("label", null, "β̂2 — coefficient on X");
    var rng2 = document.createElement("input");
    rng2.type = "range"; rng2.min = "-2"; rng2.max = "2"; rng2.step = "0.1"; rng2.value = "1.6";
    rng2.addEventListener("input", function () { B2 = +rng2.value; draw(); });
    lab2.appendChild(rng2);
    controls.appendChild(lab2);

    var lab = h("label", null, "β̂3 — coefficient on X²");
    var rng = document.createElement("input");
    rng.type = "range"; rng.min = "-0.05"; rng.max = "0.05"; rng.step = "0.002"; rng.value = "-0.024";
    rng.addEventListener("input", function () { b3 = +rng.value; draw(); });
    lab.appendChild(rng);
    controls.appendChild(lab);
    var readout = h("span", "viz-readout");
    var shape = h("span", "viz-readout");
    controls.appendChild(readout);
    controls.appendChild(shape);

    host.appendChild(c.svg);
    host.appendChild(controls);
    host.appendChild(h("p", "viz-caption",
      "With X² in the model the effect of X is no longer one number: dY/dX = β̂2 + 2β̂3X, so it "
      + "depends on where you stand. Setting that to zero gives X* = −β̂2/2β̂3, marked on the "
      + "curve. A negative β̂3 gives the inverted U of the Mincer wage equation — returns to "
      + "experience that rise and then flatten off; flip β̂2 negative with β̂3 positive and you "
      + "get the U. Slide β̂3 through zero and the curvature "
      + "vanishes: at exactly zero the quadratic term is doing nothing and the specification "
      + "collapses to the linear one, which is why testing H₀: β3 = 0 is a test of whether the "
      + "curvature belongs. Always check X* falls inside the range of your data — a turning "
      + "point at 90 years of experience is arithmetic, not economics."));

    draw();
  });

  /* ============================================================
     Unit 2A Part 2 — Figure 4: the Chow test

     Household consumption, quarterly 1992–2016, with a break at
     2008 — 64 observations before, 36 after, exactly the deck's
     example. The slider moves the post-break regime; the F statistic
     and the decision follow.

     Degrees of freedom are fixed here (k = 2, n2 + n3 − 2k = 96), so
     the 5% critical value F(2, 96) = 3.09 is read once from the
     tables rather than recomputed.
     ============================================================ */
  VIZ.register("chow-break", function (host) {
    var N1 = 64, N2 = 36, K = 2, FCRIT = 3.09;
    var D1 = 20, D2 = 0.62;          /* pre-2008 regime */
    var shift = 0.0;                  /* how far the post-2008 regime moves */
    var xs = [], e = [];

    function gauss() {
      var u = 1 - Math.random(), v = Math.random();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    }
    for (var i = 0; i < N1 + N2; i++) {
      xs.push(20 + (i / (N1 + N2 - 1)) * 70 + 3 * gauss());
      e.push(gauss());
    }

    var c = chart({ w: 640, h: 380, xd: [10, 100], yd: [10, 100] });
    c.axes("Income  Y", "Consumption  C");

    var pooled = s("line", { stroke: P.ink, "stroke-width": 2.5, "stroke-dasharray": "6 4" });
    var lPre = s("line", { stroke: P.accent2, "stroke-width": 2.5 });
    var lPost = s("line", { stroke: P.accent, "stroke-width": 2.5 });
    var dots = s("g");
    c.plot.appendChild(pooled);
    c.plot.appendChild(lPre);
    c.plot.appendChild(lPost);
    c.plot.appendChild(dots);

    function legend(text, colour, dy, dash) {
      var g = s("g");
      g.appendChild(s("line", { x1: c.x(13), y1: dy, x2: c.x(21), y2: dy,
                                stroke: colour, "stroke-width": 2.5, "stroke-dasharray": dash }));
      var t = s("text", { x: c.x(23), y: dy + 4, "font-size": 11.5, fill: colour });
      t.textContent = text;
      g.appendChild(t);
      c.plot.appendChild(g);
    }
    legend("pooled — the restricted model", P.ink, 22, "6 4");
    legend("1992–2007", P.accent2, 40, null);
    legend("2008–2016", P.accent, 58, null);

    function fitRss(pts) {
      var f = ols(pts);
      return { b1: f.b1, b2: f.b2, rss: f.rss };
    }

    function draw() {
      var pre = [], post = [], all = [], i;
      for (i = 0; i < N1; i++) {
        var y1 = D1 + D2 * xs[i] + 3.2 * e[i];
        pre.push({ x: xs[i], y: y1 });
        all.push({ x: xs[i], y: y1 });
      }
      for (i = N1; i < N1 + N2; i++) {
        /* the break moves both the intercept and the slope */
        var y2 = (D1 + 14 * shift) + (D2 - 0.34 * shift) * xs[i] + 3.2 * e[i];
        post.push({ x: xs[i], y: y2 });
        all.push({ x: xs[i], y: y2 });
      }

      while (dots.firstChild) dots.removeChild(dots.firstChild);
      pre.forEach(function (p) {
        dots.appendChild(s("circle", { cx: c.x(p.x), cy: c.y(p.y), r: 3.4, fill: P.accent2 }));
      });
      post.forEach(function (p) {
        dots.appendChild(s("circle", { cx: c.x(p.x), cy: c.y(p.y), r: 3.4, fill: P.accent }));
      });

      var R = fitRss(all), A = fitRss(pre), B = fitRss(post);
      pooled.setAttribute("x1", c.x(10)); pooled.setAttribute("y1", c.y(R.b1 + R.b2 * 10));
      pooled.setAttribute("x2", c.x(100)); pooled.setAttribute("y2", c.y(R.b1 + R.b2 * 100));
      lPre.setAttribute("x1", c.x(10)); lPre.setAttribute("y1", c.y(A.b1 + A.b2 * 10));
      lPre.setAttribute("x2", c.x(100)); lPre.setAttribute("y2", c.y(A.b1 + A.b2 * 100));
      lPost.setAttribute("x1", c.x(10)); lPost.setAttribute("y1", c.y(B.b1 + B.b2 * 10));
      lPost.setAttribute("x2", c.x(100)); lPost.setAttribute("y2", c.y(B.b1 + B.b2 * 100));

      var rssUR = A.rss + B.rss;
      var F = ((R.rss - rssUR) / K) / (rssUR / (N1 + N2 - 2 * K));

      readout.textContent =
        "RSS_R = " + R.rss.toFixed(0) +
        "    RSS_UR = " + rssUR.toFixed(0) +
        "    F = " + F.toFixed(2);
      verdict.textContent = F > FCRIT
        ? "F > 3.09 — reject: the parameters are not stable"
        : "F < 3.09 — do not reject: no evidence of a break";
      verdict.style.color = F > FCRIT ? P.accent : P.good;
      c.svg.setAttribute("aria-label",
        "Consumption against income in two periods, with pooled and separate fitted lines; "
        + "the Chow F statistic is " + F.toFixed(2) + ".");
    }

    var controls = h("div", "viz-controls");
    var lab = h("label", null, "size of the structural break");
    var rng = document.createElement("input");
    rng.type = "range"; rng.min = "0"; rng.max = "1"; rng.step = "0.02"; rng.value = "0";
    rng.addEventListener("input", function () { shift = +rng.value; draw(); });
    lab.appendChild(rng);
    controls.appendChild(lab);
    var readout = h("span", "viz-readout");
    var verdict = h("span", "viz-readout");
    controls.appendChild(readout);
    controls.appendChild(verdict);

    host.appendChild(c.svg);
    host.appendChild(controls);
    host.appendChild(h("p", "viz-caption",
      "Sixty-four quarters before 2008 and thirty-six after, as in the lecture example. At a "
      + "break of zero the two regime lines sit on top of the pooled one, RSS_R and RSS_UR are "
      + "nearly equal, and F is small — splitting the sample bought nothing. Slide the break "
      + "up and the regimes separate: the pooled line now fits neither period well, RSS_R "
      + "pulls away from RSS_UR, and F climbs past the 5% critical value F(2, 96) = 3.09. "
      + "Note what the test does not tell you. A rejection says the parameters differ, not "
      + "whether it is the intercept, the slope, or both — and the break date has to be known "
      + "in advance, since here it was simply asserted to be 2008."));

    draw();
  });

  /* ============================================================
     Unit 2B — Figure 1: perfect collinearity leaves a LINE of answers

     The algebra says β̂2 comes out 0/0. This is what that means when
     you are holding the data. With X3 = 2X2 exactly, every pair
     (β̂2, β̂3) satisfying β̂2 + 2β̂3 = c fits the sample identically —
     same fitted values, same residuals, same RSS to the last decimal.
     OLS does not have a hard time choosing; it has nothing to choose
     between.

     The deviates are written out rather than drawn at load, so the
     numbers a student reads are the numbers anyone else reads.
     ============================================================ */
  VIZ.register("perfect-collinearity-ridge", function (host) {
    var A2 = 2;                                  /* X3 = 2·X2, exactly */
    var E = [3.1, -2.4, 1.8, -0.6, 4.2, -3.3, 0.9, 2.7, -1.5, -4.0,
             2.2, -0.8, 3.6, -2.9, 1.1, 0.4, -3.7, 2.0, -1.2, 1.6];
    var X2 = [], X3 = [], Y = [], pts = [], i;
    for (i = 0; i < E.length; i++) {
      var v2 = 10 + i;
      X2.push(v2);
      X3.push(A2 * v2);
      Y.push(5 + 3 * v2 + E[i]);
      pts.push({ x: v2, y: 5 + 3 * v2 + E[i] });
    }

    /* The one thing the sample identifies: the combined effect of a
       one-unit rise in X2, which drags X3 up by A2 alongside it. */
    var C = ols(pts).b2;
    var d = 0;                                   /* how far along the ridge */

    var c = chart({ w: 640, h: 340, pad: { t: 24, r: 20, b: 46, l: 54 },
                    xd: [C - 3, C + 3], yd: [-1.7, 1.7] });
    c.axes("β̂₂ — the coefficient on X₂", "β̂₃ — on X₃");

    /* the ridge itself: β̂3 = (C − β̂2) / A2 */
    function b3of(b2) { return (C - b2) / A2; }
    c.plot.appendChild(s("line", {
      x1: c.x(C - 3), y1: c.y(b3of(C - 3)), x2: c.x(C + 3), y2: c.y(b3of(C + 3)),
      stroke: P.accent, "stroke-width": 2.5
    }));
    c.plot.appendChild(s("line", {
      x1: c.x(C - 3), y1: c.y(0), x2: c.x(C + 3), y2: c.y(0),
      stroke: P.ruleSoft, "stroke-width": 1, "stroke-dasharray": "3 3"
    }));

    var note = s("text", { x: c.x(C - 3) + 10, y: c.y(-1.4),
                           "font-size": 11.5, fill: P.accent });
    note.textContent = "every point on this line fits the sample identically";
    c.plot.appendChild(note);

    var dot = s("circle", { r: 6, fill: P.accent2, stroke: P.paper, "stroke-width": 1.5 });
    c.plot.appendChild(dot);

    function draw() {
      var b2 = C + d, b3 = b3of(b2), m2 = 0, m3 = 0, my = 0, k;
      for (k = 0; k < X2.length; k++) { m2 += X2[k]; m3 += X3[k]; my += Y[k]; }
      m2 /= X2.length; m3 /= X3.length; my /= Y.length;
      var b1 = my - b2 * m2 - b3 * m3;

      /* recomputed from scratch every time, so the invariance is shown
         rather than asserted */
      var rss = 0;
      for (k = 0; k < X2.length; k++) {
        var e = Y[k] - (b1 + b2 * X2[k] + b3 * X3[k]);
        rss += e * e;
      }

      dot.setAttribute("cx", c.x(b2));
      dot.setAttribute("cy", c.y(b3));

      coefs.textContent = "β̂₁ = " + b1.toFixed(3)
                        + "    β̂₂ = " + b2.toFixed(3)
                        + "    β̂₃ = " + b3.toFixed(3);
      fixed.textContent = "β̂₂ + 2β̂₃ = " + (b2 + A2 * b3).toFixed(4)
                        + "    RSS = " + rss.toFixed(6);
      c.svg.setAttribute("aria-label",
        "A downward-sloping line of admissible coefficient pairs; the marked pair is "
        + "β̂2 = " + b2.toFixed(2) + ", β̂3 = " + b3.toFixed(2) + ".");
    }

    var controls = h("div", "viz-controls");
    var lab = h("label", null, "slide β̂₂ anywhere along the ridge");
    var rng = document.createElement("input");
    rng.type = "range"; rng.min = "-3"; rng.max = "3"; rng.step = "0.05"; rng.value = "0";
    rng.addEventListener("input", function () { d = +rng.value; draw(); });
    lab.appendChild(rng);
    controls.appendChild(lab);
    var coefs = h("span", "viz-readout");
    var fixed = h("span", "viz-readout");
    controls.appendChild(coefs);
    controls.appendChild(fixed);

    host.appendChild(c.svg);
    host.appendChild(controls);
    host.appendChild(h("p", "viz-caption",
      "Twenty observations in which X₃ is exactly twice X₂. The axes are not the data — they "
      + "are the two coefficients, and the line is the set of answers OLS cannot choose "
      + "between. Move the slider: β̂₂ swings from strongly negative to strongly positive, "
      + "β̂₃ moves the opposite way to compensate, and the sum β̂₂ + 2β̂₃ and the residual sum "
      + "of squares do not budge in the sixth decimal place. The intercept does not move "
      + "either. This is the 0/0 of the algebra seen from the other side: the data pin down "
      + "the combined effect and say nothing whatever about the split."));

    draw();
  });

  /* ============================================================
     Unit 2B — Figure 2: what the variance inflation factor inflates

     VIF = 1/(1 − R²j) is exact, so this figure is drawn from the
     formula rather than simulated. The number worth carrying away is
     not VIF but its square root, which is the factor the standard
     error is multiplied by — and therefore the factor the t-ratio is
     divided by.
     ============================================================ */
  VIZ.register("vif-curve", function (host) {
    var LO = 0, HI = 0.95, YMAX = 20, CLEAN_T = 4;
    var r2 = 0.5;

    var c = chart({ w: 640, h: 340, pad: { t: 20, r: 20, b: 46, l: 54 },
                    xd: [LO, HI], yd: [0, YMAX] });
    c.axes("R²ⱼ — fit of the auxiliary regression of Xⱼ on the other regressors", "VIF");

    /* rule of thumb: VIF = 10, which is R²j = 0.9 */
    c.plot.appendChild(s("line", { x1: c.x(LO), y1: c.y(10), x2: c.x(HI), y2: c.y(10),
                                   stroke: P.inkFaint, "stroke-width": 1,
                                   "stroke-dasharray": "4 3" }));
    c.plot.appendChild(s("line", { x1: c.x(0.9), y1: c.y(0), x2: c.x(0.9), y2: c.y(YMAX),
                                   stroke: P.inkFaint, "stroke-width": 1,
                                   "stroke-dasharray": "4 3" }));
    var rt = s("text", { x: c.x(LO) + 8, y: c.y(10) - 6, "font-size": 11.5, fill: P.inkSoft });
    rt.textContent = "VIF = 10 — the usual rule of thumb, reached at R²ⱼ = 0.9";
    c.plot.appendChild(rt);

    var pathD = "", k;
    for (k = 0; k <= 240; k++) {
      var v = LO + (HI - LO) * k / 240;
      var vif = 1 / (1 - v);
      pathD += (k ? " L " : "M ") + c.x(v) + " " + c.y(Math.min(vif, YMAX));
    }
    c.plot.appendChild(s("path", { d: pathD, fill: "none",
                                   stroke: P.accent, "stroke-width": 2.5 }));

    var dot = s("circle", { r: 6, fill: P.accent2, stroke: P.paper, "stroke-width": 1.5 });
    c.plot.appendChild(dot);

    function draw() {
      var vif = 1 / (1 - r2), root = Math.sqrt(vif);
      dot.setAttribute("cx", c.x(r2));
      dot.setAttribute("cy", c.y(Math.min(vif, YMAX)));
      left.textContent = "R²ⱼ = " + r2.toFixed(2)
                       + "    VIF = " + vif.toFixed(2)
                       + "    √VIF = " + root.toFixed(2);
      right.textContent = "a t-ratio of " + CLEAN_T.toFixed(2)
                        + " with no collinearity becomes t = " + (CLEAN_T / root).toFixed(2)
                        + (CLEAN_T / root < 2 ? "  — no longer significant" : "");
      c.svg.setAttribute("aria-label",
        "The variance inflation factor rising steeply towards infinity as the auxiliary "
        + "R-squared approaches one; at R-squared " + r2.toFixed(2) + " it is "
        + vif.toFixed(2) + ".");
    }

    var controls = h("div", "viz-controls");
    var lab = h("label", null, "R²ⱼ — how well the other regressors explain Xⱼ");
    var rng = document.createElement("input");
    rng.type = "range"; rng.min = "0"; rng.max = "0.95"; rng.step = "0.01"; rng.value = "0.5";
    rng.addEventListener("input", function () { r2 = +rng.value; draw(); });
    lab.appendChild(rng);
    controls.appendChild(lab);
    var left = h("span", "viz-readout");
    var right = h("span", "viz-readout");
    controls.appendChild(left);
    controls.appendChild(right);

    host.appendChild(c.svg);
    host.appendChild(controls);
    host.appendChild(h("p", "viz-caption",
      "The curve is the formula itself, not a simulation. What makes VIF worth reading is how "
      + "flat it is for most of its range and how late it turns: at R²ⱼ = 0.5 the standard "
      + "error is only 41% larger, and even at 0.8 it has merely doubled. The damage arrives "
      + "in the last stretch. Note also that the harm has begun long before the rule of thumb "
      + "fires — a t-ratio that would have been 4.00 has already fallen below 2 by R²ⱼ ≈ 0.75, "
      + "while VIF is still only 4. Rules of thumb are a summary of the curve, not a "
      + "substitute for looking at it."));

    draw();
  });

  /* ============================================================
     Unit 2B — Figure 3: the classic symptom, assembled

     A high R², an F-test that rejects overwhelmingly, and individual
     t-ratios that cannot clear the 5% bar. The three facts look
     contradictory and are not: F asks whether the regressors matter
     TOGETHER, and each t asks whether one of them matters once the
     others are already in — which is the question collinear data
     cannot answer.

     X4 is uncorrelated with the other two and is what keeps R² high.
     Watching its t-ratio sit still while the other two collapse is
     the deck's point that non-collinear coefficients are unaffected.

     The standard errors are built from the unit's own formula,
     var(β̂j) = σ̂² / [Σxj²(1 − R²j)], with each R²j taken from a real
     auxiliary regression — so the figure and the algebra cannot drift
     apart.
     ============================================================ */
  VIZ.register("high-r2-low-t", function (host) {
    var N = 30, B2 = 0.55, B3 = 0.45, B4 = 2.0, SX = 15, SU = 11, K = 4;
    var DF = N - K;                              /* 26 */
    var TC = tCrit(0.975, DF);                   /* two-tailed 5% */
    var FCRIT = 2.98;                            /* F(3, 26) at 5% is 2.975 */
    var HI = 0.98;
    var rho = 0.90;

    /* A seeded stream rather than Math.random: every reader should see
       the same sample, and so should the tutorial answer. MINSTD, whose
       products stay well inside exact double arithmetic. */
    var seed = 1387;
    function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    function gauss() {
      var u = 1 - rnd(), v = rnd();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    }
    var A = [], B = [], D = [], U = [], i;
    for (i = 0; i < N; i++) { A.push(gauss()); B.push(gauss()); D.push(gauss()); U.push(gauss()); }

    function fit(r) {
      var mix = Math.sqrt(1 - r * r), x2 = [], x3 = [], x4 = [], y = [], X = [], j;
      for (j = 0; j < N; j++) {
        var v2 = 50 + SX * A[j];
        var v3 = 50 + SX * (r * A[j] + mix * B[j]);
        var v4 = 50 + SX * D[j];
        x2.push(v2); x3.push(v3); x4.push(v4);
        y.push(20 + B2 * v2 + B3 * v3 + B4 * v4 + SU * U[j]);
      }
      for (j = 0; j < N; j++) X.push([1, x2[j], x3[j], x4[j]]);
      var m = olsk(X, y);
      if (!m) return null;
      var s2 = m.rss / DF;

      function stderr(col, o1, o2) {
        var mn = 0, ss = 0, q;
        for (q = 0; q < N; q++) mn += col[q];
        mn /= N;
        for (q = 0; q < N; q++) ss += (col[q] - mn) * (col[q] - mn);
        var tol = 1 - ols3(o1, o2, col).r2;      /* 1 − R²j, the auxiliary fit */
        if (!(ss > 0) || !(tol > 1e-9)) return null;
        return Math.sqrt(s2 / (ss * tol));
      }
      var e2 = stderr(x2, x3, x4), e3 = stderr(x3, x2, x4), e4 = stderr(x4, x2, x3);
      if (!e2 || !e3 || !e4) return null;
      return { r2: m.r2,
               f: (m.r2 / (K - 1)) / ((1 - m.r2) / DF),
               t2: m.beta[1] / e2, t3: m.beta[2] / e3, t4: m.beta[3] / e4 };
    }

    var c = chart({ w: 640, h: 350, pad: { t: 28, r: 20, b: 46, l: 50 },
                    xd: [0, HI], yd: [0, 16] });
    c.axes("correlation between X₂ and X₃", "|t|");

    c.plot.appendChild(s("line", { x1: c.x(0), y1: c.y(TC), x2: c.x(HI), y2: c.y(TC),
                                   stroke: P.inkFaint, "stroke-width": 1,
                                   "stroke-dasharray": "4 3" }));
    var tl = s("text", { x: c.x(HI) - 6, y: c.y(TC) - 6, "font-size": 11.5,
                         fill: P.inkSoft, "text-anchor": "end" });
    tl.textContent = "5% critical t = " + TC.toFixed(2);
    c.plot.appendChild(tl);

    /* traced once: the deviates are fixed, so only the correlation moves */
    var series = [{ key: "t2", colour: P.accent,  label: "X₂ — collinear" },
                  { key: "t3", colour: P.accent2, label: "X₃ — collinear" },
                  { key: "t4", colour: P.good,    label: "X₄ — not collinear" }];
    var grid = [], k;
    for (k = 0; k <= 49; k++) {
      var r = HI * k / 49, res = fit(r);
      if (res) grid.push({ r: r, res: res });
    }
    series.forEach(function (sr) {
      var dpath = "";
      grid.forEach(function (g, n) {
        var v = Math.min(Math.abs(g.res[sr.key]), 16);
        dpath += (n ? " L " : "M ") + c.x(g.r) + " " + c.y(v);
      });
      c.plot.appendChild(s("path", { d: dpath, fill: "none",
                                     stroke: sr.colour, "stroke-width": 2.2 }));
      sr.dot = s("circle", { r: 5, fill: sr.colour, stroke: P.paper, "stroke-width": 1.5 });
      c.plot.appendChild(sr.dot);
    });
    series.forEach(function (sr, n) {
      var t = s("text", { x: c.x([0, 0.30, 0.62][n]), y: 17,
                          "font-size": 11.5, fill: sr.colour });
      t.textContent = sr.label;
      c.plot.appendChild(t);
    });

    function draw() {
      var res = fit(rho);
      if (!res) return;
      series.forEach(function (sr) {
        sr.dot.setAttribute("cx", c.x(rho));
        sr.dot.setAttribute("cy", c.y(Math.min(Math.abs(res[sr.key]), 16)));
      });
      var sig2 = Math.abs(res.t2) > TC, sig3 = Math.abs(res.t3) > TC;
      left.textContent = "r₂₃ = " + rho.toFixed(2)
                       + "    R² = " + res.r2.toFixed(3)
                       + "    F = " + res.f.toFixed(1) + " against " + FCRIT.toFixed(2);
      right.textContent = "t₂ = " + res.t2.toFixed(2)
                        + "    t₃ = " + res.t3.toFixed(2)
                        + "    t₄ = " + res.t4.toFixed(2);
      verdict.textContent = (sig2 && sig3)
        ? "F rejects, and both collinear regressors are individually significant too"
        : (!sig2 && !sig3)
          ? "F rejects overwhelmingly, yet neither X₂ nor X₃ is individually significant"
          : "F rejects, but one of the two collinear regressors has lost its significance";
      c.svg.setAttribute("aria-label",
        "Three t-ratio curves against the correlation of X2 and X3: the two collinear ones "
        + "fall below the critical value while the third stays flat.");
    }

    var controls = h("div", "viz-controls");
    var lab = h("label", null, "correlation between X₂ and X₃");
    var rng = document.createElement("input");
    rng.type = "range"; rng.min = "0"; rng.max = "0.98"; rng.step = "0.02"; rng.value = "0.9";
    rng.addEventListener("input", function () { rho = +rng.value; draw(); });
    lab.appendChild(rng);
    controls.appendChild(lab);
    var left = h("span", "viz-readout");
    var right = h("span", "viz-readout");
    var verdict = h("span", "viz-readout");
    controls.appendChild(left);
    controls.appendChild(right);
    controls.appendChild(verdict);

    host.appendChild(c.svg);
    host.appendChild(controls);
    host.appendChild(h("p", "viz-caption",
      "One sample of thirty, one true model, and only the correlation between X₂ and X₃ "
      + "changing. All three variables genuinely belong, so nothing here is misspecified: "
      + "the estimator stays unbiased at every setting. Past about 0.85 both collinear "
      + "t-ratios sink under the bar while R² and F, if anything, improve — the "
      + "high-R²-few-significant-t symptom, manufactured on demand. X₄ is the control. It is "
      + "uncorrelated with the other two, and its t-ratio does not move at all. "
      + "Multicollinearity is local damage, not a sickness of the whole equation. Watch the "
      + "two collinear coefficients themselves as well: unbiasedness is a statement about "
      + "the average over many samples, and in this one sample the estimates wander a long "
      + "way as the correlation tightens. That wandering is the reason such results are so "
      + "sensitive to adding or dropping a handful of observations."));

    draw();
  });

  /* ============================================================
     Unit 2C — shared helpers

     mulberry32 rather than the MINSTD used in 2B. Unit 2C averages
     over thousands of samples, and a linear congruential generator's
     lattice shows up in exactly that setting: consecutive pairs feed
     Box-Muller, the deviates pick up structure, and the Monte Carlo
     standard deviation lands a few per cent below the closed form it
     is supposed to confirm. A figure that quietly misses its own
     theory by 4% is worse than no figure.
     ============================================================ */
  function rngSeeded(seed) {
    var a = seed | 0;
    function u() {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    return { u: u, gauss: function () {
      var p = 1 - u(), q = u();
      return Math.sqrt(-2 * Math.log(p)) * Math.cos(2 * Math.PI * q);
    } };
  }

  /* the X grid every 2C figure regresses on, and its Σx² */
  function grid2c(n) {
    var X = [], i, m = 0;
    for (i = 0; i < n; i++) X.push(10 + 80 * i / (n - 1));
    for (i = 0; i < n; i++) m += X[i];
    m /= n;
    var sxx = 0;
    for (i = 0; i < n; i++) sxx += (X[i] - m) * (X[i] - m);
    return { X: X, mean: m, sxx: sxx };
  }

  /* ============================================================
     Unit 2C — Figure 1: what the squared residuals look like

     The deck's informal detection method is to plot û² against Ŷ and
     look. That is only useful if you have seen what the shapes are,
     so this draws the deck's panels from live data: pick a form for
     the error variance, then switch between the scatter a reader
     would actually be handed and the diagnostic plot it produces.

     The deviates are fixed, so changing the form changes the
     variance and nothing else.
     ============================================================ */
  VIZ.register("residual-plot-shapes", function (host) {
    var N = 70, B1 = 20, B2 = 0.6, S0 = 7;
    /* seed chosen so the fixed draw is even across the range: with only
       23 observations per third, an unlucky draw can flatten the arch or
       manufacture a slope that the variance form did not put there */
    var G = grid2c(N), R = rngSeeded(170), E = [], i;
    for (i = 0; i < N; i++) E.push(R.gauss());

    var FORMS = [
      { key: "const", text: "constant",      f: function () { return 1; },
        note: "homoscedastic — assumption 5 holds" },
      { key: "rise",  text: "rising with X", f: function (x) { return 0.25 + 1.6 * x / 100; },
        note: "the classic funnel: var(u) rising in X" },
      { key: "arch",  text: "arch",          f: function (x) { return 0.30 + 1.7 * Math.sin(Math.PI * x / 100); },
        note: "largest in the middle of the range" },
      { key: "sharp", text: "sharply rising", f: function (x) { return 0.20 + 2.3 * Math.pow(x / 100, 2); },
        note: "non-linear in Ŷ — what the White test is built for" }
    ];
    var form = FORMS[1], resid = false;

    var c = chart({ w: 640, h: 360, pad: { t: 22, r: 20, b: 46, l: 58 },
                    xd: [0, 100], yd: [0, 100] });
    var axg = c.axes("X", "Y");
    var pts = s("g"), line = s("g");
    c.plot.appendChild(line);
    c.plot.appendChild(pts);

    function build() {
      var Y = [], k;
      for (k = 0; k < N; k++) Y.push(B1 + B2 * G.X[k] + S0 * form.f(G.X[k]) * E[k]);
      var my = 0;
      for (k = 0; k < N; k++) my += Y[k];
      my /= N;
      var sxy = 0;
      for (k = 0; k < N; k++) sxy += (G.X[k] - G.mean) * (Y[k] - my);
      var b2 = sxy / G.sxx, b1 = my - b2 * G.mean;
      var fit = [], u2 = [];
      for (k = 0; k < N; k++) {
        fit.push(b1 + b2 * G.X[k]);
        u2.push((Y[k] - b1 - b2 * G.X[k]) * (Y[k] - b1 - b2 * G.X[k]));
      }
      return { Y: Y, b1: b1, b2: b2, fit: fit, u2: u2 };
    }

    function draw() {
      var m = build(), k;
      while (pts.firstChild) pts.removeChild(pts.firstChild);
      while (line.firstChild) line.removeChild(line.firstChild);

      if (!resid) {
        c.plot.removeChild(pts);
        var ymax = 100;
        line.appendChild(s("line", { x1: c.x(0), y1: c.y(m.b1),
          x2: c.x(100), y2: c.y(m.b1 + m.b2 * 100),
          stroke: P.accent2, "stroke-width": 2.2 }));
        for (k = 0; k < N; k++) {
          pts.appendChild(s("circle", { cx: c.x(G.X[k]),
            cy: c.y(Math.max(0, Math.min(ymax, m.Y[k]))), r: 3.2,
            fill: P.accent, opacity: 0.72 }));
        }
        c.plot.appendChild(pts);
        axg.querySelectorAll("text")[0].textContent = "X";
        axg.querySelectorAll("text")[1].textContent = "Y";
      } else {
        c.plot.removeChild(pts);
        var top = 0;
        for (k = 0; k < N; k++) if (m.u2[k] > top) top = m.u2[k];
        top = top || 1;
        var lo = 1e9, hi = -1e9;
        for (k = 0; k < N; k++) { if (m.fit[k] < lo) lo = m.fit[k]; if (m.fit[k] > hi) hi = m.fit[k]; }
        for (k = 0; k < N; k++) {
          pts.appendChild(s("circle", {
            cx: c.x(100 * (m.fit[k] - lo) / (hi - lo || 1)),
            cy: c.y(100 * m.u2[k] / top), r: 3.2,
            fill: P.accent, opacity: 0.72 }));
        }
        c.plot.appendChild(pts);
        axg.querySelectorAll("text")[0].textContent = "fitted Ŷ";
        axg.querySelectorAll("text")[1].textContent = "û²";
      }

      /* how much bigger the squared residuals get across the range */
      var thirds = [0, 0, 0], counts = [0, 0, 0];
      for (k = 0; k < N; k++) {
        var b = k < N / 3 ? 0 : k < 2 * N / 3 ? 1 : 2;
        thirds[b] += m.u2[k]; counts[b]++;
      }
      var m1 = thirds[0] / counts[0], m2 = thirds[1] / counts[1], m3 = thirds[2] / counts[2];
      var big = Math.max(m1, m2, m3), small = Math.min(m1, m2, m3);

      left.textContent = "β̂₂ = " + m.b2.toFixed(3) + "    " + form.note;
      /* all three thirds, not just the ends: the arch is flat end-to-end and
         only shows up against its own middle */
      right.textContent = "mean û² by third of X — " + m1.toFixed(0)
                        + " · " + m2.toFixed(0) + " · " + m3.toFixed(0)
                        + "    largest/smallest " + (big / (small || 1)).toFixed(1) + "×";
      c.svg.setAttribute("aria-label", resid
        ? "Squared residuals plotted against the fitted values, showing a "
          + form.text + " pattern."
        : "Scatter of Y on X with the fitted line, error variance " + form.text + ".");
    }

    var controls = h("div", "viz-controls");
    var pick = h("label", null, "var(u):");
    FORMS.forEach(function (o) {
      var b = h("button", null, o.text);
      b.addEventListener("click", function () {
        form = o;
        Array.prototype.forEach.call(pick.querySelectorAll("button"), function (n) {
          n.style.borderColor = "";
        });
        b.style.borderColor = P.accent;
        draw();
      });
      if (o === form) b.style.borderColor = P.accent;
      pick.appendChild(b);
    });
    controls.appendChild(pick);

    var tog = h("button", null, "Show û² against Ŷ");
    tog.addEventListener("click", function () {
      resid = !resid;
      tog.textContent = resid ? "Back to the data" : "Show û² against Ŷ";
      draw();
    });
    controls.appendChild(tog);

    var left = h("span", "viz-readout");
    var right = h("span", "viz-readout");
    controls.appendChild(left);
    controls.appendChild(right);

    host.appendChild(c.svg);
    host.appendChild(controls);
    host.appendChild(h("p", "viz-caption",
      "The same seventy disturbances every time — only the variance attached to them changes. "
      + "In the data view the funnel is easy to miss, especially with a strong slope carrying "
      + "the eye. Switch to û² against Ŷ and the shape is unmistakable, which is why the "
      + "diagnostic is worth plotting rather than squinting at the scatter. Note the last two "
      + "forms: neither is a straight line in Ŷ, so the Breusch–Pagan auxiliary regression, "
      + "which is linear, is looking for something that is not quite there. That is the gap "
      + "the White test exists to close."));

    draw();
  });

  /* ============================================================
     Unit 2C — Figure 2: Breusch-Pagan against White

     Both tests are nR² from an auxiliary regression, and both are
     read against χ² in the right tail. What differs is what goes on
     the right-hand side and therefore how many degrees of freedom
     are spent — which is exactly the trade the deck flags as White's
     weakness. Tracing both against the strength of the
     heteroscedasticity shows the trade being made.

     Critical values are the printed ones: χ²(1) = 3.84, χ²(2) = 5.99.
     ============================================================ */
  VIZ.register("bp-vs-white", function (host) {
    var N = 60, B1 = 20, B2 = 0.6, S0 = 9, HI = 2.5;
    var G = grid2c(N), R = rngSeeded(4242), E = [], i;
    for (i = 0; i < N; i++) E.push(R.gauss());
    var CHI1 = 3.84, CHI2 = 5.99;
    var lam = 1.2;

    /* OLS of dep on [1, ...cols] by Gauss-Jordan; returns R² only */
    function auxR2(dep, cols) {
      var k = cols.length + 1, X = [], p, j, q;
      for (p = 0; p < N; p++) {
        var row = [1];
        for (j = 0; j < cols.length; j++) row.push(cols[j][p]);
        X.push(row);
      }
      var A = [];
      for (i = 0; i < k; i++) {
        A.push(new Array(k + 1).fill(0));
        for (j = 0; j < k; j++) for (p = 0; p < N; p++) A[i][j] += X[p][i] * X[p][j];
        for (p = 0; p < N; p++) A[i][k] += X[p][i] * dep[p];
      }
      for (i = 0; i < k; i++) {
        var piv = i;
        for (q = i + 1; q < k; q++) if (Math.abs(A[q][i]) > Math.abs(A[piv][i])) piv = q;
        if (Math.abs(A[piv][i]) < 1e-10) return null;
        var t = A[i]; A[i] = A[piv]; A[piv] = t;
        var d = A[i][i];
        for (j = i; j <= k; j++) A[i][j] /= d;
        for (q = 0; q < k; q++) {
          if (q === i) continue;
          var f = A[q][i];
          for (j = i; j <= k; j++) A[q][j] -= f * A[i][j];
        }
      }
      var beta = [];
      for (i = 0; i < k; i++) beta.push(A[i][k]);
      var my = 0;
      for (p = 0; p < N; p++) my += dep[p];
      my /= N;
      var rss = 0, tss = 0;
      for (p = 0; p < N; p++) {
        var fit = 0;
        for (j = 0; j < k; j++) fit += beta[j] * X[p][j];
        rss += (dep[p] - fit) * (dep[p] - fit);
        tss += (dep[p] - my) * (dep[p] - my);
      }
      return tss <= 0 ? 0 : 1 - rss / tss;
    }

    function run(L) {
      var Y = [], k, my = 0;
      for (k = 0; k < N; k++) {
        Y.push(B1 + B2 * G.X[k] + S0 * Math.pow(G.X[k] / G.mean, L) * E[k]);
        my += Y[k];
      }
      my /= N;
      var sxy = 0;
      for (k = 0; k < N; k++) sxy += (G.X[k] - G.mean) * (Y[k] - my);
      var b2 = sxy / G.sxx, b1 = my - b2 * G.mean, u2 = [];
      for (k = 0; k < N; k++) {
        var e = Y[k] - b1 - b2 * G.X[k];
        u2.push(e * e);
      }
      var sq = G.X.map(function (x) { return x * x; });
      var rb = auxR2(u2, [G.X]), rw = auxR2(u2, [G.X, sq]);
      if (rb == null || rw == null) return null;
      return { bp: N * rb, white: N * rw, r2b: rb, r2w: rw };
    }

    var c = chart({ w: 640, h: 350, pad: { t: 30, r: 20, b: 46, l: 50 },
                    xd: [0, HI], yd: [0, 26] });
    c.axes("λ — how fast var(u) grows with X", "LM = nR²");

    [[CHI1, "χ²(1) = 3.84 — Breusch–Pagan", P.accent],
     [CHI2, "χ²(2) = 5.99 — White", P.accent2]].forEach(function (cv) {
      c.plot.appendChild(s("line", { x1: c.x(0), y1: c.y(cv[0]), x2: c.x(HI), y2: c.y(cv[0]),
                                     stroke: cv[2], "stroke-width": 1,
                                     "stroke-dasharray": "4 3", opacity: 0.75 }));
    });
    var cvl = s("text", { x: c.x(HI) - 6, y: c.y(CHI2) - 7, "font-size": 11,
                          fill: P.inkSoft, "text-anchor": "end" });
    cvl.textContent = "5% critical values: 3.84 and 5.99";
    c.plot.appendChild(cvl);

    var series = [{ key: "bp", colour: P.accent, label: "Breusch–Pagan  (û² on X)" },
                  { key: "white", colour: P.accent2, label: "White  (û² on X and X²)" }];
    var grid = [], k;
    for (k = 0; k <= 50; k++) {
      var L = HI * k / 50, r = run(L);
      if (r) grid.push({ lam: L, r: r });
    }
    series.forEach(function (sr, n) {
      var dpath = "";
      grid.forEach(function (g, m) {
        dpath += (m ? " L " : "M ") + c.x(g.lam) + " " + c.y(Math.min(g.r[sr.key], 26));
      });
      c.plot.appendChild(s("path", { d: dpath, fill: "none",
                                     stroke: sr.colour, "stroke-width": 2.3 }));
      sr.dot = s("circle", { r: 5, fill: sr.colour, stroke: P.paper, "stroke-width": 1.5 });
      c.plot.appendChild(sr.dot);
      var t = s("text", { x: c.x(n ? 1.05 : 0), y: 18, "font-size": 11.5, fill: sr.colour });
      t.textContent = sr.label;
      c.plot.appendChild(t);
    });

    function draw() {
      var r = run(lam);
      if (!r) return;
      series.forEach(function (sr) {
        sr.dot.setAttribute("cx", c.x(lam));
        sr.dot.setAttribute("cy", c.y(Math.min(r[sr.key], 26)));
      });
      left.textContent = "λ = " + lam.toFixed(2)
                       + "    BP: R² = " + r.r2b.toFixed(3) + ", nR² = " + r.bp.toFixed(2)
                       + " vs 3.84 — " + (r.bp > CHI1 ? "reject" : "do not reject");
      right.textContent = "White: R² = " + r.r2w.toFixed(3) + ", nR² = " + r.white.toFixed(2)
                        + " vs 5.99 — " + (r.white > CHI2 ? "reject" : "do not reject");
      c.svg.setAttribute("aria-label",
        "Two LM statistics rising with the strength of the heteroscedasticity, both crossing "
        + "their critical values; at lambda " + lam.toFixed(2) + " they are "
        + r.bp.toFixed(1) + " and " + r.white.toFixed(1) + ".");
    }

    var controls = h("div", "viz-controls");
    var lab = h("label", null, "λ — strength of the heteroscedasticity");
    var rn = document.createElement("input");
    rn.type = "range"; rn.min = "0"; rn.max = "2.5"; rn.step = "0.05"; rn.value = "1.2";
    rn.addEventListener("input", function () { lam = +rn.value; draw(); });
    lab.appendChild(rn);
    controls.appendChild(lab);
    var left = h("span", "viz-readout");
    var right = h("span", "viz-readout");
    controls.appendChild(left);
    controls.appendChild(right);

    host.appendChild(c.svg);
    host.appendChild(controls);
    host.appendChild(h("p", "viz-caption",
      "One sample of sixty, held fixed, with only the severity of the heteroscedasticity "
      + "moving. At λ = 0 the errors are homoscedastic and neither statistic goes anywhere "
      + "near its critical value — which is what a test that did not fire on well-behaved "
      + "data ought to do. Both then rise and cross. Watch the right-hand end: the White "
      + "statistic keeps climbing while Breusch–Pagan flattens, because the variance here is "
      + "growing faster than linearly and only White's auxiliary regression has the squared "
      + "term needed to see it. That extra power is bought with a degree of freedom, which is "
      + "why White's bar sits at 5.99 rather than 3.84 — and with three or four regressors "
      + "rather than one, the bar rises a great deal further."));

    draw();
  });

  /* ============================================================
     Unit 2C — Figure 3: why the standard error cannot be trusted

     The consequence students most often state loosely — "the
     standard errors are wrong" — made exact. Three quantities, all
     computed rather than asserted:

       the Monte Carlo spread of β̂2 over many samples  (the truth)
       the conventional OLS standard error              (what is printed)
       the White HC0 robust standard error              (the remedy)

     The Monte Carlo spread also confirms the deck's own variance
     formula Σxᵢ²σᵢ² / (Σxᵢ²)², which is drawn as the theoretical
     line the simulation has to land on.
     ============================================================ */
  VIZ.register("robust-se", function (host) {
    var N = 60, B1 = 20, B2 = 0.6, S0 = 9, RUNS = 600, HI = 2.5;
    var G = grid2c(N);
    var lam = 1.6;

    function sigma(x, L) { return S0 * Math.pow(x / G.mean, L); }

    /* the deck's formula for var(β̂2) when the variance is not constant */
    function trueSE(L) {
      var num = 0, k;
      for (k = 0; k < N; k++) {
        var sd = sigma(G.X[k], L);
        num += (G.X[k] - G.mean) * (G.X[k] - G.mean) * sd * sd;
      }
      return Math.sqrt(num / (G.sxx * G.sxx));
    }

    function study(L) {
      var R = rngSeeded(20250830);              /* common random numbers across λ */
      var sum = 0, sq = 0, sa = 0, sr = 0, r, k;
      for (r = 0; r < RUNS; r++) {
        var Y = [], my = 0;
        for (k = 0; k < N; k++) {
          Y.push(B1 + B2 * G.X[k] + sigma(G.X[k], L) * R.gauss());
          my += Y[k];
        }
        my /= N;
        var sxy = 0;
        for (k = 0; k < N; k++) sxy += (G.X[k] - G.mean) * (Y[k] - my);
        var b2 = sxy / G.sxx, b1 = my - b2 * G.mean, rss = 0, meat = 0;
        for (k = 0; k < N; k++) {
          var e = Y[k] - b1 - b2 * G.X[k];
          rss += e * e;
          meat += (G.X[k] - G.mean) * (G.X[k] - G.mean) * e * e;
        }
        sum += b2; sq += b2 * b2;
        sa += Math.sqrt((rss / (N - 2)) / G.sxx);       /* conventional */
        sr += Math.sqrt(meat / (G.sxx * G.sxx));        /* White HC0 */
      }
      var mean = sum / RUNS;
      var v = (sq - RUNS * mean * mean) / (RUNS - 1);
      return { mc: Math.sqrt(Math.max(v, 0)), ols: sa / RUNS, rob: sr / RUNS,
               theory: trueSE(L), mean: mean };
    }

    var c = chart({ w: 640, h: 350, pad: { t: 30, r: 20, b: 46, l: 58 },
                    xd: [0, HI], yd: [0, 0.14] });
    c.axes("λ — how fast var(u) grows with X", "standard error of β̂₂");

    var grid = [], k;
    for (k = 0; k <= 25; k++) {
      var L = HI * k / 25;
      grid.push({ lam: L, r: study(L) });
    }
    var series = [
      { key: "theory", colour: P.ink,     label: "true SE, from Σxᵢ²σᵢ²/(Σxᵢ²)²", dash: "5 4" },
      { key: "mc",     colour: P.good,    label: "spread of β̂₂ over 600 samples", dash: null },
      { key: "ols",    colour: P.accent,  label: "conventional OLS SE — what is printed", dash: null },
      { key: "rob",    colour: P.accent2, label: "robust (White HC0) SE", dash: null }
    ];
    series.forEach(function (sr, n) {
      var dpath = "";
      grid.forEach(function (g, m) {
        dpath += (m ? " L " : "M ") + c.x(g.lam) + " " + c.y(Math.min(g.r[sr.key], 0.14));
      });
      c.plot.appendChild(s("path", { d: dpath, fill: "none", stroke: sr.colour,
                                     "stroke-width": sr.dash ? 2 : 2.3,
                                     "stroke-dasharray": sr.dash }));
      sr.dot = s("circle", { r: 4.5, fill: sr.colour, stroke: P.paper, "stroke-width": 1.4 });
      c.plot.appendChild(sr.dot);
      var t = s("text", { x: c.x(n % 2 ? 1.25 : 0.02), y: 15 + Math.floor(n / 2) * 14,
                          "font-size": 11, fill: sr.colour });
      t.textContent = sr.label;
      c.plot.appendChild(t);
    });

    function draw() {
      var r = study(lam);
      series.forEach(function (sr) {
        sr.dot.setAttribute("cx", c.x(lam));
        sr.dot.setAttribute("cy", c.y(Math.min(r[sr.key], 0.14)));
      });
      left.textContent = "λ = " + lam.toFixed(1)
                       + "    true SE " + r.theory.toFixed(4)
                       + "    simulated " + r.mc.toFixed(4)
                       + "    mean β̂₂ = " + r.mean.toFixed(3);
      right.textContent = "conventional " + r.ols.toFixed(4)
                        + " (" + (100 * r.ols / r.theory).toFixed(0) + "% of the truth)"
                        + "    robust " + r.rob.toFixed(4)
                        + " (" + (100 * r.rob / r.theory).toFixed(0) + "%)";
      c.svg.setAttribute("aria-label",
        "Four standard-error curves: the conventional one falls away from the true value as "
        + "the heteroscedasticity strengthens while the robust one follows it.");
    }

    var controls = h("div", "viz-controls");
    var lab = h("label", null, "λ — strength of the heteroscedasticity");
    var rn = document.createElement("input");
    rn.type = "range"; rn.min = "0"; rn.max = "2.5"; rn.step = "0.1"; rn.value = "1.6";
    rn.addEventListener("input", function () { lam = +rn.value; draw(); });
    lab.appendChild(rn);
    controls.appendChild(lab);
    var left = h("span", "viz-readout");
    var right = h("span", "viz-readout");
    controls.appendChild(left);
    controls.appendChild(right);

    host.appendChild(c.svg);
    host.appendChild(controls);
    host.appendChild(h("p", "viz-caption",
      "Six hundred samples at each setting. The green simulated spread sits on the dashed "
      + "theoretical line throughout, which is the deck's variance formula confirmed rather "
      + "than quoted. At λ = 0 all four agree and there is nothing to fix. As the variance "
      + "fans out, the conventional standard error — the one the regression output prints — "
      + "peels away below the truth, reaching about three-quarters of it: t-ratios inflated "
      + "by a third, and a 5% test rejecting far more often than 5% of the time. The robust "
      + "standard error tracks the truth instead, and note that β̂₂ itself stays on 0.600 the "
      + "whole way. Nothing is biased here except the reported precision. Robust does run a "
      + "few per cent low at n = 60 — HC0 is a large-sample correction, which is why software "
      + "offers the small-sample variants HC1 and HC3."));

    draw();
  });

  /* ============================================================
     Unit 2C — Figure 4: logging the data

     The deck's first remedy, and the one that connects back to 2A
     Part 2. When the relationship is multiplicative, the levels
     scatter fans out because the spread is proportional to the
     level; taking logs makes the error additive and the fan
     disappears. Constructed data, in the shape of the CO2-GNI
     example the unit works through, with the Breusch-Pagan
     statistic reported on both sides.
     ============================================================ */
  VIZ.register("log-fixes-heteroscedasticity", function (host) {
    var N = 120, A1 = -1.10, A2 = 1.01, SU = 0.55, logged = false;
    var R = rngSeeded(777), LX = [], LY = [], X = [], Y = [], i;
    for (i = 0; i < N; i++) {
      var L = -1.5 + 10.5 * i / (N - 1);
      var ly = A1 + A2 * L + SU * R.gauss();
      LX.push(L); LY.push(ly);
      X.push(Math.exp(L)); Y.push(Math.exp(ly));
    }

    /* simple regression plus the Breusch-Pagan auxiliary on one regressor */
    function fit(xv, yv) {
      var n = xv.length, mx = 0, my = 0, k;
      for (k = 0; k < n; k++) { mx += xv[k]; my += yv[k]; }
      mx /= n; my /= n;
      var sxy = 0, sxx = 0;
      for (k = 0; k < n; k++) { sxy += (xv[k] - mx) * (yv[k] - my); sxx += (xv[k] - mx) * (xv[k] - mx); }
      var b = sxy / sxx, a = my - b * mx, u2 = [], mu = 0;
      for (k = 0; k < n; k++) {
        var e = yv[k] - a - b * xv[k];
        u2.push(e * e); mu += e * e;
      }
      mu /= n;
      var s1 = 0;
      for (k = 0; k < n; k++) s1 += (xv[k] - mx) * (u2[k] - mu);
      var bb = s1 / sxx, aa = mu - bb * mx, rss = 0, tss = 0;
      for (k = 0; k < n; k++) {
        rss += (u2[k] - aa - bb * xv[k]) * (u2[k] - aa - bb * xv[k]);
        tss += (u2[k] - mu) * (u2[k] - mu);
      }
      var r2 = tss <= 0 ? 0 : 1 - rss / tss;
      return { a: a, b: b, r2: r2, lm: n * r2 };
    }

    var c = chart({ w: 640, h: 360, pad: { t: 22, r: 20, b: 46, l: 60 },
                    xd: [0, 100], yd: [0, 100] });
    var axg = c.axes("GNI", "CO₂");
    var pts = s("g"), ln = s("g");
    c.plot.appendChild(ln);
    c.plot.appendChild(pts);

    function draw() {
      var xv = logged ? LX : X, yv = logged ? LY : Y;
      var m = fit(xv, yv), k;
      while (pts.firstChild) pts.removeChild(pts.firstChild);
      while (ln.firstChild) ln.removeChild(ln.firstChild);

      var xlo = 1e18, xhi = -1e18, ylo = 1e18, yhi = -1e18;
      for (k = 0; k < N; k++) {
        if (xv[k] < xlo) xlo = xv[k];
        if (xv[k] > xhi) xhi = xv[k];
        if (yv[k] < ylo) ylo = yv[k];
        if (yv[k] > yhi) yhi = yv[k];
      }
      var px = function (v) { return 100 * (v - xlo) / (xhi - xlo || 1); };
      var py = function (v) { return 100 * (v - ylo) / (yhi - ylo || 1); };

      ln.appendChild(s("line", { x1: c.x(px(xlo)), y1: c.y(py(m.a + m.b * xlo)),
                                 x2: c.x(px(xhi)), y2: c.y(py(m.a + m.b * xhi)),
                                 stroke: P.accent2, "stroke-width": 2.2 }));
      for (k = 0; k < N; k++) {
        pts.appendChild(s("circle", { cx: c.x(px(xv[k])), cy: c.y(py(yv[k])),
                                      r: 3, fill: P.accent, opacity: 0.68 }));
      }
      axg.querySelectorAll("text")[0].textContent = logged ? "ln(GNI)" : "GNI";
      axg.querySelectorAll("text")[1].textContent = logged ? "ln(CO₂)" : "CO₂";

      left.textContent = logged
        ? "ln(CO₂) = " + m.a.toFixed(2) + " + " + m.b.toFixed(3) + " ln(GNI)"
        : "CO₂ = " + m.a.toFixed(1) + " + " + m.b.toFixed(3) + " GNI";
      right.textContent = "Breusch–Pagan: R² = " + m.r2.toFixed(3)
                        + ", nR² = " + m.lm.toFixed(2) + " vs 3.84 — "
                        + (m.lm > 3.84 ? "reject: heteroscedastic" : "do not reject");
      c.svg.setAttribute("aria-label", logged
        ? "Logged scatter with even spread about the fitted line."
        : "Levels scatter fanning out sharply about the fitted line.");
    }

    var controls = h("div", "viz-controls");
    var tog = h("button", null, "Take logs of both variables");
    tog.addEventListener("click", function () {
      logged = !logged;
      tog.textContent = logged ? "Back to levels" : "Take logs of both variables";
      draw();
    });
    controls.appendChild(tog);
    var left = h("span", "viz-readout");
    var right = h("span", "viz-readout");
    controls.appendChild(left);
    controls.appendChild(right);

    host.appendChild(c.svg);
    host.appendChild(controls);
    host.appendChild(h("p", "viz-caption",
      "Constructed data, built to the shape of the CO₂ and GNI example worked through in "
      + "section 8 — not that dataset itself. In levels the scatter fans out violently and "
      + "Breusch–Pagan rejects without hesitation. Press the button: the same observations, "
      + "logged, sit in an even band about the line and the test finds nothing at all. No "
      + "observation was dropped and nothing was reweighted. The heteroscedasticity was "
      + "never really about the errors — it was the model being written in the wrong units, "
      + "which makes this a case of the impure kind from section 3, and the reason the first "
      + "thing to check is always the specification."));

    draw();
  });

  /* ============================================================
     Unit 2D — shared setup

     A persistent regressor, because that is what economic time
     series look like and because the damage autocorrelation does to
     a standard error depends on it. With X serially uncorrelated the
     understatement is mild; with X persistent it is severe, and the
     figures below would understate the problem if X were drawn
     independently.

     rngSeeded is 2C's mulberry32 — these figures average over
     samples, so an LCG will not do.
     ============================================================ */
  function series2d(seed, r, sd, T) {
    var R = rngSeeded(seed), X = [], v = 0, t;
    for (t = 0; t < T; t++) {
      v = r * v + Math.sqrt(1 - r * r) * R.gauss();
      X.push(50 + sd * v);
    }
    var m = 0;
    for (t = 0; t < T; t++) m += X[t];
    m /= T;
    var x = X.map(function (q) { return q - m; }), sxx = 0;
    for (t = 0; t < T; t++) sxx += x[t] * x[t];
    return { X: X, mean: m, x: x, sxx: sxx, T: T };
  }

  /* OLS on a time series, plus everything the autocorrelation
     diagnostics need: residuals, ρ̂ from û on û lagged, and DW. */
  function tsfit(X, Y) {
    var T = X.length, mx = 0, my = 0, t;
    for (t = 0; t < T; t++) { mx += X[t]; my += Y[t]; }
    mx /= T; my /= T;
    var sxy = 0, sxx = 0;
    for (t = 0; t < T; t++) { sxy += (X[t] - mx) * (Y[t] - my); sxx += (X[t] - mx) * (X[t] - mx); }
    var b2 = sxy / sxx, b1 = my - b2 * mx, e = [];
    for (t = 0; t < T; t++) e.push(Y[t] - b1 - b2 * X[t]);
    var n1 = 0, d1 = 0, dwn = 0, dwd = 0;
    for (t = 1; t < T; t++) { n1 += e[t] * e[t - 1]; d1 += e[t - 1] * e[t - 1]; }
    for (t = 1; t < T; t++) dwn += (e[t] - e[t - 1]) * (e[t] - e[t - 1]);
    for (t = 0; t < T; t++) dwd += e[t] * e[t];
    return { b1: b1, b2: b2, e: e, sxx: sxx,
             rhat: d1 ? n1 / d1 : 0, dw: dwd ? dwn / dwd : 0 };
  }

  /* ============================================================
     Unit 2D — Figure 1: what autocorrelated residuals look like

     The deck's informal detection method is to plot the residuals
     over time and against their own lag. Both views, one slider, and
     the whole range of ρ from strongly negative to strongly
     positive — because negative autocorrelation is the case students
     never recognise, having only ever been shown the positive one.
     ============================================================ */
  VIZ.register("autocorrelation-patterns", function (host) {
    var T = 60, B1 = 20, B2 = 0.6, SE = 6;
    var G = series2d(99, 0.8, 12, T);
    var R = rngSeeded(4180), EPS = [], i;
    for (i = 0; i < T; i++) EPS.push(R.gauss());
    var rho = 0.8, lagView = false;

    var c = chart({ w: 640, h: 320, pad: { t: 22, r: 20, b: 46, l: 54 },
                    xd: [0, T], yd: [-1, 1] });
    var axg = c.axes("time  t", "residual  û");
    var gfx = s("g");
    c.plot.appendChild(gfx);

    function build() {
      var u = [], prev = 0, t;
      for (t = 0; t < T; t++) { prev = rho * prev + SE * EPS[t]; u.push(prev); }
      var Y = [];
      for (t = 0; t < T; t++) Y.push(B1 + B2 * G.X[t] + u[t]);
      return tsfit(G.X, Y);
    }

    function draw() {
      var m = build(), t;
      while (gfx.firstChild) gfx.removeChild(gfx.firstChild);
      var top = 0;
      for (t = 0; t < T; t++) top = Math.max(top, Math.abs(m.e[t]));
      top = top || 1;

      if (!lagView) {
        c.xd = null;
        gfx.appendChild(s("line", { x1: c.x(0), y1: c.y(0), x2: c.x(T), y2: c.y(0),
                                    stroke: P.ruleSoft, "stroke-width": 1 }));
        var dpath = "";
        for (t = 0; t < T; t++) dpath += (t ? " L " : "M ") + c.x(t) + " " + c.y(m.e[t] / top);
        gfx.appendChild(s("path", { d: dpath, fill: "none",
                                    stroke: P.accent2, "stroke-width": 1.6 }));
        for (t = 0; t < T; t++) {
          gfx.appendChild(s("circle", { cx: c.x(t), cy: c.y(m.e[t] / top), r: 2.6,
                                        fill: m.e[t] >= 0 ? P.accent : P.good }));
        }
        axg.querySelectorAll("text")[0].textContent = "time  t";
        axg.querySelectorAll("text")[1].textContent = "residual  û";
      } else {
        gfx.appendChild(s("line", { x1: c.x(0), y1: c.y(0), x2: c.x(T), y2: c.y(0),
                                    stroke: P.ruleSoft, "stroke-width": 1 }));
        gfx.appendChild(s("line", { x1: c.x(T / 2), y1: c.y(-1), x2: c.x(T / 2), y2: c.y(1),
                                    stroke: P.ruleSoft, "stroke-width": 1 }));
        /* the line through the lag scatter IS ρ̂ */
        gfx.appendChild(s("line", {
          x1: c.x(0), y1: c.y(-m.rhat), x2: c.x(T), y2: c.y(m.rhat),
          stroke: P.accent, "stroke-width": 2 }));
        for (t = 1; t < T; t++) {
          gfx.appendChild(s("circle", {
            cx: c.x(T / 2 + (T / 2) * m.e[t - 1] / top),
            cy: c.y(m.e[t] / top), r: 3, fill: P.accent2, opacity: 0.7 }));
        }
        axg.querySelectorAll("text")[0].textContent = "lagged residual  û₍ₜ₋₁₎";
        axg.querySelectorAll("text")[1].textContent = "residual  ûₜ";
      }

      /* runs: how often the residual changes sign. Few runs is what
         positive autocorrelation looks like without any arithmetic. */
      var runs = 1;
      for (t = 1; t < T; t++) if ((m.e[t] >= 0) !== (m.e[t - 1] >= 0)) runs++;

      left.textContent = "ρ = " + rho.toFixed(2)
                       + "    ρ̂ from û on its lag = " + m.rhat.toFixed(3)
                       + "    DW = " + m.dw.toFixed(2);
      right.textContent = "sign changes: " + runs + " in " + T
                        + (m.rhat > 0.25 ? "  — long runs on one side: positive"
                          : m.rhat < -0.25 ? "  — alternating: negative"
                          : "  — no obvious pattern");
      c.svg.setAttribute("aria-label", lagView
        ? "Residuals plotted against their own lag, sloping upward when autocorrelation is positive."
        : "Residuals over time, staying on one side of zero for long stretches when autocorrelation is positive.");
    }

    var controls = h("div", "viz-controls");
    var lab = h("label", null, "ρ — the autocorrelation coefficient");
    var rn = document.createElement("input");
    rn.type = "range"; rn.min = "-0.9"; rn.max = "0.9"; rn.step = "0.05"; rn.value = "0.8";
    rn.addEventListener("input", function () { rho = +rn.value; draw(); });
    lab.appendChild(rn);
    controls.appendChild(lab);
    var tog = h("button", null, "Plot ûₜ against ûₜ₋₁");
    tog.addEventListener("click", function () {
      lagView = !lagView;
      tog.textContent = lagView ? "Back to the time plot" : "Plot ûₜ against ûₜ₋₁";
      draw();
    });
    controls.appendChild(tog);
    var left = h("span", "viz-readout");
    var right = h("span", "viz-readout");
    controls.appendChild(left);
    controls.appendChild(right);

    host.appendChild(c.svg);
    host.appendChild(controls);
    host.appendChild(h("p", "viz-caption",
      "Sixty periods, one set of underlying shocks, and only ρ moving. At ρ = 0.8 the residuals "
      + "wander lazily above and below zero, crossing only a handful of times: a shock in one "
      + "period is still there in the next. Drag ρ negative and the picture inverts into a "
      + "sawtooth that crosses zero almost every period — equally a violation, and the one "
      + "students routinely fail to recognise because textbooks illustrate the positive case. "
      + "At ρ = 0 there is no pattern to see. The lag view is the same information as a "
      + "scatter, and the line drawn through it is ρ̂ itself."));

    draw();
  });

  /* ============================================================
     Unit 2D — Figure 2: the Durbin-Watson decision line

     The deck's slide-15 diagram, made live. The bounds are the
     tabulated 5% values for T = 60 with one explanatory variable,
     dL = 1.549 and dU = 1.616. They are bounds rather than a single
     critical value because the exact distribution of DW depends on
     the X matrix — which is also why this figure can check them:
     simulating DW under ρ = 0 for the X used here puts the true 5%
     critical value at about 1.58, comfortably between the two.
     ============================================================ */
  VIZ.register("durbin-watson-ruler", function (host) {
    var T = 60, B1 = 20, B2 = 0.6, SE = 6, DL = 1.549, DU = 1.616;
    var G = series2d(99, 0.8, 12, T);
    var R = rngSeeded(4180), EPS = [], i;
    for (i = 0; i < T; i++) EPS.push(R.gauss());
    var rho = 0.5;

    var c = chart({ w: 640, h: 210, pad: { t: 58, r: 24, b: 46, l: 24 },
                    xd: [0, 4], yd: [0, 1] });

    var ZONES = [
      { a: 0, b: DL, fill: P.accent, op: 0.30, text: "reject: positive" },
      { a: DL, b: DU, fill: P.inkFaint, op: 0.22, text: "inconclusive" },
      { a: DU, b: 4 - DU, fill: P.good, op: 0.24, text: "do not reject" },
      { a: 4 - DU, b: 4 - DL, fill: P.inkFaint, op: 0.22, text: "inconclusive" },
      { a: 4 - DL, b: 4, fill: P.accent, op: 0.30, text: "reject: negative" }
    ];
    ZONES.forEach(function (z) {
      c.plot.appendChild(s("rect", { x: c.x(z.a), y: c.y(0.62),
        width: c.x(z.b) - c.x(z.a), height: c.y(0) - c.y(0.62),
        fill: z.fill, opacity: z.op }));
    });
    /* only the wide zones can carry their label inside the band */
    [0, 2, 4].forEach(function (k) {
      var z = ZONES[k];
      var t = s("text", { x: (c.x(z.a) + c.x(z.b)) / 2, y: c.y(0.28),
                          "font-size": 11, fill: P.ink, "text-anchor": "middle" });
      t.textContent = z.text;
      c.plot.appendChild(t);
    });
    [[1, -1], [3, 1]].forEach(function (p) {
      var z = ZONES[p[0]], mid = (c.x(z.a) + c.x(z.b)) / 2;
      var t = s("text", { x: mid + p[1] * 34, y: c.y(0.80), "font-size": 10.5,
                          fill: P.inkSoft, "text-anchor": "middle" });
      t.textContent = "inconclusive";
      c.plot.appendChild(t);
      c.plot.appendChild(s("line", { x1: mid, y1: c.y(0.74), x2: mid, y2: c.y(0.64),
                                     stroke: P.inkSoft, "stroke-width": 0.8 }));
    });

    c.plot.appendChild(s("line", { x1: c.x(0), y1: c.y(0), x2: c.x(4), y2: c.y(0),
                                   stroke: P.ink, "stroke-width": 1 }));
    [[0, "0"], [DL, "d" + "ₗ"], [DU, "d" + "ᵤ"], [2, "2"],
     [4 - DU, "4−d" + "ᵤ"], [4 - DL, "4−d" + "ₗ"], [4, "4"]].forEach(function (tk) {
      c.plot.appendChild(s("line", { x1: c.x(tk[0]), y1: c.y(0), x2: c.x(tk[0]), y2: c.y(-0.06),
                                     stroke: P.ink, "stroke-width": 1 }));
      var t = s("text", { x: c.x(tk[0]), y: c.y(0) + 20, "font-size": 11,
                          fill: P.inkSoft, "text-anchor": "middle" });
      t.textContent = tk[1];
      c.plot.appendChild(t);
    });

    var mark = s("path", { fill: P.accent2, stroke: P.paper, "stroke-width": 1.2 });
    c.plot.appendChild(mark);
    var mlab = s("text", { "font-size": 12, fill: P.accent2, "text-anchor": "middle",
                           "font-weight": "600" });
    c.plot.appendChild(mlab);

    function decide(dw) {
      if (dw < DL) return "reject — evidence of positive autocorrelation";
      if (dw <= DU) return "inconclusive — the test cannot say";
      if (dw < 4 - DU) return "do not reject — no evidence either way";
      if (dw <= 4 - DL) return "inconclusive — the test cannot say";
      return "reject — evidence of negative autocorrelation";
    }

    function draw() {
      var u = [], prev = 0, t;
      for (t = 0; t < T; t++) { prev = rho * prev + SE * EPS[t]; u.push(prev); }
      var Y = [];
      for (t = 0; t < T; t++) Y.push(B1 + B2 * G.X[t] + u[t]);
      var m = tsfit(G.X, Y), px = c.x(Math.max(0, Math.min(4, m.dw))), py = c.y(0.66);
      mark.setAttribute("d", "M " + px + " " + py + " l 7 -11 l -14 0 Z");
      mlab.setAttribute("x", px);
      mlab.setAttribute("y", py - 15);
      mlab.textContent = "DW = " + m.dw.toFixed(2);

      left.textContent = "ρ = " + rho.toFixed(2)
                       + "    ρ̂ = " + m.rhat.toFixed(3)
                       + "    2(1 − ρ̂) = " + (2 * (1 - m.rhat)).toFixed(2)
                       + "    DW = " + m.dw.toFixed(2);
      right.textContent = decide(m.dw);
      c.svg.setAttribute("aria-label",
        "A nought-to-four scale divided into five decision zones with the Durbin-Watson "
        + "statistic marked at " + m.dw.toFixed(2) + ": " + decide(m.dw) + ".");
    }

    var controls = h("div", "viz-controls");
    var lab = h("label", null, "ρ — the autocorrelation coefficient");
    var rn = document.createElement("input");
    rn.type = "range"; rn.min = "-0.9"; rn.max = "0.9"; rn.step = "0.05"; rn.value = "0.5";
    rn.addEventListener("input", function () { rho = +rn.value; draw(); });
    lab.appendChild(rn);
    controls.appendChild(lab);
    var left = h("span", "viz-readout");
    var right = h("span", "viz-readout");
    controls.appendChild(left);
    controls.appendChild(right);

    host.appendChild(c.svg);
    host.appendChild(controls);
    host.appendChild(h("p", "viz-caption",
      "The bounds are the tabulated 5% values for T = 60 with one explanatory variable. Watch "
      + "the two readouts move together: DW tracks 2(1 − ρ̂) to within a hundredth all the way "
      + "across, which is the approximation the derivation promises. Two things are worth "
      + "noticing. The test is far more sensitive than it looks — ρ̂ only has to reach about "
      + "0.19 before DW drops past dU. And the grey bands are real: between dL and dU the test "
      + "returns no verdict at all, which is the limitation that eventually cost the "
      + "Durbin–Watson test its place as the default and is why Breusch–Godfrey, which has an "
      + "ordinary rejection region, replaced it."));

    draw();
  });

  /* ============================================================
     Unit 2D — Figure 3: the standard error is not merely wrong

     Heteroscedasticity in 2C took the reported standard error down
     to about three-quarters of the truth. Autocorrelation is far
     worse: with a persistent regressor and ρ = 0.9 the reported
     figure is under a third of the truth, so t-ratios are inflated
     threefold and a 5% test rejects a great deal more often.

     The theoretical curve is Gujarati's expression,

       var(β̂2) = σ²/Σx² · [ 1 + 2Σ ρˢ (Σ xₜxₜ₋ₛ)/Σx² ]

     computed term by term, and the simulation has to land on it.
     ============================================================ */
  VIZ.register("autocorrelation-se-bias", function (host) {
    var T = 60, B1 = 20, B2 = 0.6, SE = 6, RUNS = 400, HI = 0.9;
    var G = series2d(99, 0.8, 12, T);
    var rho = 0.6;

    /* the exact finite-sample variance under AR(1) errors */
    function theory(r) {
      var sig2 = SE * SE / (1 - r * r), br = 1, sgap, t;
      for (sgap = 1; sgap < T; sgap++) {
        var cx = 0;
        for (t = sgap; t < T; t++) cx += G.x[t] * G.x[t - sgap];
        br += 2 * Math.pow(r, sgap) * cx / G.sxx;
      }
      return Math.sqrt(Math.max(sig2 / G.sxx * br, 0));
    }

    function study(r) {
      var R = rngSeeded(20250830), sum = 0, sq = 0, srep = 0, q, t;
      for (q = 0; q < RUNS; q++) {
        var prev = 0, Y = [];
        for (t = 0; t < T; t++) {
          prev = r * prev + SE * R.gauss();
          Y.push(B1 + B2 * G.X[t] + prev);
        }
        var m = tsfit(G.X, Y), rss = 0;
        for (t = 0; t < T; t++) rss += m.e[t] * m.e[t];
        sum += m.b2; sq += m.b2 * m.b2;
        srep += Math.sqrt((rss / (T - 2)) / m.sxx);
      }
      var mean = sum / RUNS;
      var v = (sq - RUNS * mean * mean) / (RUNS - 1);
      return { mc: Math.sqrt(Math.max(v, 0)), rep: srep / RUNS,
               theory: theory(r), mean: mean };
    }

    var c = chart({ w: 640, h: 350, pad: { t: 30, r: 20, b: 46, l: 62 },
                    xd: [0, HI], yd: [0, 0.36] });
    c.axes("ρ — the autocorrelation coefficient", "standard error of β̂₂");

    var grid = [], k;
    for (k = 0; k <= 30; k++) grid.push({ r: HI * k / 30, v: study(HI * k / 30) });
    var series = [
      { key: "theory", colour: P.ink,    label: "true SE, from the AR(1) formula", dash: "5 4" },
      { key: "mc",     colour: P.good,   label: "spread of β̂₂ over 400 samples",   dash: null },
      { key: "rep",    colour: P.accent, label: "standard error OLS actually reports", dash: null }
    ];
    series.forEach(function (sr, n) {
      var dp = "";
      grid.forEach(function (g, m) {
        dp += (m ? " L " : "M ") + c.x(g.r) + " " + c.y(Math.min(g.v[sr.key], 0.36));
      });
      c.plot.appendChild(s("path", { d: dp, fill: "none", stroke: sr.colour,
                                     "stroke-width": sr.dash ? 2 : 2.4,
                                     "stroke-dasharray": sr.dash }));
      sr.dot = s("circle", { r: 4.5, fill: sr.colour, stroke: P.paper, "stroke-width": 1.4 });
      c.plot.appendChild(sr.dot);
      var t = s("text", { x: c.x(0.02), y: 15 + n * 14, "font-size": 11, fill: sr.colour });
      t.textContent = sr.label;
      c.plot.appendChild(t);
    });

    function draw() {
      var v = study(rho);
      series.forEach(function (sr) {
        sr.dot.setAttribute("cx", c.x(rho));
        sr.dot.setAttribute("cy", c.y(Math.min(v[sr.key], 0.36)));
      });
      left.textContent = "ρ = " + rho.toFixed(2)
                       + "    true SE " + v.theory.toFixed(4)
                       + "    simulated " + v.mc.toFixed(4)
                       + "    mean β̂₂ = " + v.mean.toFixed(3);
      right.textContent = "OLS reports " + v.rep.toFixed(4)
                        + " — " + (100 * v.rep / v.theory).toFixed(0) + "% of the truth"
                        + ",  so t is inflated " + (v.theory / v.rep).toFixed(1) + "×";
      c.svg.setAttribute("aria-label",
        "The reported standard error stays almost flat while the true one climbs steeply with "
        + "the autocorrelation coefficient.");
    }

    var controls = h("div", "viz-controls");
    var lab = h("label", null, "ρ — the autocorrelation coefficient");
    var rn = document.createElement("input");
    rn.type = "range"; rn.min = "0"; rn.max = "0.9"; rn.step = "0.05"; rn.value = "0.6";
    rn.addEventListener("input", function () { rho = +rn.value; draw(); });
    lab.appendChild(rn);
    controls.appendChild(lab);
    var left = h("span", "viz-readout");
    var right = h("span", "viz-readout");
    controls.appendChild(left);
    controls.appendChild(right);

    host.appendChild(c.svg);
    host.appendChild(controls);
    host.appendChild(h("p", "viz-caption",
      "Four hundred samples at each setting, with a regressor that is itself persistent, as "
      + "economic time series are. The simulated spread sits on the dashed theoretical curve "
      + "throughout, so the formula in section 4 is confirmed rather than quoted. Now look at "
      + "what OLS prints: it barely rises at all. By ρ = 0.9 the reported standard error is "
      + "under a third of the true one, so every t-ratio in the output is roughly three times "
      + "too big and a nominal 5% test is nothing of the kind. Compare Unit 2C, where "
      + "heteroscedasticity took the reported figure down to about three-quarters — "
      + "autocorrelation with a persistent regressor is much the more dangerous of the two. "
      + "And β̂₂ stays on 0.600 throughout: nothing here is biased except the reported "
      + "precision."));

    draw();
  });

  /* ============================================================
     Unit 2D — Figure 4: what the GLS transformation does

     Section 9 derives Y*ₜ = Yₜ − ρYₜ₋₁ and claims the transformed
     error is ϵₜ, which is not serially correlated. This is that
     claim, checked: the same sample before and after, with ρ̂, DW
     and the slope reported on both sides.

     Seed chosen so the underlying ϵ draw is close to serially
     uncorrelated — otherwise the "after" picture inherits whatever
     accidental pattern this particular draw of ϵ happens to have,
     and the figure demonstrates the draw rather than the method.
     ============================================================ */
  VIZ.register("gls-transformation", function (host) {
    var T = 60, B1 = 20, B2 = 0.6, SE = 6, RHO = 0.8, after = false;
    var G = series2d(99, 0.8, 12, T);
    var R = rngSeeded(57), EPS = [], i;
    for (i = 0; i < T; i++) EPS.push(R.gauss());

    var u = [], prev = 0, Y = [];
    for (i = 0; i < T; i++) { prev = RHO * prev + SE * EPS[i]; u.push(prev); }
    for (i = 0; i < T; i++) Y.push(B1 + B2 * G.X[i] + u[i]);

    /* ρ-differenced: one observation is lost, which is what
       Prais-Winsten exists to recover */
    var Xs = [], Ys = [];
    for (i = 1; i < T; i++) { Xs.push(G.X[i] - RHO * G.X[i - 1]); Ys.push(Y[i] - RHO * Y[i - 1]); }

    var RAW = tsfit(G.X, Y), TR = tsfit(Xs, Ys);

    var c = chart({ w: 640, h: 320, pad: { t: 22, r: 20, b: 46, l: 54 },
                    xd: [0, T], yd: [-1, 1] });
    c.axes("time  t", "residual  û");
    var gfx = s("g");
    c.plot.appendChild(gfx);

    function draw() {
      var m = after ? TR : RAW, n = m.e.length, t, top = 0;
      while (gfx.firstChild) gfx.removeChild(gfx.firstChild);
      for (t = 0; t < n; t++) top = Math.max(top, Math.abs(m.e[t]));
      top = top || 1;
      gfx.appendChild(s("line", { x1: c.x(0), y1: c.y(0), x2: c.x(T), y2: c.y(0),
                                  stroke: P.ruleSoft, "stroke-width": 1 }));
      var dp = "";
      for (t = 0; t < n; t++) dp += (t ? " L " : "M ") + c.x(t * T / n) + " " + c.y(m.e[t] / top);
      gfx.appendChild(s("path", { d: dp, fill: "none",
                                  stroke: after ? P.good : P.accent, "stroke-width": 1.6 }));
      for (t = 0; t < n; t++) {
        gfx.appendChild(s("circle", { cx: c.x(t * T / n), cy: c.y(m.e[t] / top), r: 2.6,
                                      fill: after ? P.good : P.accent }));
      }
      left.textContent = (after ? "transformed:  " : "original:  ")
                       + "ρ̂ = " + m.rhat.toFixed(3)
                       + "    DW = " + m.dw.toFixed(2)
                       + "    β̂₂ = " + m.b2.toFixed(3);
      right.textContent = after
        ? "DW back inside the do-not-reject zone; the slope has moved onto the true 0.600"
        : "DW = " + RAW.dw.toFixed(2) + ", far below d" + "ₗ"
          + " = 1.549 — strong positive autocorrelation";
      c.svg.setAttribute("aria-label", after
        ? "Residuals of the transformed equation, crossing zero frequently with no pattern."
        : "Residuals of the original equation, drifting on one side of zero for long stretches.");
    }

    var controls = h("div", "viz-controls");
    var tog = h("button", null, "Apply Yₜ − ρYₜ₋₁");
    tog.addEventListener("click", function () {
      after = !after;
      tog.textContent = after ? "Back to the original equation" : "Apply Yₜ − ρYₜ₋₁";
      draw();
    });
    controls.appendChild(tog);
    var left = h("span", "viz-readout");
    var right = h("span", "viz-readout");
    controls.appendChild(left);
    controls.appendChild(right);

    host.appendChild(c.svg);
    host.appendChild(controls);
    host.appendChild(h("p", "viz-caption",
      "One sample generated with ρ = 0.8. Before: the residuals drift on one side of zero for "
      + "long stretches, ρ̂ is 0.81, DW is 0.39 — well below dₗ — and the slope has landed at "
      + "0.495 against a true 0.600, which is what an unbiased but badly imprecise estimator "
      + "looks like on one draw. Press the button and the same data, ρ-differenced, produce "
      + "residuals that cross zero constantly, ρ̂ near zero, DW near 2, and a slope of 0.601. "
      + "Note what this is not: a correction applied to the output. The equation has been "
      + "rewritten in differences and re-estimated, and the price is the first observation, "
      + "which is what the Prais–Winsten refinement exists to recover. Note also that the "
      + "transformation used the true ρ, which in practice must be estimated — that gap is "
      + "the whole of feasible GLS."));

    draw();
  });

  /* ---------- boot ---------- */
  function boot() {
    palette();
    document.querySelectorAll(".viz[data-viz]").forEach(function (host) {
      var fn = registry[host.getAttribute("data-viz")];
      if (!fn) return;                    /* leave the fallback text in place */
      while (host.firstChild) host.removeChild(host.firstChild);
      try {
        fn(host);
      } catch (err) {
        host.appendChild(h("p", "viz-fallback",
          "This figure could not be drawn in your browser."));
        if (window.console) console.error("viz:", err);
      }
    });
  }

  /* Called by assets/reader.js when the theme changes. Figures are
     rebuilt from scratch rather than recoloured in place — they hold
     their own state in closures, and a theme switch is rare enough
     that resetting a slider is a fair price for not threading a
     colour-update path through all nineteen of them. */
  VIZ.redraw = boot;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
