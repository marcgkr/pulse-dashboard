/* Line Aesthetics landing pages: qualifying quiz -> details -> prefilled WhatsApp.
   Each page sets window.LP before loading this file:
   {
     treatment: "Nose Thread Lift",          // used for tracking and the lead record
     phrase: "a nose thread lift",           // how the WhatsApp message names it
     ref: "NTL",                             // short code so the front desk knows the source page
     whatsapp: "6589855001",                 // country code + number, digits only
     pixelId: "",                            // Meta Pixel ID; leave empty to skip loading the pixel
     webhook: "",                            // optional URL that receives the lead as JSON (Make, Zapier, Apps Script)
     questions: [{ id, label, hint, options: [{ value, note }] }]
   }
*/
(function () {
  var C = window.LP;
  if (!C) return;

  var params = new URLSearchParams(location.search);
  var utm = {};
  ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid"].forEach(function (k) {
    if (params.get(k)) utm[k] = params.get(k);
  });

  /* Meta Pixel (only when an ID is configured) */
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

  var Q = C.questions;
  var total = Q.length + 1;
  var answers = {};
  var step = 0;
  var started = false;

  var card = document.getElementById("quiz");
  var body = card.querySelector("[data-body]");
  var count = card.querySelector("[data-count]");
  var bar = card.querySelector("[data-bar]");
  var back = card.querySelector("[data-back]");

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
  }

  function setProgress() {
    var n = Math.min(step + 1, total);
    count.textContent = step >= total ? "Ready to send" : "Step " + n + " of " + total;
    bar.style.width = (step >= total ? 100 : (n / total) * 100) + "%";
    back.hidden = step === 0 || step >= total;
  }

  function renderQuestion() {
    var q = Q[step];
    var html = '<h2 class="step-q" id="q-' + q.id + '">' + esc(q.label) + "</h2>";
    if (q.hint) html += '<p class="step-hint">' + esc(q.hint) + "</p>";
    html += '<div class="opts" role="group" aria-labelledby="q-' + q.id + '">';
    q.options.forEach(function (o, i) {
      var on = answers[q.id] === o.value;
      html += '<button type="button" class="opt" id="opt-' + q.id + "-" + i + '" data-v="' + esc(o.value) + '" aria-pressed="' + on + '">' +
        '<span class="dot" aria-hidden="true"></span><span>' + esc(o.value) +
        (o.note ? "<small>" + esc(o.note) + "</small>" : "") + "</span></button>";
    });
    html += "</div>";
    body.innerHTML = html;
    body.querySelectorAll(".opt").forEach(function (b) {
      b.addEventListener("click", function () {
        answers[q.id] = b.getAttribute("data-v");
        body.querySelectorAll(".opt").forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
        if (!started) { started = true; track("QuizStart", {}, true); }
        track("QuizStep", { step: step + 1, question: q.id, answer: answers[q.id] }, true);
        setTimeout(function () { step++; render(); }, 180);
      });
    });
  }

  function renderDetails() {
    body.innerHTML =
      '<h2 class="step-q">Where should Dr Ram\'s team reply?</h2>' +
      '<p class="step-hint">Your answers go straight to the clinic on WhatsApp so they can reply with what applies to you.</p>' +
      '<form id="lead-form" novalidate>' +
      '<div class="field"><label for="f-name">Name</label><input id="f-name" name="name" autocomplete="name" required><span class="err" id="e-name"></span></div>' +
      '<div class="field"><label for="f-phone">Mobile number</label><input id="f-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="9123 4567" required><span class="err" id="e-phone"></span></div>' +
      '<label class="consent" for="f-consent"><input id="f-consent" type="checkbox" required><span>I agree to Line Aesthetics Clinic contacting me about this enquiry by WhatsApp or phone.</span></label>' +
      '<span class="err" id="e-consent"></span>' +
      '<button class="btn btn-wa" type="submit">' + WA_ICON + "Continue to WhatsApp</button>" +
      '<p class="fine">WhatsApp opens with your answers typed in. Tap send and the clinic replies during opening hours.</p>' +
      "</form>";
    var f = document.getElementById("lead-form");
    f.addEventListener("submit", submit);
    document.getElementById("f-name").focus({ preventScroll: true });
  }

  function cleanPhone(v) { return v.replace(/[^\d+]/g, ""); }
  function validPhone(v) {
    var d = cleanPhone(v);
    if (/^[89]\d{7}$/.test(d)) return true;               // Singapore mobile
    if (/^\+?65[89]\d{7}$/.test(d)) return true;
    return /^\+\d{8,15}$/.test(d);                          // overseas, with country code
  }

  function buildMessage(name, phone) {
    var lines = ["Hi Line Aesthetics, I'd like to ask about " + (C.phrase || C.treatment) + "."];
    lines.push("");
    Q.forEach(function (q) { lines.push(q.short + ": " + answers[q.id]); });
    lines.push("");
    lines.push("Name: " + name);
    lines.push("Mobile: " + phone);
    lines.push("");
    lines.push("(Ref " + C.ref + (utm.utm_content ? " / " + utm.utm_content : "") + ")");
    return lines.join("\n");
  }

  function submit(e) {
    e.preventDefault();
    var name = document.getElementById("f-name").value.trim();
    var phone = document.getElementById("f-phone").value.trim();
    var ok = true;
    document.getElementById("e-name").textContent = name.length < 2 ? "Please enter your name." : "";
    if (name.length < 2) ok = false;
    if (!validPhone(phone)) { document.getElementById("e-phone").textContent = "Enter an 8-digit Singapore mobile, or include your country code (e.g. +60...)."; ok = false; }
    else document.getElementById("e-phone").textContent = "";
    var consent = document.getElementById("f-consent").checked;
    document.getElementById("e-consent").textContent = consent ? "" : "Please tick the box so the clinic can reply to you.";
    if (!consent) ok = false;
    if (!ok) return;

    var msg = buildMessage(name, phone);
    var url = "https://wa.me/" + C.whatsapp + "?text=" + encodeURIComponent(msg);

    var lead = { treatment: C.treatment, ref: C.ref, answers: answers, name: name, phone: cleanPhone(phone), page: location.href.split("?")[0], utm: utm, ts: new Date().toISOString() };
    if (C.webhook) {
      try {
        var blob = new Blob([JSON.stringify(lead)], { type: "text/plain" });
        if (!(navigator.sendBeacon && navigator.sendBeacon(C.webhook, blob))) {
          fetch(C.webhook, { method: "POST", body: JSON.stringify(lead), keepalive: true, mode: "no-cors" });
        }
      } catch (err) { /* lead still goes out on WhatsApp */ }
    }
    track("Lead", { value: 0, currency: "SGD" });
    track("Contact", { method: "whatsapp" });

    step = total;
    setProgress();
    body.innerHTML =
      '<div class="done"><h2 class="step-q">Almost done, ' + esc(name.split(" ")[0]) + "</h2>" +
      '<p class="step-hint">WhatsApp should be opening with this message. Tap send to reach the clinic.</p>' +
      '<div class="summary">' + esc(msg) + "</div>" +
      '<a class="btn btn-wa" id="wa-link" href="' + esc(url) + '" target="_blank" rel="noopener">' + WA_ICON + "Open WhatsApp</a>" +
      '<p class="fine">WhatsApp didn\'t open? Tap the button above, or message +' + C.whatsapp.replace(/^65/, "65 ").replace(/(\d{4})(\d{4})$/, "$1 $2") + ".</p></div>";

    // Inside an embedded preview, navigating the frame would break; the button covers that case.
    var embedded = false;
    try { embedded = window.self !== window.top; } catch (err) { embedded = true; }
    if (!embedded) setTimeout(function () { location.href = url; }, 350);
  }

  function render() {
    setProgress();
    if (step < Q.length) renderQuestion();
    else if (step === Q.length) renderDetails();
  }

  back.addEventListener("click", function () { if (step > 0) { step--; render(); } });

  var WA_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4.1-.7.3-.2.3-.9.9-.9 2.2s.9 2.5 1 2.7c.1.2 1.8 2.8 4.4 3.9 1.6.7 2.3.8 3.1.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z"/></svg>';

  render();

  /* Any [data-start] link scrolls to the quiz; the sticky bar hides while the quiz is on screen. */
  document.querySelectorAll("[data-start]").forEach(function (a) {
    a.addEventListener("click", function (e) {
      e.preventDefault();
      card.scrollIntoView({ block: "start" });
    });
  });
  var sticky = document.querySelector(".sticky");
  if (sticky && "IntersectionObserver" in window) {
    new IntersectionObserver(function (es) {
      sticky.classList.toggle("hide", es[0].isIntersecting);
    }, { threshold: 0.15 }).observe(card);
  }
})();
