/* ============================================================
   ECON 3049 — Course manifest
   THE single source of truth for course structure.

   Loaded as a plain <script src> (NOT fetched as JSON) so that
   every page works over file:// as well as over https://.
   fetch() of a local file is CORS-blocked; a script tag is not.

   nav.js reads this to render:
     - the unit roadmap on index.html
     - the masthead breadcrumb on each unit page
     - the unit-meta line (unit - week - readings - exam scope)
     - the prev/next footer

   To add or re-order a unit, edit ONLY this file.
   To re-timetable, edit the `week` fields. URLs never change.

   `reference` lists the standalone pages in reference/. They carry
   the same status field as units, so a page that has not been
   written yet renders as grey text instead of a dead link.

   status: "ready"   -> linked, green pill
           "draft"   -> linked, amber pill
           "planned" -> not linked, grey number
   week:   null      -> renders as an em dash until you set it
   ============================================================ */
window.COURSE = {
  code:        "ECON 3049",
  title:       "Econometrics I",
  tagline:     "Unit by unit, with the algebra worked and the intuition moving.",
  institution: "The University of the West Indies, Cave Hill",
  department:  "Faculty of Social Sciences · Department of Economics",
  lecturer:    "Mr. Rudolph Browne",
  email:       "rudolph.browne@cavehill.uwi.edu",
  officeHours: "Mondays & Fridays, 12:30–1:30pm, via Zoom",
  semester:    "Semester 1",

  /* --- Dates. Set these and the calendar strip fills itself in. --- */
  teachingPeriod: { start: null, end: null },   /* e.g. "1 September 2026" */

  assessment: [
    { name: "Midterm",          weight: 25, when: null,
      covers: "Units 1A–1F" },
    { name: "Group assignment", weight: 25, when: null,
      covers: "EViews analysis, groups of 3" },
    { name: "Final examination", weight: 50, when: null,
      covers: "Units 2 and 3" }
  ],

  units_meta: [
    { id: "1", title: "Classical Regression Analysis",
      note: "The midterm covers all of Unit 1." },
    { id: "2", title: "Relaxing the Assumptions of the OLS Regression Model",
      note: "Examinable on the final." },
    { id: "3", title: "Special Topics in Econometrics",
      note: "Examinable on the final." }
  ],

  /* If you host the original decks (e.g. on eLearning), put the folder
     URL here and every unit page grows a "download the slides" link.
     Left null, the slide count still shows but nothing is linked. */
  deckBaseUrl: null,

  /* --- Standalone reference pages, reference/<slug>.html --- */
  reference: [
    { slug: "eviews-guide",  title: "EViews guide",
      blurb: "The software the group assignment is graded on.",
      status: "planned" },
    { slug: "formula-sheet", title: "Formula sheet",
      blurb: "Every result derived in the units, on one page.",
      status: "planned" },
    { slug: "glossary",      title: "Glossary",
      blurb: "Every term defined in the units, with a link back to where it was defined.",
      status: "ready" }
  ],

  units: [
    { unit: "1A", part: "1", week: 1, slug: "1a-introducing-econometrics",
      title: "Introducing Econometrics",
      blurb: "What econometrics is for, and why every economic relationship needs an error term.",
      wooldridge: "Ch. 1", gujarati: "Ch. 1", slides: 22,
      deck: "Unit 1A_Introducing Econometrics.pdf", status: "ready" },

    { unit: "1B", part: "1", week: 1, slug: "1b-simple-linear-regression",
      title: "Simple Linear Regression",
      blurb: "The two-variable model, and how OLS picks the line that fits best.",
      wooldridge: "Ch. 2", gujarati: "Ch. 2–3", slides: 39,
      deck: "Unit 1B_Simple Linear Regression.pdf", status: "ready" },

    { unit: "1C", part: "1", week: null, slug: "1c-ols-assumptions-goodness-of-fit",
      title: "OLS Assumptions and Goodness of Fit",
      blurb: "What OLS needs in order to be trusted, and how much of Y the model actually explains.",
      wooldridge: "Ch. 2–3", gujarati: "Ch. 3", slides: 29,
      deck: "Unit 1C - OLS Assumptions, Goodness of Fit.pdf", status: "ready" },

    { unit: "1D", part: "1", week: null, slug: "1d-multiple-regression",
      title: "Multiple Regression",
      blurb: "Holding other things equal — several regressors at once, and what a partial slope means.",
      wooldridge: "Ch. 3", gujarati: "Ch. 7", slides: 23,
      deck: "UNIT 1D - Multiple Regression.pdf", status: "ready" },

    { unit: "1E", part: "1", week: null, slug: "1e-normality-maximum-likelihood",
      title: "The Normality Assumption and Maximum Likelihood",
      blurb: "Adding a distribution to the error term, and a second route to the same estimates.",
      wooldridge: "Ch. 4 · App. E", gujarati: "Ch. 4", slides: 15,
      deck: "Unit 1E ~ Normality Assumption and Maximum Likelihood.pdf", status: "ready" },

    { unit: "1F", part: "1", week: null, slug: "1f-statistical-inference",
      title: "Statistical Inference and Hypothesis Testing",
      blurb: "t-tests, confidence intervals and F-tests — deciding what the data will support.",
      wooldridge: "Ch. 4", gujarati: "Ch. 5 · 8", slides: 45,
      deck: "Unit 1F - Statistical Inference  Hypothesis Testing.pdf", status: "ready" },

    { unit: "2A Part 1", part: "2", week: null, slug: "2a-part1-specification",
      title: "Specification: Choice of Explanatory Variables",
      blurb: "Omitting a variable that matters, including one that does not, and the cost of each.",
      wooldridge: "Ch. 3 · 9", gujarati: "Ch. 13", slides: 31,
      deck: "Unit 2A Part 1 - Specification_Choice of Explanatory Variables.pdf", status: "ready" },

    { unit: "2A Part 2", part: "2", week: null, slug: "2a-part2-functional-form",
      title: "Misspecification: Functional Form",
      blurb: "Logs, quadratics and the RESET test — getting the shape of the relationship right.",
      wooldridge: "Ch. 6 · 9", gujarati: "Ch. 13", slides: 24,
      deck: "UNIT 2A Part 2 - Misspecification Functional Form.pdf", status: "ready" },

    { unit: "2B", part: "2", week: null, slug: "2b-multicollinearity",
      title: "Multicollinearity",
      blurb: "When regressors move together, and why the standard errors blow up.",
      wooldridge: "Ch. 3", gujarati: "Ch. 10", slides: 22,
      deck: "UNIT 2B - Multicollinearity.pdf", status: "ready" },

    { unit: "2C", part: "2", week: null, slug: "2c-heteroscedasticity",
      title: "Heteroscedasticity",
      blurb: "Non-constant error variance: detecting it, and the four ways to live with it.",
      wooldridge: "Ch. 8", gujarati: "Ch. 11", slides: 32,
      deck: "UNIT 2C - Heteroscedasticity.pdf", status: "planned" },

    { unit: "2D", part: "2", week: null, slug: "2d-autocorrelation",
      title: "Autocorrelation",
      blurb: "Errors that remember the last period — Durbin–Watson, Breusch–Godfrey and the remedies.",
      wooldridge: "Ch. 12", gujarati: "Ch. 12", slides: 25,
      deck: "UNIT 2D - Autocorrelation.pdf", status: "planned" },

    { unit: "3A", part: "3", week: null, slug: "3a-qualitative-variables",
      title: "Qualitative Variables",
      blurb: "Dummies for categories, interactions for slopes, and the trap of the dummy variable.",
      wooldridge: "Ch. 7", gujarati: "Ch. 9", slides: 19,
      deck: "Unit 3A - Qualitative Variables.pdf", status: "planned" },

    { unit: "3B", part: "3", week: null, slug: "3b-endogeneity",
      title: "Endogeneity",
      blurb: "When X is correlated with the error, OLS is biased and stays biased.",
      wooldridge: "Ch. 15", gujarati: "Ch. 17 · 19", slides: 33,
      deck: "Unit 3B - Endogeniety.pdf", status: "planned" },

    { unit: "3C", part: "3", week: null, slug: "3c-iv-2sls-simultaneous-equations",
      title: "IV, Two-Stage Least Squares and Simultaneous Equations",
      blurb: "Instruments as the way out, and systems where Y and X determine each other.",
      wooldridge: "Ch. 15 · 16", gujarati: "Ch. 18–20", slides: 35,
      deck: "Unit 3B - IV, Two-Stage Least Square, Simultaneous Equations.pdf", status: "planned" }
  ]
};
