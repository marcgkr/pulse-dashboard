/* Line Aesthetics landing pages: full-screen qualifying flow.
   Questions (one per screen) -> contact details -> personalised result -> WhatsApp with everything prefilled.
   Each page defines window.LP before this file loads:
   {
     treatment, phrase, ref, whatsapp, pixelId, webhook,
     drPhoto: "assets/dr-ram-suit.webp",
     steps: [{ id, short, q, hint, layout: "cards" | "rows", options: [{ v, note, img, pos }] }],
     result(answers) -> string   // short, honest note shown before WhatsApp opens
   }
*/
(function () {
  var C = window.LP;
  if (!C) return;

  var params = new URLSearchParams(location.search);
  var utm = {};
  ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid"].forEach(function (k) { if (params.get(k)) utm[k] = params.get(k); });

  /* Meta Pixel */
  if (C.pixelId) {
    !function (f, b, e, v, n, t, s) { if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); }; if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = "2.0"; n.queue = []; t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s); }(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
    window.fbq("init", C.pixelId);
    window.fbq("track", "PageView");
  }
  function track(name, data, custom) {
    data = Object.assign({ content_name: C.treatment }, data || {});
    if (window.fbq) window.fbq(custom ? "trackCustom" : "track", name, data);
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(Object.assign({ event: "lp_" + name.toLowerCase() }, data));
  }

  var WA_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4.1-.7.3-.2.3-.9.9-.9 2.2s.9 2.5 1 2.7c.1.2 1.8 2.8 4.4 3.9 1.6.7 2.3.8 3.1.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z"/></svg>';
  var CLOSE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  /* Build the sheet */
  var flow = document.createElement("div");
  flow.className = "flow";
  flow.setAttribute("role", "dialog");
  flow.setAttribute("aria-modal", "true");
  flow.setAttribute("aria-label", "Check your suitability");
  flow.innerHTML =
    '<div class="flow-top"><img src="assets/logo.png" alt="Line Aesthetics"><button class="icon-btn" type="button" data-close aria-label="Close">' + CLOSE + "</button></div>" +
    '<div class="progress"><i></i></div>' +
    '<div class="flow-body"><div class="flow-inner" aria-live="polite"></div></div>';
  document.body.appendChild(flow);
  var inner = flow.querySelector(".flow-inner");
  var bar = flow.querySelector(".progress i");

  var S = C.steps;
  var TOTAL = S.length + 1; // questions + details
  var answers = {};
  var contact = { time: "" };
  var step = 0;
  var started = false;
  var lastFocus = null;

  function open(pre) {
    lastFocus = document.activeElement;
    if (pre && pre.id && pre.v) { answers[pre.id] = pre.v; step = Math.max(step, S.findIndex(function (s) { return s.id === pre.id; }) + 1); }
    flow.classList.add("open");
    document.body.classList.add("locked");
    if (!started) { started = true; track("QuizStart", {}, true); }
    render();
  }
  function close() {
    flow.classList.remove("open");
    document.body.classList.remove("locked");
    if (lastFocus) lastFocus.focus({ preventScroll: true });
  }
  flow.querySelector("[data-close]").addEventListener("click", close);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && flow.classList.contains("open")) close(); });

  function meta(label) {
    return '<div class="step-meta"><button type="button" class="back"' + (step === 0 ? " hidden" : "") + ">&larr; Back</button><span>" + label + "</span></div>";
  }
  function setBar() { bar.style.width = (Math.min(step, TOTAL) / TOTAL) * 100 + "%"; }

  function renderQuestion() {
    var s = S[step];
    var h = meta("Question " + (step + 1) + " of " + S.length);
    h += '<h2 class="q">' + esc(s.q) + "</h2>";
    if (s.hint) h += '<p class="q-hint">' + esc(s.hint) + "</p>";
    if (s.layout === "cards") {
      h += '<div class="cards" role="group" aria-label="' + esc(s.q) + '">';
      s.options.forEach(function (o, i) {
        h += '<button type="button" class="card" id="o-' + s.id + "-" + i + '" data-v="' + esc(o.v) + '" aria-pressed="' + (answers[s.id] === o.v) + '">' +
          '<span class="ph" style="background-image:url(' + esc(o.img) + ");background-position:" + esc(o.pos || "50% 50%") + (o.size ? ";background-size:" + esc(o.size) : "") + '"></span>' +
          '<span class="lbl">' + esc(o.v) + (o.note ? "<small>" + esc(o.note) + "</small>" : "") + "</span></button>";
      });
    } else {
      h += '<div class="rows" role="group" aria-label="' + esc(s.q) + '">';
      s.options.forEach(function (o, i) {
        h += '<button type="button" class="row" id="o-' + s.id + "-" + i + '" data-v="' + esc(o.v) + '" aria-pressed="' + (answers[s.id] === o.v) + '"><span class="dot" aria-hidden="true"></span><span>' + esc(o.v) + (o.note ? "<small>" + esc(o.note) + "</small>" : "") + "</span></button>";
      });
    }
    h += "</div>";
    inner.innerHTML = '<div class="step-anim">' + h + "</div>";
    inner.querySelectorAll("[data-v]").forEach(function (b) {
      b.addEventListener("click", function () {
        answers[s.id] = b.getAttribute("data-v");
        inner.querySelectorAll("[data-v]").forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
        track("QuizStep", { step: step + 1, question: s.id, answer: answers[s.id] }, true);
        setTimeout(function () { step++; render(); }, 220);
      });
    });
  }

  function renderDetails() {
    var h = meta("Last step");
    h += '<h2 class="q">Where should we send your answers?</h2>';
    h += '<p class="q-hint">Dr Ram\'s team will reply on WhatsApp with what applies to you and the next available consult slots.</p>';
    h += '<div class="with-dr"><img src="' + esc(C.drPhoto) + '" alt=""><p><b>Your consultation is with Dr Ram Nath</b><br>Founder of Line Aesthetics, 25+ years in aesthetic medicine</p></div>';
    h += '<form id="lead" novalidate>' +
      '<div class="field"><label for="f-name">Your name</label><input id="f-name" autocomplete="name" required><span class="err" id="e-name"></span></div>' +
      '<div class="field"><label for="f-phone">Mobile number</label><input id="f-phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="9123 4567" required><span class="err" id="e-phone"></span></div>' +
      '<div class="field"><label id="l-time">Best time for a consult</label><div class="pills" role="group" aria-labelledby="l-time">' +
      ["Weekday daytime", "Weekday evening", "Saturday morning"].map(function (t) { return '<button type="button" class="pill" data-t="' + t + '" aria-pressed="' + (contact.time === t) + '">' + t + "</button>"; }).join("") +
      "</div></div>" +
      '<label class="consent" for="f-ok"><input type="checkbox" id="f-ok"><span>I agree to Line Aesthetics Clinic contacting me about this enquiry by WhatsApp or phone.</span></label><span class="err" id="e-ok"></span>' +
      '<button class="btn btn-dark btn-block" type="submit">See my result <span class="arr" aria-hidden="true"></span></button>' +
      '<p class="flow-fine">Your details are only used to reply to this enquiry.</p></form>';
    inner.innerHTML = '<div class="step-anim">' + h + "</div>";
    inner.querySelectorAll("[data-t]").forEach(function (b) {
      b.addEventListener("click", function () {
        contact.time = b.getAttribute("data-t");
        inner.querySelectorAll("[data-t]").forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
      });
    });
    if (contact.name) document.getElementById("f-name").value = contact.name;
    if (contact.phone) document.getElementById("f-phone").value = contact.phone;
    document.getElementById("lead").addEventListener("submit", submit);
  }

  function cleanPhone(v) { return v.replace(/[^\d+]/g, ""); }
  function validPhone(v) { var d = cleanPhone(v); return /^[89]\d{7}$/.test(d) || /^\+?65[89]\d{7}$/.test(d) || /^\+\d{8,15}$/.test(d); }

  function message() {
    var L = ["Hi Line Aesthetics, I'd like to enquire about " + (C.phrase || C.treatment) + " with Dr Ram.", ""];
    S.forEach(function (s) { L.push(s.short + ": " + answers[s.id]); });
    if (contact.time) L.push("Best time for a consult: " + contact.time);
    L.push("", "Name: " + contact.name, "Mobile: " + contact.phone, "", "(Ref " + C.ref + (utm.utm_content ? " / " + utm.utm_content : "") + ")");
    return L.join("\n");
  }

  function submit(e) {
    e.preventDefault();
    var name = document.getElementById("f-name").value.trim();
    var phone = document.getElementById("f-phone").value.trim();
    var ok = document.getElementById("f-ok").checked;
    document.getElementById("e-name").textContent = name.length < 2 ? "Enter your name so the team knows who to reply to." : "";
    document.getElementById("e-phone").textContent = validPhone(phone) ? "" : "Enter an 8-digit Singapore mobile, or include your country code, e.g. +60 12 345 6789.";
    document.getElementById("e-ok").textContent = ok ? "" : "Tick the box so the clinic can reply to you.";
    if (name.length < 2 || !validPhone(phone) || !ok) return;
    contact.name = name; contact.phone = phone;

    var lead = { treatment: C.treatment, ref: C.ref, answers: answers, time: contact.time, name: name, phone: cleanPhone(phone), page: location.href.split("?")[0], utm: utm, ts: new Date().toISOString() };
    if (C.webhook) {
      try {
        var blob = new Blob([JSON.stringify(lead)], { type: "text/plain" });
        if (!(navigator.sendBeacon && navigator.sendBeacon(C.webhook, blob))) fetch(C.webhook, { method: "POST", body: JSON.stringify(lead), keepalive: true, mode: "no-cors" });
      } catch (err) { /* the lead still goes out on WhatsApp */ }
    }
    track("Lead", { value: 0, currency: "SGD" });
    step = TOTAL;
    render();
  }

  function renderDone() {
    var msg = message();
    var url = "https://wa.me/" + C.whatsapp + "?text=" + encodeURIComponent(msg);
    var first = esc(contact.name.split(" ")[0]);
    var h = '<div class="step-meta"><span>Your result</span><span></span></div>';
    h += '<h2 class="q">Thank you, ' + first + ".</h2>";
    h += '<p class="result-note">' + esc(C.result(answers)) + "</p>";
    h += '<p class="q-hint">Tap the button to send your answers to Dr Ram\'s team on WhatsApp. They reply during clinic hours.</p>';
    h += '<div class="summary">' + esc(msg) + "</div>";
    h += '<a class="btn btn-wa btn-block" id="wa" href="' + esc(url) + '" target="_blank" rel="noopener">' + WA_ICON + "Send on WhatsApp</a>";
    h += '<p class="flow-fine">WhatsApp not opening? Message +65 8985 5001 or call the clinic.</p>';
    inner.innerHTML = '<div class="step-anim">' + h + "</div>";
    document.getElementById("wa").addEventListener("click", function () { track("Contact", { method: "whatsapp" }); });
  }

  function render() {
    setBar();
    flow.querySelector(".flow-body").scrollTop = 0;
    if (step < S.length) renderQuestion();
    else if (step === S.length) renderDetails();
    else renderDone();
    var b = inner.querySelector(".back");
    if (b) b.addEventListener("click", function () { if (step > 0) { step--; render(); } });
    var f = inner.querySelector("h2");
    if (f) { f.setAttribute("tabindex", "-1"); f.focus({ preventScroll: true }); }
  }

  /* Openers: any [data-open]; [data-pre="id|value"] preselects the first answer */
  document.querySelectorAll("[data-open]").forEach(function (el) {
    el.addEventListener("click", function (e) {
      e.preventDefault();
      var pre = el.getAttribute("data-pre");
      open(pre ? { id: pre.split("|")[0], v: pre.split("|")[1] } : null);
    });
  });

  /* Lazy Instagram reel */
  document.querySelectorAll("[data-reel]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var f = document.createElement("iframe");
      f.src = "https://www.instagram.com/reel/" + btn.getAttribute("data-reel") + "/embed/";
      f.title = "Dr Ram explains the treatment";
      f.allow = "autoplay; encrypted-media";
      f.loading = "lazy";
      btn.replaceWith(f);
      track("VideoPlay", {}, true);
    });
  });

  /* Sticky bar hides near the top hero CTA and at the closing CTA */
  var sticky = document.querySelector(".sticky");
  var watch = document.querySelectorAll("[data-hide-sticky]");
  if (sticky && watch.length && "IntersectionObserver" in window) {
    var vis = new Set();
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (x) { if (x.isIntersecting) vis.add(x.target); else vis.delete(x.target); });
      sticky.classList.toggle("hide", vis.size > 0);
    }, { threshold: 0.2 });
    watch.forEach(function (w) { io.observe(w); });
  }
})();
