/* ============================================================
   ECON 3049 — Download a unit as Word, Markdown or LaTeX

   PDF is not handled here: the print stylesheet already produces a
   good page, so the PDF button just calls window.print() and lets the
   browser do it. That is genuinely the better route — the browser's
   own PDF engine beats anything reconstructable from the DOM, and it
   respects whatever the reader has expanded on screen.

   The other three walk the rendered page and re-emit it. What that
   can and cannot do, stated plainly so nobody is surprised:

     Word (.doc)  An HTML document served as application/msword. Word
                  and Google Docs both open it and keep the headings,
                  emphasis, lists and tables. It is not a real .docx —
                  Word may warn that the extension does not match the
                  format. Figures become a note, not a picture.

     Markdown     Clean. Subscripts and superscripts become Unicode
                  (β₂, X₂ᵢ, R²) so they survive in any editor.

     LaTeX        A scaffold, not a finished document. Structure,
                  lists, tables and Greek letters convert reliably;
                  displayed equations come across as readable maths but
                  will want a pass by hand, because the source they are
                  built from is styled HTML rather than real LaTeX.

   Interactive figures cannot be exported and are replaced by a named
   placeholder pointing back at the web version.
   ============================================================ */
(function () {
  /* ---------- Unicode subscripts and superscripts ---------- */
  var SUB = { "0":"₀","1":"₁","2":"₂","3":"₃","4":"₄","5":"₅","6":"₆","7":"₇",
              "8":"₈","9":"₉","i":"ᵢ","j":"ⱼ","k":"ₖ","t":"ₜ","n":"ₙ","R":"R",
              "+":"₊","-":"₋","=":"₌","(":"₍",")":"₎","a":"ₐ","x":"ₓ" };
  var SUP = { "0":"⁰","1":"¹","2":"²","3":"³","4":"⁴","5":"⁵","6":"⁶","7":"⁷",
              "8":"⁸","9":"⁹","+":"⁺","-":"⁻","n":"ⁿ","i":"ⁱ","*":"*" };
  function uni(text, map) {
    return text.split("").map(function (c) { return map[c] || c; }).join("");
  }

  /* ---------- Greek, operators and accents, for LaTeX ----------
     The page's maths is styled HTML carrying literal Unicode: "β̂₂" is
     a beta, a combining circumflex and a <sub>. Passed through raw,
     none of it compiles under pdfLaTeX — so every symbol is mapped to
     a real command, and a base character followed by a combining mark
     becomes \hat{}, \bar{} or \tilde{}. */
  var TEX_CHAR = {
    "β":"\\beta","α":"\\alpha","γ":"\\gamma","δ":"\\delta","ε":"\\epsilon",
    "σ":"\\sigma","μ":"\\mu","ρ":"\\rho","χ":"\\chi","λ":"\\lambda","π":"\\pi",
    "θ":"\\theta","φ":"\\phi","ω":"\\omega","η":"\\eta","τ":"\\tau",
    "Σ":"\\sum","Δ":"\\Delta","Ω":"\\Omega","∂":"\\partial","√":"\\surd",   /* not \\sqrt: there is no radicand to brace */
    "≈":"\\approx","≠":"\\neq","≤":"\\leq","≥":"\\geq","±":"\\pm",
    "≫":"\\gg","≪":"\\ll",
    "⟹":"\\Rightarrow","⇒":"\\Rightarrow","→":"\\to","←":"\\leftarrow",
    "×":"\\times","·":"\\cdot","∼":"\\sim","∞":"\\infty","≡":"\\equiv",
    "∈":"\\in","∀":"\\forall","∫":"\\int","…":"\\dots","⋯":"\\cdots",
    "′":"'","″":"''","−":"-","—":"---","–":"--",
    "“":"``","”":"''","‘":"`","’":"'","\u00a0":" "
  };
  var ACCENT = { "̂": "hat", "̃": "tilde", "̄": "bar",
                 "̅": "bar", "̇": "dot" };
  /* precomposed forms that may appear instead of base + combining mark */
  var PRECOMPOSED = { "Ŷ":"\\hat{Y}", "ŷ":"\\hat{y}", "û":"\\hat{u}",
                      "Ȳ":"\\bar{Y}", "X̄":"\\bar{X}", "ū":"\\bar{u}" };

  /* Unicode sub/superscript characters, in case any appear literally */
  var UNSUB = { "₀":"0","₁":"1","₂":"2","₃":"3","₄":"4","₅":"5","₆":"6",
                "₇":"7","₈":"8","₉":"9","ᵢ":"i","ⱼ":"j","ₖ":"k","ₜ":"t",
                "ₙ":"n","ₐ":"a","ₓ":"x","₊":"+","₋":"-" };
  var UNSUP = { "⁰":"0","¹":"1","²":"2","³":"3","⁴":"4","⁵":"5","⁶":"6",
                "⁷":"7","⁸":"8","⁹":"9","⁺":"+","⁻":"-","ⁿ":"n","ⁱ":"i" };

  function texEscape(s) {
    return s.replace(/([&%$#_{}])/g, "\\$1").replace(/\^/g, "\\textasciicircum{}");
  }

  /* Convert a run of text to LaTeX. In math mode the symbols are emitted
     bare; in text mode they are wrapped in $…$, with consecutive symbols
     sharing one pair. */
  function texRun(str, mathMode) {
    var out = "", pend = "";
    function flush() {
      if (!pend) return;
      out += mathMode ? pend : "$" + pend.trim() + "$";
      pend = "";
    }
    for (var i = 0; i < str.length; i++) {
      var c = str[i], next = str[i + 1];

      if (PRECOMPOSED[c]) { pend += PRECOMPOSED[c] + " "; continue; }

      /* base character carrying one or more combining accents, applied
         inner to outer: "Ȳ̂" (Y + macron + circumflex) is \hat{\bar{Y}} */
      if (next && ACCENT[next]) {
        var base = TEX_CHAR[c] || texEscape(c);
        var j = i + 1;
        while (str[j] && ACCENT[str[j]]) {
          base = "\\" + ACCENT[str[j]] + "{" + base + "}";
          j++;
        }
        pend += base;
        i = j - 1;
        continue;
      }
      /* a combining mark with nothing to attach to: drop it rather than
         emit a byte LaTeX cannot read */
      if (ACCENT[c]) continue;
      if (UNSUB[c]) { pend += "_{" + UNSUB[c] + "}"; continue; }
      if (UNSUP[c]) { pend += "^{" + UNSUP[c] + "}"; continue; }
      if (TEX_CHAR[c]) { pend += TEX_CHAR[c] + " "; continue; }

      if (mathMode) {
        pend += (/[&%$#_{}]/.test(c) ? "\\" + c : c);
      } else {
        flush();
        out += texEscape(c);
      }
    }
    flush();
    return out;
  }
  function texChars(s) { return texRun(s, false); }

  /* A displayed equation, walked as maths rather than as prose. */
  function texMath(node) {
    function go(n) {
      if (n.nodeType === 3) return texRun(n.nodeValue.replace(/\s+/g, " "), true);
      if (n.nodeType !== 1) return "";
      var tag = n.tagName.toLowerCase();
      var inner = Array.prototype.map.call(n.childNodes, go).join("");
      if (tag === "sub") return "_{" + inner.trim() + "}";
      if (tag === "sup") return "^{" + inner.trim() + "}";
      if (tag === "strong" || tag === "b") return "\\mathbf{" + inner + "}";
      if (tag === "span" && /\bsmall\b/.test(n.className || "")) {
        return "\\quad \\text{" + n.textContent.replace(/[{}]/g, "") + "}";
      }
      return inner;
    }
    return Array.prototype.map.call(node.childNodes, go).join("")
             .replace(/\s+/g, " ").trim();
  }

  /* ---------- inline runs ---------- */
  function inline(node, fmt) {
    if (node.nodeType === 3) {
      var t = node.nodeValue.replace(/\s+/g, " ");
      return fmt === "tex" ? texChars(t) : t;
    }
    if (node.nodeType !== 1) return "";
    var kids = function () {
      return Array.prototype.map.call(node.childNodes, function (c) {
        return inline(c, fmt);
      }).join("");
    };
    var tag = node.tagName.toLowerCase();
    var raw = node.textContent.replace(/\s+/g, " ");

    if (tag === "sub") {
      if (fmt === "tex") return "\\textsubscript{" + texChars(raw) + "}";
      return uni(raw, SUB);
    }
    if (tag === "sup") {
      if (fmt === "tex") return "\\textsuperscript{" + texChars(raw) + "}";
      return uni(raw, SUP);
    }
    if (tag === "strong" || tag === "b") {
      return fmt === "tex" ? "\\textbf{" + kids() + "}" : "**" + kids() + "**";
    }
    if (tag === "em" || tag === "i") {
      return fmt === "tex" ? "\\emph{" + kids() + "}" : "*" + kids() + "*";
    }
    if (tag === "code") {
      return fmt === "tex" ? "\\texttt{" + kids() + "}" : "`" + raw + "`";
    }
    if (tag === "a") {
      var href = node.getAttribute("href") || "";
      if (fmt === "tex") return kids();
      if (/^https?:/.test(href)) return "[" + kids() + "](" + href + ")";
      return kids();                      /* internal links mean nothing offline */
    }
    if (tag === "br") return fmt === "tex" ? " \\\\\n" : "  \n";
    return kids();
  }

  /* ---------- block level ----------
     The walker writes into a sink array rather than returning, so a
     container (a box, a tutorial answer) can collect its children into
     its own sink and then wrap the result.

     The important rule: an element that is not one of the recognised
     blocks still has its loose text collected into an inline buffer.
     Boxes and assumption grids carry their body as bare text nodes
     between spans, and an earlier version of this walker dropped all
     of it — several thousand words per unit — because it only ever
     recursed looking for known tags. Never discard a text node.
     ---------------------------------------------------------------- */
  var BLOCKISH = /^(p|ul|ol|table|h1|h2|h3|h4|div|details|section|dl|blockquote|figure)$/;

  function blocks(root, fmt) {
    var out = [];

    function heading(text, depth) {
      if (fmt === "tex") {
        var cmd = depth === 1 ? "section*" : depth === 2 ? "section" : "subsection";
        return "\\" + cmd + "{" + text + "}";
      }
      return "#".repeat(depth) + " " + text;
    }
    function bold(t) { return fmt === "tex" ? "\\textbf{" + t + "}" : "**" + t + "**"; }
    function quote(lines) {
      if (fmt === "tex") {
        return "\\begin{quote}\n" + lines.join("\n\n") + "\n\\end{quote}";
      }
      return lines.join("\n\n").split("\n").map(function (l) {
        return l ? "> " + l : ">";
      }).join("\n");
    }

    function classOf(node) {
      var c = node.className;
      return (typeof c === "string") ? c : "";
    }
    function isBlock(node) {
      return node.nodeType === 1 && BLOCKISH.test(node.tagName.toLowerCase());
    }

    function walk(node, sink) {
      if (node.nodeType !== 1) return;
      var tag = node.tagName.toLowerCase();
      var cls = classOf(node);

      if (tag === "script" || tag === "style" || tag === "button" || tag === "summary") return;
      if (/reader-bar|lesson-nav|masthead|ask-teacher|deck-link|viz-controls|viz-caption|viz-fallback|g-tools|g-index/.test(cls)) return;
      /* the subtitle and the unit-meta line are already in the header */
      if (/\b(subtitle|unit-meta)\b/.test(cls)) return;

      function push(t) { if (t && t.trim()) sink.push(t.trim()); }

      if (tag === "h1") { push(heading(inline(node, fmt), 1)); return; }
      if (tag === "h2") { push(heading(inline(node, fmt), 2)); return; }
      if (tag === "h3" || tag === "h4") { push(heading(inline(node, fmt), 3)); return; }

      /* ---- interactive figure: cannot travel ---- */
      if (/\bviz\b/.test(cls)) {
        var name = node.getAttribute("data-viz") || "figure";
        push(fmt === "tex"
          ? "\\begin{quote}\\emph{Interactive figure `" + texEscape(name)
            + "' --- see the web version.}\\end{quote}"
          : "> **Interactive figure** (`" + name + "`) — see the web version.");
        return;
      }

      /* ---- reported equation ---- */
      if (/\beqn-report\b/.test(cls)) {
        var cols = node.querySelectorAll(".er-col");
        var rows = [[], [], []];
        Array.prototype.forEach.call(cols, function (col) {
          for (var r = 0; r < 3; r++) {
            rows[r].push(col.children[r] ? inline(col.children[r], "md").trim() : "");
          }
        });
        var note = node.querySelector(".er-note");
        var lines = rows.map(function (r) { return r.join(" ").replace(/\s+/g, " ").trim(); })
                        .filter(Boolean);
        if (fmt === "tex") {
          var w = rows[0].length;
          var body = rows.filter(function (r) {
            return r.join("").trim();
          }).map(function (r) {
            return r.map(function (cell) { return texRun(cell, false); }).join(" & ");
          }).join(" \\\\\n");
          var tx = "\\begin{tabular}{" + "l".repeat(w) + "}\n" + body + "\n\\end{tabular}";
          if (note) tx += "\n\n" + texRun(inline(note, "md").trim(), false);
          push(tx);
        } else {
          if (note) lines.push(inline(note, "md").trim());
          push("```\n" + lines.join("\n") + "\n```");
        }
        return;
      }

      /* ---- a callout box: label, then its body, as a quote ---- */
      if (/\bbox\b/.test(cls)) {
        var lbl = node.querySelector(".box-label");
        var inner = [];
        collectChildren(node, inner, function (c) {
          return c.nodeType === 1 && /\bbox-label\b/.test(classOf(c));
        });
        var head = lbl ? bold(inline(lbl, fmt).trim()) : "";
        push(quote((head ? [head] : []).concat(inner)));
        return;
      }

      /* ---- one row of an assumption grid ---- */
      if (/\bag-item\b/.test(cls)) {
        var marker = node.querySelector(".ag-n");
        var body = [];
        collectChildren(node, body, function (c) {
          return c.nodeType === 1 && /\bag-n\b/.test(classOf(c));
        });
        var m = marker ? inline(marker, fmt).trim() : "•";
        var text = body.join(" ").replace(/\s+/g, " ").trim();
        push(fmt === "tex" ? "\\textbf{" + m + "} " + text : "- **" + m + "** " + text);
        return;
      }

      /* ---- revealable solution ---- */
      if (tag === "details") {
        var sum = node.querySelector("summary");
        var kid = [];
        collectChildren(node, kid, function (c) {
          return c.nodeType === 1 && c.tagName.toLowerCase() === "summary";
        });
        push(bold(sum ? inline(sum, fmt).trim() : "Solution"));
        kid.forEach(push);
        return;
      }

      /* ---- self-test ---- */
      if (/\bquiz\b/.test(cls)) {
        var q = node.querySelector(".q");
        var opts = node.querySelectorAll(".opt");
        var ans = parseInt(node.getAttribute("data-answer"), 10);
        var lines2 = [bold("Self-test") + " " + (q ? inline(q, fmt) : "")];
        Array.prototype.forEach.call(opts, function (o, i) {
          lines2.push("  " + String.fromCharCode(97 + i) + ") " + inline(o, fmt)
                      + (i === ans ? (fmt === "tex" ? " \\quad$\\leftarrow$" : "  ←") : ""));
        });
        push(lines2.join("\n"));
        return;
      }

      if (tag === "p") {
        if (/\bmath\b/.test(cls)) {
          if (fmt === "tex") push("\\[\n" + texMath(node) + "\n\\]");
          else push("> " + inline(node, "md").trim());
        } else {
          push(inline(node, fmt));
        }
        return;
      }

      if (tag === "ul" || tag === "ol") {
        var n = 1, items = [];
        Array.prototype.forEach.call(node.children, function (li) {
          if (li.tagName.toLowerCase() !== "li") return;
          var sub = [];
          collectChildren(li, sub);
          if (!sub.length) return;
          var first = sub.shift();
          items.push(fmt === "tex" ? "  \\item " + first
                                   : (tag === "ol" ? (n++) + ". " : "- ") + first);
          sub.forEach(function (extra) {
            items.push(extra.split("\n").map(function (l) { return "    " + l; }).join("\n"));
          });
        });
        if (!items.length) return;
        push(fmt === "tex"
          ? "\\begin{" + (tag === "ol" ? "enumerate" : "itemize") + "}\n" + items.join("\n")
            + "\n\\end{" + (tag === "ol" ? "enumerate" : "itemize") + "}"
          : items.join("\n"));
        return;
      }

      if (tag === "dl") {
        Array.prototype.forEach.call(node.children, function (c) {
          var t = c.tagName.toLowerCase();
          if (t === "dt") push(bold(inline(c, fmt).trim()));
          else if (t === "dd") push(inline(c, fmt));
        });
        return;
      }

      if (tag === "table") {
        var trs = node.querySelectorAll("tr");
        var grid = Array.prototype.map.call(trs, function (tr) {
          return Array.prototype.map.call(tr.children, function (td) {
            var cell = inline(td, fmt === "tex" ? "tex" : "md");
            return cell.replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
          });
        });
        if (!grid.length) return;
        var width = Math.max.apply(null, grid.map(function (r) { return r.length; }));
        if (fmt === "tex") {
          push("\\begin{tabular}{" + "l".repeat(width) + "}\n\\hline\n"
             + grid.map(function (r) { return r.join(" & "); }).join(" \\\\\n")
             + " \\\\\n\\hline\n\\end{tabular}");
        } else {
          var md = ["| " + grid[0].join(" | ") + " |", "|" + " --- |".repeat(width)];
          grid.slice(1).forEach(function (r) { md.push("| " + r.join(" | ") + " |"); });
          push(md.join("\n"));
        }
        return;
      }

      /* ---- anything else: recurse, buffering loose inline runs ---- */
      collectChildren(node, sink);
    }

    /* Walk a container's children, joining consecutive inline runs into
       single paragraphs so a box body does not come out one span per line. */
    function collectChildren(node, sink, skip) {
      var buf = [];
      function flush() {
        var t = buf.join("").replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").trim();
        if (t) sink.push(t);
        buf = [];
      }
      Array.prototype.forEach.call(node.childNodes, function (c) {
        if (skip && skip(c)) return;
        if (c.nodeType === 1 && isBlock(c)) { flush(); walk(c, sink); }
        else if (c.nodeType === 3) {
          /* must go through the converter: a raw text node carries the
             Greek and the combining accents, and pdfLaTeX cannot eat them */
          var t = c.nodeValue.replace(/\s+/g, " ");
          buf.push(fmt === "tex" ? texChars(t) : t);
        }
        else if (c.nodeType === 1) { buf.push(inline(c, fmt)); }
      });
      flush();
    }

    collectChildren(root, out);
    return out.filter(function (b) { return b && b.trim(); });
  }

  /* ---------- assemble ---------- */
  function pageTitle() {
    var h1 = document.querySelector("h1");
    return (h1 ? h1.textContent : document.title).trim();
  }
  function slug() {
    var p = location.pathname.split("/").pop() || "econ3049";
    return p.replace(/\.html?$/, "") || "econ3049";
  }
  function content() {
    return document.querySelector(".wrap") || document.body;
  }

  function toMarkdown() {
    var meta = document.querySelector(".unit-meta");
    var head = ["# " + pageTitle()];
    var sub = document.querySelector(".subtitle");
    if (sub) head.push("*" + sub.textContent.trim() + "*");
    if (meta && meta.textContent.trim()) head.push("`" + meta.textContent.trim() + "`");
    head.push("Source: " + location.href);
    var body = blocks(content(), "md").filter(function (b) {
      return b.indexOf("# " + pageTitle()) !== 0;
    });
    return head.join("\n\n") + "\n\n---\n\n" + body.join("\n\n") + "\n";
  }

  function toLatex() {
    var body = blocks(content(), "tex").filter(function (b) {
      return b.indexOf("\\section*{") !== 0;
    });
    return [
      "% " + pageTitle(),
      "% Generated from " + location.href,
      "% A scaffold. The displayed equations will want a pass by hand.",
      "\\documentclass[11pt,a4paper]{article}",
      "\\usepackage[utf8]{inputenc}",
      "\\usepackage[T1]{fontenc}",
      "\\usepackage{amsmath,amssymb,booktabs,parskip}",
      "\\usepackage[margin=2.5cm]{geometry}",
      "\\title{" + texEscape(pageTitle()) + "}",
      "\\author{ECON 3049 --- Econometrics I}",
      "\\date{}",
      "",
      "\\begin{document}",
      "\\maketitle",
      "",
      body.join("\n\n"),
      "",
      "\\end{document}",
      ""
    ].join("\n");
  }

  /* Word opens HTML served as application/msword. Styles must be inline
     or in a <style> block — it will not fetch our stylesheets. */
  function toWord() {
    var clone = content().cloneNode(true);
    Array.prototype.forEach.call(
      clone.querySelectorAll(".reader-bar, .lesson-nav, .viz-controls, script, button"),
      function (n) { n.parentNode.removeChild(n); });
    Array.prototype.forEach.call(clone.querySelectorAll(".viz"), function (n) {
      var p = document.createElement("p");
      p.innerHTML = "<em>[Interactive figure &mdash; see the web version at "
                  + location.href + "]</em>";
      n.parentNode.replaceChild(p, n);
    });
    /* tutorial solutions are collapsed on screen; a downloaded copy
       should carry them, so open every one */
    Array.prototype.forEach.call(clone.querySelectorAll("details"), function (d) {
      d.setAttribute("open", "open");
    });

    var css = "body{font-family:Georgia,serif;font-size:11pt;line-height:1.5;max-width:17cm}"
      + "h1{font-size:20pt}h2{font-size:15pt;border-bottom:1px solid #999;padding-bottom:3pt}"
      + "h3{font-size:12.5pt}"
      + ".math{font-style:italic;text-align:center;margin:10pt 0}"
      + ".box{border:1px solid #999;padding:8pt;margin:10pt 0;background:#f6f6f2}"
      + ".box-label{display:block;font-weight:bold;font-size:9pt;"
      + "text-transform:uppercase;letter-spacing:.05em;margin-bottom:4pt}"
      + ".eqn-report{border-left:3pt solid #666;padding:6pt;margin:10pt 0;font-style:italic}"
      + ".er-col{display:inline-block;margin:0 4pt;text-align:center}"
      + ".er-col>span{display:block}"
      + ".tq{border-left:2pt solid #ccc;padding-left:8pt;margin:10pt 0}"
      + ".opt{display:block;margin:2pt 0}"
      + "table{border-collapse:collapse}td,th{border:1px solid #999;padding:3pt 6pt}"
      + ".ag-item{margin:4pt 0}summary{font-weight:bold}";

    return "<html xmlns:o='urn:schemas-microsoft-com:office:office' "
         + "xmlns:w='urn:schemas-microsoft-com:office:word' "
         + "xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'>"
         + "<title>" + pageTitle() + "</title><style>" + css + "</style></head><body>"
         + clone.innerHTML + "</body></html>";
  }

  var BUILD = {
    md:  { make: toMarkdown, ext: "md",  mime: "text/markdown;charset=utf-8" },
    tex: { make: toLatex,    ext: "tex", mime: "application/x-tex;charset=utf-8" },
    doc: { make: toWord,     ext: "doc", mime: "application/msword;charset=utf-8" }
  };

  window.EXPORT = {
    build: function (fmt) { return BUILD[fmt] ? BUILD[fmt].make() : ""; },
    download: function (fmt) {
      var spec = BUILD[fmt];
      if (!spec) return;
      var blob = new Blob(["\ufeff" + spec.make()], { type: spec.mime });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = slug() + "." + spec.ext;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    }
  };
})();
