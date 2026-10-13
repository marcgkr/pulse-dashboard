"""Builds the three short Line Aesthetics landing pages from one template.
Run: python3 build.py   (assets expected in ./assets, see assets/README.txt)
"""
import json
from pathlib import Path

HERE = Path(__file__).parent
WHATSAPP = "6589855001"
PIXEL_ID = "4678264112498182"

THREAD_SKILLS = [
    "MBBS and Graduate Diploma in Aesthetic Medicine, United Kingdom",
    "Certified in Silhouette and TESSLIFT thread lifts",
    "Trains other doctors at the Line Clinic Academy",
]
FILLER_SKILLS = [
    "MBBS and Graduate Diploma in Aesthetic Medicine, United Kingdom",
    "Board certified in aesthetic medicine (AAAM)",
    "Trains other doctors at the Line Clinic Academy",
]
TIMING = {"id": "timing", "short": "Timing", "q": "When would you like to do it?", "layout": "rows",
          "options": [{"v": "Within 2 weeks"}, {"v": "In 1 to 2 months"}, {"v": "Just exploring"}]}

PAGES = {
    "nose-thread-lift": {
        "title": "Nose Thread Lift by Dr Ram Nath | Line Aesthetics",
        "eyebrow": "Nose thread lift", "h1": "A refined nose, <em>without surgery.</em>",
        "sub": "A higher bridge and lifted tip, done personally by Dr Ram Nath.",
        "chips": ["About 30 minutes", "No cuts", "25+ years experience"],
        "cta": "See if I&rsquo;m suitable", "video": "hero-nose.mp4", "poster": "nose-touch.webp", "skills": THREAD_SKILLS,
        "lp": {"treatment": "Nose Thread Lift", "phrase": "a nose thread lift", "ref": "NTL", "steps": [
            {"id": "goal", "short": "I'd like", "q": "What would you like to change?", "layout": "cards", "options": [
                {"v": "Higher bridge", "img": "assets/profile-side.webp", "pos": "60% 30%", "size": "190%"},
                {"v": "Lifted tip", "img": "assets/nose-touch.webp", "pos": "52% 34%", "size": "200%"},
                {"v": "Bridge and tip", "img": "assets/nose-model-cream.webp", "pos": "48% 30%", "size": "230%"},
                {"v": "Not sure yet", "img": "assets/model-cream.webp", "pos": "60% 30%", "size": "200%"}]},
            {"id": "history", "short": "Previous nose work", "q": "Any nose treatment before?", "layout": "rows", "options": [
                {"v": "None"}, {"v": "Filler"}, {"v": "Thread lift"}, {"v": "Surgery or implant"}]},
            TIMING]},
    },
    "face-thread-lift": {
        "title": "Face Thread Lift by Dr Ram Nath | Line Aesthetics",
        "eyebrow": "Face thread lift", "h1": "Lift your jawline, <em>without surgery.</em>",
        "sub": "A firmer jawline and lifted cheeks with threads, done personally by Dr Ram Nath.",
        "chips": ["No surgery", "Back to routine in days", "25+ years experience"],
        "cta": "See if I&rsquo;m suitable", "video": "hero-face.mp4", "poster": "face-hands.webp", "skills": THREAD_SKILLS,
        "lp": {"treatment": "Face Thread Lift", "phrase": "a face thread lift", "ref": "FTL", "steps": [
            {"id": "concern", "short": "Main concern", "q": "What bothers you most?", "layout": "cards", "options": [
                {"v": "Jowls", "img": "assets/jowls.webp", "pos": "45% 70%", "size": "170%"},
                {"v": "Sagging cheeks", "img": "assets/face-hands.webp", "pos": "50% 45%", "size": "160%"},
                {"v": "Smile lines", "img": "assets/tired-face.webp", "pos": "50% 62%", "size": "190%"},
                {"v": "Under the chin", "img": "assets/jawline.webp", "pos": "40% 75%", "size": "160%"}]},
            {"id": "age", "short": "Age", "q": "Your age group?", "layout": "rows", "options": [
                {"v": "Under 35"}, {"v": "35 to 44"}, {"v": "45 to 54"}, {"v": "55 and above"}]},
            TIMING]},
    },
    "ha-fillers": {
        "title": "HA Fillers by Dr Ram Nath | Line Aesthetics",
        "eyebrow": "HA fillers", "h1": "Natural filler, <em>planned by a doctor.</em>",
        "sub": "Dr Ram Nath assesses your face first, then recommends only what suits you.",
        "chips": ["Doctor-assessed", "HA filler is reversible", "25+ years experience"],
        "cta": "See what I&rsquo;d need", "video": "hero-ha.mp4", "poster": "hero-model.webp", "skills": FILLER_SKILLS,
        "lp": {"treatment": "HA Fillers", "phrase": "HA fillers", "ref": "HAF", "steps": [
            {"id": "area", "short": "Area", "q": "Which area?", "layout": "cards", "options": [
                {"v": "Under-eyes", "img": "assets/tired-face.webp", "pos": "50% 30%", "size": "190%"},
                {"v": "Cheeks", "img": "assets/face-glow.webp", "pos": "45% 45%", "size": "170%"},
                {"v": "Lips", "img": "assets/hero-model.webp", "pos": "48% 62%", "size": "260%"},
                {"v": "Chin and jaw", "img": "assets/jawline.webp", "pos": "45% 65%", "size": "150%"}]},
            {"id": "history", "short": "Filler before", "q": "Had filler before?", "layout": "rows", "options": [
                {"v": "First time"}, {"v": "Yes, within a year"}, {"v": "Yes, over a year ago"}]},
            TIMING]},
    },
}

TEMPLATE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{title}</title>
<meta name="description" content="{sub_plain}">
<meta name="theme-color" content="#f5f0e7">
<link rel="icon" href="assets/logo.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Inter:wght@400;600&display=swap">
<link rel="stylesheet" href="lp.css">
</head>
<body>
<noscript><img height="1" width="1" style="display:none" alt="" src="https://www.facebook.com/tr?id={pixel}&amp;ev=PageView&amp;noscript=1"></noscript>
<header class="top"><div class="wrap">
  <a class="logo" href="#"><img src="assets/logo.png" alt="Line Aesthetics" width="768" height="175"></a>
  <span>Camden Medical Centre<br>Orchard, Singapore</span>
</div></header>

<main>
  <section class="hero"><div class="wrap hero-grid">
    <div class="arch"><video autoplay muted loop playsinline preload="metadata" poster="assets/{poster}" aria-hidden="true"><source src="assets/{video}" type="video/mp4"></video></div>
    <div>
      <p class="eyebrow">{eyebrow}</p>
      <h1>{h1}</h1>
      <p class="sub">{sub}</p>
      <ul class="chips">{chips}</ul>
      <a class="btn" href="#check" data-hide-sticky>{cta}</a>
    </div>
  </div></section>

  <section class="doctor"><div class="wrap doc-grid">
    <img src="assets/dr-ram-credentials.webp" alt="Dr Ram Nath at Line Aesthetics Clinic" loading="lazy">
    <div>
      <p class="eyebrow">Your doctor</p>
      <h2>Dr Ram Nath</h2>
      <p class="role">Founder, Line Aesthetics &middot; 25+ years in aesthetic medicine</p>
      <ul class="skills">{skills}</ul>
      <p class="philo">&ldquo;Our goal is not to change how you look, but to reveal your most confident, natural self.&rdquo;</p>
      <p class="philo-sub">Evidence-based, conservative and precise, so results still look like you.</p>
      <p class="fine">Qualifications reflect Dr Ram&rsquo;s completed training. Only SMC-accredited qualifications are recognised for medical registration in Singapore.</p>
    </div>
  </div></section>

  <section class="check" id="check"><div class="wrap">
    <div class="check-head"><p class="eyebrow">3 questions &middot; 30 seconds</p><h2>Is it right for you?</h2><p>Dr Ram&rsquo;s team replies on WhatsApp with whether it suits you, what it involves and the next available slot. No obligation.</p></div>
    <div class="quiz" id="quiz" data-hide-sticky></div>
  </div></section>
</main>

<footer><div class="wrap">
  <img src="assets/logo.png" alt="Line Aesthetics" width="768" height="175" loading="lazy">
  <p>1 Orchard Boulevard, #05-05 Camden Medical Centre, Singapore 248649 &middot; <a href="https://wa.me/{whatsapp}">+65 8985 5001</a></p>
  <p>Results vary. All treatments are subject to consultation and assessment of suitability.</p>
</div></footer>

<div class="sticky"><a class="btn" href="#check">{cta}</a></div>

<script>
window.LP = Object.assign({lp_json}, {{ whatsapp: "{whatsapp}", pixelId: "{pixel}", webhook: "", drPhoto: "assets/dr-ram-suit.webp" }});
</script>
<script src="lp.js"></script>
</body>
</html>
"""

if __name__ == "__main__":
    import re
    for slug, p in PAGES.items():
        html = TEMPLATE.format(
            title=p["title"], eyebrow=p["eyebrow"], h1=p["h1"], sub=p["sub"], sub_plain=re.sub("<[^>]+>", "", p["sub"]),
            cta=p["cta"], video=p["video"], poster=p["poster"], chips="".join(f"<li>{c}</li>" for c in p["chips"]),
            skills="".join(f"<li>{s}</li>" for s in p["skills"]),
            lp_json=json.dumps(p["lp"], ensure_ascii=False), whatsapp=WHATSAPP, pixel=PIXEL_ID)
        (HERE / f"{slug}.html").write_text(html, encoding="utf-8")
        print("built", slug)
