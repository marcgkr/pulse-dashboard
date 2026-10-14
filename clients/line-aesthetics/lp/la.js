/* Line Aesthetics landing pages v4: hero line drawing, scroll reveals, inline slider questionnaire.
   3 questions (one per slide) -> name + mobile -> WhatsApp opens with the answers prefilled.
   Each page sets window.LP = { treatment, phrase, ref, whatsapp, pixelId, webhook, drPhoto, steps: [...] }
   Card options take `art` (inline SVG) instead of `img`. */
(function () {
  var still = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Hero: .draw strokes draw in (CSS), then paths with data-to morph from their d to data-to. */
  var art = document.querySelector(".art");
  if (art) {
    var morphs = art.querySelectorAll("[data-to]");
    var nums = function (d) { return d.match(/-?\d*\.?\d+/g).map(Number); };
    var rebuild = function (tpl, v) { var i = 0; return tpl.replace(/-?\d*\.?\d+/g, function () { return (Math.round(v[i++] * 100) / 100).toString(); }); };
    var finish = function () { morphs.forEach(function (p) { p.setAttribute("d", p.getAttribute("data-to")); }); art.classList.add("done"); };
    if (still) { art.classList.add("go"); finish(); }
    else {
      requestAnimationFrame(function () { art.classList.add("go"); });
      var at = +art.getAttribute("data-morph-at") || 2600, dur = +art.getAttribute("data-morph-dur") || 1400;
      setTimeout(function () {
        var t0 = performance.now();
        var jobs = Array.prototype.map.call(morphs, function (p) { return { p: p, a: nums(p.getAttribute("d")), b: nums(p.getAttribute("data-to")), tpl: p.getAttribute("data-to") }; });
        (function tick(now) {
          var k = Math.min(1, (now - t0) / dur), e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
          jobs.forEach(function (j) { j.p.setAttribute("d", rebuild(j.tpl, j.a.map(function (x, i) { return x + (j.b[i] - x) * e; }))); });
          if (k < 1) requestAnimationFrame(tick); else finish();
        })(t0);
      }, at);
    }
  }

  /* Gentle reveal for sections below the fold */
  if ("IntersectionObserver" in window && !still) {
    var ro = new IntersectionObserver(function (es) { es.forEach(function (x) { if (x.isIntersecting) { x.target.classList.add("in"); ro.unobserve(x.target); } }); }, { threshold: 0.12 });
    document.querySelectorAll(".reveal").forEach(function (el) { ro.observe(el); });
  } else document.querySelectorAll(".reveal").forEach(function (el) { el.classList.add("in"); });

  var C = window.LP;
  var root = document.getElementById("quiz");
  if (!C || !root) return;

  var params = new URLSearchParams(location.search);
  var utm = {};
  ["utm_source", "utm_medium", "utm_campaign", "utm_content", "fbclid"].forEach(function (k) { if (params.get(k)) utm[k] = params.get(k); });

  if (C.pixelId) {
    !function (f, b, e, v, n, t, s) { if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); }; if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = "2.0"; n.queue = []; t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s); }(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
    window.fbq("init", C.pixelId);
    window.fbq("track", "PageView");
  }
  function track(name, data, custom, eventId) {
    data = Object.assign({ content_name: C.treatment }, data || {});
    if (window.fbq) window.fbq(custom ? "trackCustom" : "track", name, data, eventId ? { eventID: eventId } : undefined);
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(Object.assign({ event: "lp_" + name.toLowerCase() }, data));
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  var WA = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4.1-.7.3-.2.3-.9.9-.9 2.2s.9 2.5 1 2.7c.1.2 1.8 2.8 4.4 3.9 1.6.7 2.3.8 3.1.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z"/></svg>';

  var S = C.steps, N = S.length + 1, answers = {}, who = {}, step = 0, started = false;
  root.innerHTML = '<div class="qz-bar"><button type="button" class="qz-back" hidden>&larr; Back</button><div class="prog"><i></i></div><span class="count"></span></div><div class="qz-stage" aria-live="polite"></div>';
  var stage = root.querySelector(".qz-stage"), back = root.querySelector(".qz-back"), bar = root.querySelector(".prog i"), count = root.querySelector(".count");

  function show(html, dir) {
    stage.innerHTML = '<div class="panel ' + (dir || "next") + '">' + html + "</div>";
    bar.style.width = (Math.min(step + 1, N) / N * 100) + "%";
    count.textContent = step < S.length ? (step + 1) + " / " + S.length : step === S.length ? "Last step" : "Done";
    back.hidden = step === 0 || step > N - 1;
  }

  function question(dir) {
    var s = S[step], h = '<p class="q">' + esc(s.q) + "</p>";
    h += s.layout === "cards" ? '<div class="cards">' : '<div class="rows">';
    s.options.forEach(function (o) {
      var on = answers[s.id] === o.v;
      h += s.layout === "cards"
        ? '<button type="button" class="card" data-v="' + esc(o.v) + '" aria-pressed="' + on + '">' + (o.art ? '<span class="ph" aria-hidden="true">' + o.art + "</span>" : '<span class="ph" style="background:url(' + esc(o.img) + ") " + esc(o.pos || "50% 50%") + " / " + esc(o.size || "cover") + ' no-repeat"></span>') + '<span class="lbl">' + esc(o.v) + "</span></button>"
        : '<button type="button" class="row" data-v="' + esc(o.v) + '" aria-pressed="' + on + '"><span class="dot" aria-hidden="true"></span>' + esc(o.v) + "</button>";
    });
    show(h + "</div>", dir);
    stage.querySelectorAll("[data-v]").forEach(function (b) {
      b.addEventListener("click", function () {
        answers[s.id] = b.getAttribute("data-v");
        stage.querySelectorAll("[data-v]").forEach(function (x) { x.setAttribute("aria-pressed", x === b); });
        if (!started) { started = true; track("QuizStart", {}, true); }
        track("QuizStep", { step: step + 1, question: s.id, answer: answers[s.id] }, true);
        setTimeout(function () { step++; render("next"); }, 200);
      });
    });
  }

  function form(dir) {
    show('<p class="q">Last step: where should Dr Ram&rsquo;s team reply?</p>' +
      '<div class="with-dr"><img src="' + esc(C.drPhoto) + '" alt=""><span>Your answers go to Dr Ram&rsquo;s team on WhatsApp.</span></div>' +
      '<form novalidate><div class="field"><label for="f-name">Name</label><input id="f-name" autocomplete="name" value="' + esc(who.name || "") + '"><span class="err" id="e-name"></span></div>' +
      '<div class="field"><label for="f-phone">Mobile</label><input id="f-phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="9123 4567" value="' + esc(who.phone || "") + '"><span class="err" id="e-phone"></span></div>' +
      '<label class="consent"><input type="checkbox" id="f-ok"><span>I agree to Line Aesthetics Clinic contacting me about this enquiry.</span></label><span class="err" id="e-ok"></span>' +
      '<button class="btn btn-wa btn-block" type="submit">' + WA + "Get my answer on WhatsApp</button></form>", dir);
    stage.querySelector("form").addEventListener("submit", submit);
  }

  function clean(v) { return v.replace(/[^\d+]/g, ""); }
  function validPhone(v) { var d = clean(v); return /^[89]\d{7}$/.test(d) || /^\+?65[89]\d{7}$/.test(d) || /^\+\d{8,15}$/.test(d); }

  function submit(e) {
    e.preventDefault();
    var name = document.getElementById("f-name").value.trim(), phone = document.getElementById("f-phone").value.trim(), ok = document.getElementById("f-ok").checked;
    document.getElementById("e-name").textContent = name.length < 2 ? "Enter your name." : "";
    document.getElementById("e-phone").textContent = validPhone(phone) ? "" : "Enter an 8-digit Singapore mobile, or add your country code.";
    document.getElementById("e-ok").textContent = ok ? "" : "Tick the box so the clinic can reply.";
    if (name.length < 2 || !validPhone(phone) || !ok) return;
    who = { name: name, phone: phone };

    var L = ["Hi Line Aesthetics, I'd like to enquire about " + C.phrase + " with Dr Ram.", ""];
    S.forEach(function (s) { L.push(s.short + ": " + answers[s.id]); });
    L.push("", "Name: " + name, "Mobile: " + phone, "", "(Ref " + C.ref + (utm.utm_content ? " / " + utm.utm_content : "") + ")");
    var url = "https://wa.me/" + C.whatsapp + "?text=" + encodeURIComponent(L.join("\n"));

    if (C.webhook) {
      try {
        var body = JSON.stringify({ treatment: C.treatment, answers: answers, name: name, phone: clean(phone), utm: utm, page: location.href.split("?")[0], ts: new Date().toISOString() });
        if (!(navigator.sendBeacon && navigator.sendBeacon(C.webhook, new Blob([body], { type: "text/plain" })))) fetch(C.webhook, { method: "POST", body: body, keepalive: true, mode: "no-cors" });
      } catch (err) { /* WhatsApp still carries the lead */ }
    }
    /* Advanced matching: the pixel hashes these in the browser before sending. Improves lead matching on Meta. */
    if (window.fbq && C.pixelId) {
      var ph = clean(phone).replace(/^\+/, "");
      if (/^[89]\d{7}$/.test(ph)) ph = "65" + ph;
      window.fbq("init", C.pixelId, { ph: ph, fn: name.split(" ")[0].toLowerCase(), country: "sg" });
    }
    track("Lead", { value: 0, currency: "SGD" }, false, "lead-" + C.ref + "-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7));
    step = N;
    show('<p class="q">Thank you, ' + esc(name.split(" ")[0]) + ".</p>" +
      '<p style="color:var(--soft);margin:0 0 18px">WhatsApp is opening with your answers. Tap send and Dr Ram&rsquo;s team will reply during clinic hours.</p>' +
      '<a class="btn btn-wa btn-block" id="wa" href="' + esc(url) + '" target="_blank" rel="noopener">' + WA + "Open WhatsApp</a>" +
      '<p class="qz-fine">Not opening? Message +65 8985 5001.</p>', "next");
    document.getElementById("wa").addEventListener("click", function () { track("Contact", { method: "whatsapp" }); });
    var framed = false; try { framed = window.self !== window.top; } catch (err) { framed = true; }
    if (!framed) setTimeout(function () { track("Contact", { method: "whatsapp_auto" }); location.href = url; }, 600);
  }

  function render(dir) { if (step < S.length) question(dir); else form(dir); }
  back.addEventListener("click", function () { if (step > 0) { step--; render("prev"); } });
  render("next");

  /* Sticky button hides while the hero button or the questionnaire is on screen */
  var sticky = document.querySelector(".sticky");
  if (sticky && "IntersectionObserver" in window) {
    var seen = new Set();
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (x) { x.isIntersecting ? seen.add(x.target) : seen.delete(x.target); });
      sticky.classList.toggle("hide", seen.size > 0);
    }, { threshold: 0.15 });
    document.querySelectorAll("[data-hide-sticky]").forEach(function (el) { io.observe(el); });
  }
})();
