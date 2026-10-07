// Draws the Endurance lap exported from SimulaVolta.m (window.TRACK):
//  - hero: track map colored by speed, a car replaying the lap, live channels and a speed trace
//  - project page: a static speed-vs-distance chart with axes
(function () {
  var T = window.TRACK;
  if (!T) return;

  var n = T.x.length;
  var vMin = Math.min.apply(null, T.v);
  var vMax = Math.max.apply(null, T.v);
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Elapsed time at each point, from ds / v (trapezoid on speed)
  var t = [0];
  for (var i = 1; i < n; i++) {
    var ds = T.s[i] - T.s[i - 1];
    var vAvg = Math.max(0.5, (T.v[i] + T.v[i - 1]) / 2 / 3.6);
    t.push(t[i - 1] + ds / vAvg);
  }
  var tEnd = t[n - 1];

  function token(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }
  function hexToRgb(h) {
    h = h.replace("#", "");
    if (h.length === 3) h = h.split("").map(function (c) { return c + c; }).join("");
    var num = parseInt(h, 16);
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
  }
  function mix(a, b, k) {
    return "rgb(" + Math.round(a[0] + (b[0] - a[0]) * k) + "," + Math.round(a[1] + (b[1] - a[1]) * k) + "," + Math.round(a[2] + (b[2] - a[2]) * k) + ")";
  }
  function palette() {
    return {
      slow: hexToRgb(token("--slow")),
      fast: hexToRgb(token("--accent")),
      accent: token("--accent"),
      ink: token("--ink"),
      muted: token("--muted"),
      line: token("--line"),
      surface: token("--surface"),
      mono: token("--font-mono")
    };
  }
  function speedColor(P, v) {
    return mix(P.slow, P.fast, (v - vMin) / (vMax - vMin));
  }
  function setupCanvas(canvas) {
    var r = canvas.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(r.width * dpr));
    canvas.height = Math.max(1, Math.round(r.height * dpr));
    var ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx: ctx, w: r.width, h: r.height };
  }
  function indexAtTime(time) {
    var lo = 0, hi = n - 1;
    while (hi - lo > 1) {
      var mid = (lo + hi) >> 1;
      if (t[mid] <= time) lo = mid; else hi = mid;
    }
    return lo;
  }
  function onThemeChange(fn) {
    var mq = window.matchMedia("(prefers-color-scheme: dark)");
    if (mq.addEventListener) mq.addEventListener("change", fn);
    new MutationObserver(fn).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  }

  /* ---------- Hero logger ---------- */
  var mapCanvas = document.querySelector("[data-track-map]");
  if (mapCanvas) {
    var traceCanvas = document.querySelector("[data-trace]");
    var out = {
      speed: document.querySelector("[data-ch='speed']"),
      dist: document.querySelector("[data-ch='dist']"),
      time: document.querySelector("[data-ch='time']")
    };
    var minX = Math.min.apply(null, T.x), maxX = Math.max.apply(null, T.x);
    var minY = Math.min.apply(null, T.y), maxY = Math.max.apply(null, T.y);
    var P, map, trace, staticMap, staticTrace, project;

    function layout() {
      P = palette();
      map = setupCanvas(mapCanvas);
      var pad = 26;
      var sc = Math.min((map.w - 2 * pad) / (maxX - minX), (map.h - 2 * pad) / (maxY - minY));
      var ox = (map.w - (maxX - minX) * sc) / 2;
      var oy = (map.h - (maxY - minY) * sc) / 2;
      project = function (x, y) { return [ox + (x - minX) * sc, map.h - oy - (y - minY) * sc]; };

      // Static map layer
      staticMap = document.createElement("canvas");
      staticMap.width = mapCanvas.width; staticMap.height = mapCanvas.height;
      var c = staticMap.getContext("2d");
      var dpr = mapCanvas.width / map.w;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.lineCap = "round"; c.lineJoin = "round";
      c.strokeStyle = P.line; c.lineWidth = 13;
      c.beginPath();
      for (var i = 0; i < n; i++) { var p = project(T.x[i], T.y[i]); if (i) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); }
      c.stroke();
      c.lineWidth = 5;
      for (var j = 1; j < n; j++) {
        var a = project(T.x[j - 1], T.y[j - 1]), b = project(T.x[j], T.y[j]);
        c.strokeStyle = speedColor(P, (T.v[j - 1] + T.v[j]) / 2);
        c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke();
      }
      // Start/finish tick
      var s0 = project(T.x[0], T.y[0]), s1 = project(T.x[2], T.y[2]);
      var ang = Math.atan2(s1[1] - s0[1], s1[0] - s0[0]) + Math.PI / 2;
      c.strokeStyle = P.ink; c.lineWidth = 2;
      c.beginPath();
      c.moveTo(s0[0] + Math.cos(ang) * 11, s0[1] + Math.sin(ang) * 11);
      c.lineTo(s0[0] - Math.cos(ang) * 11, s0[1] - Math.sin(ang) * 11);
      c.stroke();
      c.fillStyle = P.muted;
      c.font = "500 10px " + P.mono;
      c.fillText("S/F", s0[0] - 8, s0[1] - 16);

      // Static trace layer
      if (traceCanvas) {
        trace = setupCanvas(traceCanvas);
        staticTrace = document.createElement("canvas");
        staticTrace.width = traceCanvas.width; staticTrace.height = traceCanvas.height;
        var d = staticTrace.getContext("2d");
        d.setTransform(dpr, 0, 0, dpr, 0, 0);
        var tp = traceProj();
        d.beginPath();
        for (var k = 0; k < n; k++) { var q = tp(T.s[k], T.v[k]); if (k) d.lineTo(q[0], q[1]); else d.moveTo(q[0], q[1]); }
        d.lineTo(tp(T.s[n - 1], vMin - 4)[0], trace.h); d.lineTo(tp(0, 0)[0], trace.h); d.closePath();
        d.globalAlpha = 0.12; d.fillStyle = P.accent; d.fill(); d.globalAlpha = 1;
        d.beginPath();
        for (var m = 0; m < n; m++) { var r = tp(T.s[m], T.v[m]); if (m) d.lineTo(r[0], r[1]); else d.moveTo(r[0], r[1]); }
        d.strokeStyle = P.ink; d.lineWidth = 1.25; d.stroke();
        d.fillStyle = P.muted; d.font = "10px " + P.mono;
        d.fillText("SPEED vs DISTANCE", 10, 14);
        d.textAlign = "right";
        d.fillText(Math.round(vMax) + " km/h", trace.w - 8, 14);
      }
    }
    function traceProj() {
      var padL = 8, padR = 8, padT = 22, padB = 10;
      var lo = vMin - 4, hi = vMax + 2;
      return function (s, v) {
        return [padL + (s / T.s[n - 1]) * (trace.w - padL - padR), padT + (1 - (v - lo) / (hi - lo)) * (trace.h - padT - padB)];
      };
    }

    function draw(time) {
      var i = indexAtTime(time);
      var j = Math.min(i + 1, n - 1);
      var k = t[j] > t[i] ? (time - t[i]) / (t[j] - t[i]) : 0;
      var x = T.x[i] + (T.x[j] - T.x[i]) * k;
      var y = T.y[i] + (T.y[j] - T.y[i]) * k;
      var v = T.v[i] + (T.v[j] - T.v[i]) * k;
      var s = T.s[i] + (T.s[j] - T.s[i]) * k;

      var c = map.ctx;
      c.clearRect(0, 0, map.w, map.h);
      c.drawImage(staticMap, 0, 0, map.w, map.h);
      var p = project(x, y);
      c.beginPath(); c.arc(p[0], p[1], 11, 0, Math.PI * 2);
      c.fillStyle = speedColor(P, v); c.globalAlpha = 0.22; c.fill(); c.globalAlpha = 1;
      c.beginPath(); c.arc(p[0], p[1], 5.5, 0, Math.PI * 2);
      c.fillStyle = P.surface; c.fill();
      c.lineWidth = 2.5; c.strokeStyle = P.ink; c.stroke();

      if (trace) {
        var d = trace.ctx;
        d.clearRect(0, 0, trace.w, trace.h);
        d.drawImage(staticTrace, 0, 0, trace.w, trace.h);
        var q = traceProj()(s, v);
        d.strokeStyle = P.accent; d.lineWidth = 1.5;
        d.beginPath(); d.moveTo(q[0], 18); d.lineTo(q[0], trace.h - 4); d.stroke();
        d.beginPath(); d.arc(q[0], q[1], 3.5, 0, Math.PI * 2); d.fillStyle = P.accent; d.fill();
      }
      if (out.speed) out.speed.textContent = v.toFixed(1);
      if (out.dist) out.dist.textContent = Math.round(s);
      if (out.time) out.time.textContent = time.toFixed(1);
    }

    var speedup = 6; // replay at 6x: one lap in about 21 s
    var t0 = null, visible = true, current = 0;
    function frame(now) {
      if (t0 === null) t0 = now - (current / speedup) * 1000;
      current = (((now - t0) / 1000) * speedup) % tEnd;
      draw(current);
      if (visible && !document.hidden) requestAnimationFrame(frame);
      else t0 = null;
    }
    function start() { t0 = null; requestAnimationFrame(frame); }

    layout();
    if (reduceMotion) {
      var iMax = T.v.indexOf(vMax);
      draw(t[iMax]);
    } else {
      draw(0);
      if ("IntersectionObserver" in window) {
        new IntersectionObserver(function (entries) {
          var was = visible;
          visible = entries[0].isIntersecting;
          if (visible && !was) start();
        }).observe(mapCanvas);
      }
      document.addEventListener("visibilitychange", function () { if (!document.hidden && visible) start(); });
      start();
    }
    var redraw = function () { layout(); draw(reduceMotion ? t[T.v.indexOf(vMax)] : current); };
    if ("ResizeObserver" in window) new ResizeObserver(redraw).observe(mapCanvas);
    onThemeChange(redraw);
  }

  /* ---------- Project page: speed profile chart ---------- */
  var chart = document.querySelector("[data-speed-profile]");
  if (chart) {
    function drawChart() {
      var P = palette();
      var g = setupCanvas(chart);
      var c = g.ctx;
      var padL = 46, padR = 14, padT = 14, padB = 34;
      var W = g.w - padL - padR, H = g.h - padT - padB;
      var sMax = 820, vTop = 50;
      var X = function (s) { return padL + (s / sMax) * W; };
      var Y = function (v) { return padT + (1 - v / vTop) * H; };
      c.clearRect(0, 0, g.w, g.h);
      c.font = "11px " + P.mono;
      c.fillStyle = P.muted;
      c.strokeStyle = P.line;
      c.lineWidth = 1;
      // grid + y labels
      c.textAlign = "right"; c.textBaseline = "middle";
      for (var v = 0; v <= vTop; v += 10) {
        c.beginPath(); c.moveTo(padL, Y(v)); c.lineTo(padL + W, Y(v)); c.stroke();
        c.fillText(String(v), padL - 8, Y(v));
      }
      // x labels
      c.textAlign = "center"; c.textBaseline = "top";
      var step = W < 420 ? 200 : 100;
      for (var s = 0; s <= sMax; s += step) c.fillText(String(s), X(s), padT + H + 8);
      c.textAlign = "left"; c.textBaseline = "top";
      c.fillText("km/h", 4, 0);
      c.textAlign = "right"; c.textBaseline = "bottom";
      c.fillText("distance [m]", padL + W, g.h);
      // speed line colored by speed
      c.lineWidth = 2.2; c.lineCap = "round";
      for (var i = 1; i < n; i++) {
        c.strokeStyle = speedColor(P, (T.v[i] + T.v[i - 1]) / 2);
        c.beginPath();
        c.moveTo(X(Math.min(T.s[i - 1], sMax)), Y(T.v[i - 1]));
        c.lineTo(X(Math.min(T.s[i], sMax)), Y(T.v[i]));
        c.stroke();
      }
    }
    drawChart();
    if ("ResizeObserver" in window) new ResizeObserver(drawChart).observe(chart);
    onThemeChange(drawChart);
  }
})();
