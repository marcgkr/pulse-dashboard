"""Builds the v4 Line Aesthetics landing pages (line-art direction).
Run: python3 build4.py   (assets expected in ./assets, see assets/README.txt)
Nose and face thread lift are on v4; HA fillers moves over next.
"""
import json
from pathlib import Path

HERE = Path(__file__).parent
WHATSAPP = "6589855001"
PIXEL_ID = "4678264112498182"

# One continuous profile, drawn twice: before and after the lift. Same command structure so the JS can morph between them.
HEAD = "M236 70 C254 92 266 124 266 152 "
LIPS = ("C287 281 293 288 294 293 C294 297 289 300 285 301 C291 304 293 311 289 316 C286 320 281 323 281 328 "
        "C282 338 290 350 286 360 ")
UNDER = "C282 370 266 374 252 378 C242 382 236 390 236 400 C236 420 238 440 240 460"
UNDER_SAG = "C282 373 268 382 254 388 C244 392 238 398 237 406 C236 422 238 440 240 460"
CHIN = LIPS + UNDER
NOSE_BEFORE = "C266 162 262 172 258 186 C262 206 278 234 292 254 C300 264 298 272 290 273 C288 273 286 273 284 274 "
NOSE_AFTER = "C266 162 262 170 262 180 C272 200 290 226 304 246 C312 256 310 266 298 268 C292 269 288 271 284 274 "
PROFILE_BEFORE, PROFILE_AFTER = HEAD + NOSE_BEFORE + CHIN, HEAD + NOSE_AFTER + CHIN
EYE = "M223 196 C231 202 241 202 248 196 M228 200 l-2 4 M234 202 l-1 5 M240 201 l1 4"
BROW = "M220 177 C232 170 246 170 255 175"
HAIR = "M236 70 C200 38 128 46 106 118 C90 172 102 250 86 330 M228 80 C196 64 150 84 138 146 C128 196 146 252 128 320 C122 352 112 380 104 400"
BRIDGE = "M262 180 C272 200 290 226 304 246"
TIP = "M304 246 C312 256 310 266 298 268 C292 269 288 271 284 274"

# Face: same profile with the refined nose, plus ear and jawline. Before = slight jowl and fuller under-chin.
FACE_AFTER, FACE_BEFORE = HEAD + NOSE_AFTER + CHIN, HEAD + NOSE_AFTER + LIPS + UNDER_SAG
EAR = "M194 246 C181 244 177 262 180 274 C183 286 189 292 196 290"
JAW = "M263 375 C244 366 222 348 208 332 C201 323 197 310 197 294"
JAW_SAG = "M262 384 C246 382 228 370 214 354 C205 342 199 318 197 294"
JOWL = "M263 375 C244 366 222 348 208 332"
CHEEK = "M212 230 C228 240 242 256 250 274"
SMILE = "M276 282 C270 290 270 302 278 312"
UNDER_CHIN = "M286 360 C282 370 266 374 252 378 C246 380 241 384 238 389"
FACE_THREADS = [("M206 238 C218 268 234 300 250 326", "M206 234 C220 260 238 288 256 312", ".1"),
                ("M202 254 C212 286 224 320 236 346", "M202 250 C214 278 228 306 242 332", ".25"),
                ("M200 270 C206 302 214 334 222 356", "M200 266 C208 292 218 316 228 338", ".4")]

NOSE_HERO = f"""<figure class="art" data-morph-at="2200" data-morph-dur="1300">
      <svg viewBox="70 44 330 396" role="img" aria-label="Line drawing of a profile. Fine threads are placed along the nose, then the bridge and tip lift.">
        <g class="face">
          <path class="draw" pathLength="1" style="--t:.1s;--d:2s" d="{HAIR}"/>
          <path class="draw" pathLength="1" style="--d:1.7s" d="{PROFILE_BEFORE}" data-to="{PROFILE_AFTER}"/>
          <path class="draw" pathLength="1" style="--t:1.1s;--d:.7s" d="{BROW}"/>
          <path class="draw" pathLength="1" style="--t:1.2s;--d:.7s" d="{EYE}"/>
        </g>
        <g class="threads">
          <path class="draw" pathLength="1" style="--t:1.5s;--d:.6s" d="M259 196 C264 212 276 234 286 250" data-to="M263 192 C271 206 284 226 296 242"/>
          <path class="draw" pathLength="1" style="--t:1.65s;--d:.6s" d="M255 204 C260 220 270 238 280 256" data-to="M259 200 C267 214 279 233 290 248"/>
        </g>
        <g class="tags">
          <g class="tag"><circle cx="289" cy="222" r="1.8"/><path d="M291 220 L320 204"/><text x="324" y="207">Higher bridge</text></g>
          <g class="tag"><circle cx="311" cy="257" r="1.8"/><path d="M313 259 L332 270"/><text x="336" y="273">Lifted tip</text></g>
        </g>
      </svg>
      <figcaption>Illustration</figcaption>
    </figure>"""


FACE_HERO = f"""<figure class="art" style="--fade:90%" data-morph-at="2300" data-morph-dur="1400">
      <svg viewBox="70 44 330 416" role="img" aria-label="Line drawing of a profile. Fine threads are placed along the cheek, then the jawline and cheek lift.">
        <g class="face">
          <path class="draw" pathLength="1" style="--t:.1s;--d:2s" d="{HAIR}"/>
          <path class="draw" pathLength="1" style="--d:1.7s" d="{FACE_BEFORE}" data-to="{FACE_AFTER}"/>
          <path class="draw" pathLength="1" style="--t:.8s;--d:1s" d="{JAW_SAG}" data-to="{JAW}"/>
          <path class="draw" pathLength="1" style="--t:.9s;--d:.6s" d="{EAR}"/>
          <path class="draw" pathLength="1" style="--t:1.1s;--d:.7s" d="{BROW}"/>
          <path class="draw" pathLength="1" style="--t:1.2s;--d:.7s" d="{EYE}"/>
        </g>
        <g class="threads">""" + "".join(
    f'\n          <path class="draw" pathLength="1" style="--t:{1.5 + float(t):.2f}s;--d:.6s" d="{a}" data-to="{b}"/>' for a, b, t in FACE_THREADS) + """
        </g>
        <g class="tags">
          <g class="tag"><circle cx="216" cy="262" r="1.8"/><path d="M214 260 L176 234"/><text x="172" y="232" text-anchor="end">Lifted cheeks</text></g>
          <g class="tag"><circle cx="268" cy="373" r="1.8"/><path d="M270 375 L300 400"/><text x="304" y="404">Firmer jawline</text></g>
        </g>
      </svg>
      <figcaption>Illustration</figcaption>
    </figure>"""


def face_card(*highlights):
    hl = "".join(f'<path d="{d}" stroke="#a6886a" stroke-width="3.2"/>' for d in highlights)
    return (f'<svg viewBox="146 212 200 180"><path d="{FACE_AFTER}" stroke="#1f1a17" stroke-width="1.5"/>'
            f'<path d="{EYE} {EAR} {JAW}" stroke="#1f1a17" stroke-width="1.3"/>{hl}</svg>')


def nose_card(*highlights, ring=False):
    hl = "".join(f'<path d="{d}" stroke="#a6886a" stroke-width="3.2"/>' for d in highlights)
    if ring:
        hl = '<circle cx="288" cy="232" r="38" fill="none" stroke="#a6886a" stroke-width="1.4" stroke-dasharray="3 5"/>'
    return (f'<svg viewBox="200 165 130 117"><path d="{PROFILE_AFTER}" stroke="#1f1a17" stroke-width="1.5"/>'
            f'<path d="{BROW} {EYE}" stroke="#1f1a17" stroke-width="1.3"/>{hl}</svg>')


FACE_SKILLS = ["MBBS and Graduate Diploma in Aesthetic Medicine, United Kingdom",
               "Certified in Silhouette and TESSLIFT thread lifts",
               "Trains other doctors at the Line Clinic Academy"]

TIMING = {"id": "timing", "short": "Timing", "q": "When would you like to do it?", "layout": "rows",
          "options": [{"v": "Within 2 weeks"}, {"v": "In 1 to 2 months"}, {"v": "Just exploring"}]}

PAGES = {
    "nose-thread-lift": {
        "title": "Nose Thread Lift by Dr Ram Nath | Line Aesthetics",
        "label": "Nose thread lift &middot; Dr Ram Nath",
        "h1": "A refined nose, <span>without surgery.</span>",
        "sub": "A higher bridge and a lifted tip, done personally by Dr Ram Nath.",
        "facts": ["About 30 minutes", "No cuts", "25+ years experience"],
        "cta": "See if I&rsquo;m suitable",
        "art": NOSE_HERO,
        "skills": ["MBBS and Graduate Diploma in Aesthetic Medicine, United Kingdom",
                   "Certified in Silhouette and TESSLIFT thread lifts",
                   "Trains other doctors at the Line Clinic Academy"],
        "lp": {"treatment": "Nose Thread Lift", "phrase": "a nose thread lift", "ref": "NTL", "steps": [
            {"id": "goal", "short": "I'd like", "q": "What would you like to change?", "layout": "cards", "options": [
                {"v": "Higher bridge", "art": nose_card(BRIDGE)},
                {"v": "Lifted tip", "art": nose_card(TIP)},
                {"v": "Bridge and tip", "art": nose_card(BRIDGE, TIP)},
                {"v": "Not sure yet", "art": nose_card(ring=True)}]},
            {"id": "history", "short": "Previous nose work", "q": "Any nose treatment before?", "layout": "rows", "options": [
                {"v": "None"}, {"v": "Filler"}, {"v": "Thread lift"}, {"v": "Surgery or implant"}]},
            TIMING]},
    },
    "face-thread-lift": {
        "title": "Face Thread Lift by Dr Ram Nath | Line Aesthetics",
        "label": "Face thread lift &middot; Dr Ram Nath",
        "h1": "Lift your jawline, <span>without surgery.</span>",
        "sub": "A firmer jawline and lifted cheeks with threads, done personally by Dr Ram Nath.",
        "facts": ["No surgery", "Back to routine in days", "25+ years experience"],
        "cta": "See if I&rsquo;m suitable",
        "art": FACE_HERO,
        "skills": FACE_SKILLS,
        "lp": {"treatment": "Face Thread Lift", "phrase": "a face thread lift", "ref": "FTL", "steps": [
            {"id": "concern", "short": "Main concern", "q": "What bothers you most?", "layout": "cards", "options": [
                {"v": "Jowls", "art": face_card(JOWL)},
                {"v": "Sagging cheeks", "art": face_card(CHEEK)},
                {"v": "Smile lines", "art": face_card(SMILE)},
                {"v": "Under the chin", "art": face_card(UNDER_CHIN)}]},
            {"id": "age", "short": "Age", "q": "Your age group?", "layout": "rows", "options": [
                {"v": "Under 35"}, {"v": "35 to 44"}, {"v": "45 to 54"}, {"v": "55 and above"}]},
            TIMING]},
    },
}

TEMPLATE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{title}</title>
<meta name="description" content="{sub}">
<meta name="theme-color" content="#f3edea">
<link rel="icon" href="favicon.ico" sizes="any">
<link rel="icon" type="image/png" sizes="32x32" href="assets/favicon-32.png">
<link rel="apple-touch-icon" href="assets/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600&family=Italiana&display=swap">
<link rel="stylesheet" href="la.css?v=3">
</head>
<body>
<noscript><img height="1" width="1" style="display:none" alt="" src="https://www.facebook.com/tr?id={pixel}&amp;ev=PageView&amp;noscript=1"></noscript>
<header class="top"><div class="wrap">
  <img src="assets/logo.png" alt="Line Aesthetics" width="768" height="175">
  <span>Camden Medical Centre<br>Orchard, Singapore</span>
</div></header>

<main>
  <section class="hero"><div class="wrap hero-grid">
    {art}
    <div class="hero-copy">
      <p class="label">{label}</p>
      <h1>{h1}</h1>
      <p class="sub">{sub}</p>
      <ul class="facts">{facts}</ul>
      <a class="btn" href="#check" data-hide-sticky>{cta}<span class="arrow" aria-hidden="true"></span></a>
    </div>
  </div></section>

  <section class="doctor"><div class="wrap doc-grid">
    <div class="portrait reveal"><img src="assets/dr-ram-credentials.webp" alt="Dr Ram Nath at Line Aesthetics Clinic" loading="lazy"></div>
    <div class="reveal">
      <p class="label">Your doctor</p>
      <h2>Dr Ram Nath</h2>
      <p class="role">Founder of Line Aesthetics &middot; 25+ years in aesthetic medicine</p>
      <ul class="skills">{skills}</ul>
      <blockquote class="philo"><p>&ldquo;Our goal is not to change how you look, but to reveal your most confident, natural self.&rdquo;</p><span>Conservative and precise, so results still look like you.</span></blockquote>
      <p class="fine">Qualifications reflect Dr Ram&rsquo;s completed training. Only SMC-accredited qualifications are recognised for medical registration in Singapore.</p>
    </div>
  </div></section>

  <section class="check" id="check"><div class="wrap">
    <div class="check-head reveal"><p class="label">3 questions &middot; 30 seconds</p><h2>Is it right for you?</h2><p>Dr Ram&rsquo;s team replies on WhatsApp with whether it suits you, what it involves and the next available slot. No obligation.</p></div>
    <div class="quiz" id="quiz" data-hide-sticky></div>
  </div></section>
</main>

<footer><div class="wrap">
  <img src="assets/logo.png" alt="Line Aesthetics" width="768" height="175" loading="lazy">
  <p>1 Orchard Boulevard, #05-05 Camden Medical Centre, Singapore 248649 &middot; <a href="https://wa.me/{whatsapp}">+65 8985 5001</a></p>
  <p>Illustrations are for explanation only. Results vary, and all treatments are subject to consultation and assessment of suitability.</p>
</div></footer>

<div class="sticky"><a class="btn" href="#check">{cta}<span class="arrow" aria-hidden="true"></span></a></div>

<script>
window.LP = Object.assign({lp_json}, {{ whatsapp: "{whatsapp}", pixelId: "{pixel}", webhook: "", drPhoto: "assets/dr-ram-suit.webp" }});
</script>
<script src="la.js?v=3"></script>
</body>
</html>
"""

if __name__ == "__main__":
    for slug, p in PAGES.items():
        html = TEMPLATE.format(
            title=p["title"], label=p["label"], h1=p["h1"], sub=p["sub"], cta=p["cta"], art=p["art"],
            facts="".join(f"<li>{f}</li>" for f in p["facts"]),
            skills="".join(f"<li>{s}</li>" for s in p["skills"]),
            lp_json=json.dumps(p["lp"], ensure_ascii=False).replace("</", "<\\/"), whatsapp=WHATSAPP, pixel=PIXEL_ID)
        (HERE / f"{slug}.html").write_text(html, encoding="utf-8")
        print("built", slug)
