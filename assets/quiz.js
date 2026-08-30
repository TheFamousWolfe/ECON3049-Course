/* ============================================================
   ECON3049 — Reusable quiz widget
   Retrieval practice with immediate, automatic feedback.

   Markup contract (kept minimal so any lesson can reuse it):

   <div class="quiz" data-answer="1">
     <div class="q">Question text?</div>
     <button class="opt">First option</button>
     <button class="opt">Second option (correct, index 1)</button>
     <button class="opt">Third option</button>
     <div class="feedback right">Shown when correct.</div>
     <div class="feedback wrong">Shown when wrong — explain WHY.</div>
   </div>

   data-answer is the 0-based index of the correct .opt.
   Keep all options the SAME length (no formatting tells).
   ============================================================ */
(function () {
  function initQuiz(quiz) {
    var answer = parseInt(quiz.getAttribute("data-answer"), 10);
    var opts = Array.prototype.slice.call(quiz.querySelectorAll(".opt"));
    var fbRight = quiz.querySelector(".feedback.right");
    var fbWrong = quiz.querySelector(".feedback.wrong");

    opts.forEach(function (opt, i) {
      opt.addEventListener("click", function () {
        // lock all options after first answer
        opts.forEach(function (o) { o.disabled = true; });
        if (i === answer) {
          opt.classList.add("correct");
          if (fbRight) fbRight.classList.add("show");
        } else {
          opt.classList.add("incorrect");
          opts[answer].classList.add("correct");
          if (fbWrong) fbWrong.classList.add("show");
        }
      });
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll(".quiz").forEach(initQuiz);
  });
})();
