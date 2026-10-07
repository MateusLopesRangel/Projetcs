// Shared behaviour for every page: mobile menu, active link, page transition,
// custom cursor and copy buttons.
(function () {
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Mobile menu
  var toggle = document.querySelector(".nav-toggle");
  var links = document.querySelector(".nav-links");
  if (toggle && links) {
    toggle.addEventListener("click", function () {
      var open = links.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  // Mark the current page in the nav (project pages count as "Projects")
  var page = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  if (page.indexOf("project-") === 0) page = "projects.html";
  document.querySelectorAll(".nav-links a").forEach(function (a) {
    if ((a.getAttribute("href") || "").toLowerCase() === page) a.setAttribute("aria-current", "page");
  });

  // Short fade when leaving to another page of the site
  document.querySelectorAll("a[data-nav]").forEach(function (a) {
    a.addEventListener("click", function (e) {
      var href = a.getAttribute("href");
      if (!href || href.charAt(0) === "#" || e.metaKey || e.ctrlKey || e.shiftKey || reduceMotion) return;
      e.preventDefault();
      document.body.classList.add("page-exit");
      setTimeout(function () { location.href = href; }, 150);
    });
  });
  window.addEventListener("pageshow", function () { document.body.classList.remove("page-exit"); });

  // Custom cursor: a dot on the pointer and a ring that trails behind it
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  if (finePointer) {
    var dot = document.createElement("div");
    var ring = document.createElement("div");
    dot.className = "cursor-dot";
    ring.className = "cursor-ring";
    dot.setAttribute("aria-hidden", "true");
    ring.setAttribute("aria-hidden", "true");
    document.body.append(dot, ring);

    var mx = -100, my = -100, rx = -100, ry = -100;
    document.addEventListener("mousemove", function (e) {
      mx = e.clientX; my = e.clientY;
      dot.style.transform = "translate(" + mx + "px," + my + "px) translate(-50%,-50%)";
      if (!document.body.classList.contains("has-cursor")) {
        rx = mx; ry = my;
        document.body.classList.add("has-cursor");
      }
    });
    document.addEventListener("mouseleave", function () { document.body.classList.remove("has-cursor"); });

    (function follow() {
      var k = reduceMotion ? 1 : 0.16;
      rx += (mx - rx) * k;
      ry += (my - ry) * k;
      ring.style.transform = "translate(" + rx + "px," + ry + "px) translate(-50%,-50%)";
      requestAnimationFrame(follow);
    })();

    document.addEventListener("mouseover", function (e) {
      var hit = e.target.closest && e.target.closest("a, button, summary, .card");
      ring.classList.toggle("hover", !!hit);
    });
  }

  // Copy buttons (contact page)
  document.querySelectorAll("[data-copy]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var text = btn.getAttribute("data-copy");
      var done = function () { btn.textContent = "Copied"; setTimeout(function () { btn.textContent = "Copy"; }, 1600); };
      var fallback = function () {
        var target = document.getElementById(btn.getAttribute("aria-controls"));
        if (!target) return;
        var range = document.createRange();
        range.selectNodeContents(target);
        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        btn.textContent = "Selected, press Ctrl+C";
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, fallback);
      } else {
        fallback();
      }
    });
  });
})();
