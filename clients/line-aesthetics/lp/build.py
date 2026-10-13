"""Builds the three Line Aesthetics landing pages from one template.

Run:  python3 build.py           -> writes nose-thread-lift.html, face-thread-lift.html, ha-fillers.html
Assets are expected in ./assets (see assets/README.txt for sources).
"""
import json
from pathlib import Path

HERE = Path(__file__).parent

WHATSAPP = "6589855001"
PIXEL_ID = "4678264112498182"

# Dr Ram's background, from lineaestheticsclinic.com/our-doctor/
CREDS_THREADS = [
    ("MBBS", "United Kingdom"),
    ("Graduate Diploma in Aesthetic Medicine", "United Kingdom"),
    ("Board Certified Diploma in Aesthetic Medicine", "AAAM"),
    ("Silhouette Thread Lift Certification", "Threads"),
    ("Certificate of Mastery, TESSLIFT", "Threads"),
    ("Australasian College of Cosmetic Surgery Training", "Training"),
]
CREDS_FILLER = [
    ("MBBS", "United Kingdom"),
    ("Graduate Diploma in Aesthetic Medicine", "United Kingdom"),
    ("Board Certified Diploma in Aesthetic Medicine", "AAAM"),
    ("International Certificate in Aesthetic Medicine", "AAAM"),
    ("Advanced Botox® Certification", "Injectables"),
    ("Australasian College of Cosmetic Surgery Training", "Training"),
]

PAGES = {
    "nose-thread-lift": {
        "title": "Nose Thread Lift by Dr Ram Nath | Line Aesthetics Clinic",
        "desc": "Non-surgical nose thread lift performed by Dr Ram Nath, 25+ years in aesthetic medicine. Camden Medical Centre, Singapore. Check your suitability in 30 seconds.",
        "eyebrow": "Nose thread lift &middot; Camden Medical Centre",
        "h1": "Reshaping your nose doesn&rsquo;t have to mean <em>surgery.</em>",
        "lede": "A nose thread lift by Dr Ram Nath lifts the bridge and refines the tip in a 20 to 30 minute session. No cuts, no general anaesthetic, and most people are back to normal within a day.",
        "cta": "See if my nose is suitable",
        "ticks": ["Performed personally by Dr Ram", "Planned around Asian nose anatomy", "Results typically last 12 to 18 months"],
        "video": "hero-nose.mp4", "poster": "nose-touch.webp",
        "creds": CREDS_THREADS,
        "doc_line": "Every nose thread lift at Line Aesthetics is performed by Dr Ram himself.",
        "steps_title": "What happens at your appointment",
        "steps": [
            ("Assessment", "Dr Ram checks three things first: skin thickness over the bridge, the strength of your tip cartilage, and the blood vessels in the area."),
            ("Threads placed", "Under local anaesthetic, fine dissolvable threads are guided along the bridge and into the tip. It takes about 20 to 30 minutes."),
            ("Settling", "You see the lift straight away. Over the following weeks collagen forms around the threads as they dissolve."),
        ],
        "split_img": "profile-side.webp", "split_pos": "50% 30%",
        "split_title": "Is it right for <em>your</em> nose?",
        "split_lede": "Threads work with your own anatomy. Not every nose is suited, and Dr Ram will tell you honestly if yours isn&rsquo;t.",
        "can": ["Raise a low or flat bridge", "Lift and define a rounded tip", "Straighten the profile line", "Leave no visible scars"],
        "cant": ["Remove a large hump or narrow bone", "Last forever; a top-up keeps the result", "Suit every nose, which is why assessment comes first"],
        "reel": {"id": "Dahxypgk96X", "poster": "nose-model-cream.webp", "title": "Hear how Dr Ram plans a nose thread lift",
                 "text": "Dr Ram explains what a nose thread lift can change, who it suits, and why the assessment matters more than the threads."},
        "faq": [
            ("Does it hurt?", "The nose is numbed with local anaesthetic first. Most people describe pressure rather than pain."),
            ("How much downtime is there?", "Most people return to normal activities within a day. Some swelling or bruising is possible in the first few days."),
            ("How long does it last?", "Typically 12 to 18 months. A top-up before the result fully fades usually needs fewer threads than starting again."),
            ("I&rsquo;ve had filler or surgery on my nose. Can I still do this?", "Possibly. Previous procedures change the blood vessel and tissue picture, so Dr Ram reviews your history carefully before recommending anything."),
            ("Threads or filler for the nose?", "Threads lift and define, especially at the tip. Filler adds height and volume. Some noses do best with one, some with both."),
        ],
        "closing": "Find out what your nose can look like",
        "lp": {
            "treatment": "Nose Thread Lift", "phrase": "a nose thread lift", "ref": "NTL",
            "steps": [
                {"id": "goal", "short": "What I'd like to change", "q": "What would you most like to change?", "layout": "cards", "options": [
                    {"v": "A higher bridge", "img": "assets/profile-side.webp", "pos": "60% 30%", "size": "190%"},
                    {"v": "A lifted, refined tip", "img": "assets/nose-touch.webp", "pos": "52% 34%", "size": "200%"},
                    {"v": "Both bridge and tip", "img": "assets/nose-model-cream.webp", "pos": "48% 30%", "size": "230%"},
                    {"v": "Not sure yet", "note": "I'd like Dr Ram's advice", "img": "assets/model-cream.webp", "pos": "60% 30%", "size": "200%"}]},
                {"id": "history", "short": "Previous nose procedures", "q": "Have you had anything done to your nose before?", "hint": "This matters for safety, so Dr Ram reviews it first.", "layout": "rows", "options": [
                    {"v": "Nothing before"}, {"v": "Nose filler"}, {"v": "A nose thread lift"}, {"v": "Surgery or an implant"}]},
                {"id": "timing", "short": "Timing", "q": "When would you like to do it?", "layout": "rows", "options": [
                    {"v": "Within the next 2 weeks"}, {"v": "In the next 1 to 2 months"}, {"v": "I'm just exploring for now"}]},
            ],
        },
        "result_js": """function (a) {
          var h = a.history || "";
          if (/filler|Surgery/.test(h)) return "Because you've had " + h.toLowerCase() + " before, Dr Ram will review the tissue and blood vessels carefully at your consultation before recommending threads. Many people with previous work are still suitable.";
          if (h === "A nose thread lift") return "Good news for a top-up: going back before the result fully fades usually needs fewer threads. Dr Ram will check how your last threads have settled.";
          return "From your answers, a nose thread lift may suit you. Dr Ram will confirm at your consultation after checking your skin thickness, tip cartilage and blood vessels.";
        }""",
    },
    "face-thread-lift": {
        "title": "Face Thread Lift by Dr Ram Nath | Line Aesthetics Clinic",
        "desc": "Lift a heavy jawline and sagging cheeks without surgery. Thread lifts performed by Dr Ram Nath, 25+ years in aesthetic medicine. Camden Medical Centre, Singapore.",
        "eyebrow": "Face thread lift &middot; Camden Medical Centre",
        "h1": "Lift a heavy jawline without surgery or weeks <em>at home.</em>",
        "lede": "Dr Ram Nath uses ultra-fine dissolvable threads to reposition sagging tissue for a lift you see the same day. As they dissolve, they boost your own collagen. Most people are back to their routine within a few days.",
        "cta": "See if a thread lift suits me",
        "ticks": ["Treatment performed by Dr Ram", "Silhouette and TESSLIFT certified", "A natural lift, never an overdone look"],
        "video": "hero-face.mp4", "poster": "face-hands.webp",
        "creds": CREDS_THREADS,
        "doc_line": "Thread lifts at Line Aesthetics are planned and performed by Dr Ram.",
        "steps_title": "A lift now, firmer skin later",
        "steps": [
            ("Assessment", "Dr Ram looks at where your face has descended, how much laxity there is, and whether threads are the right tool for you."),
            ("The lift", "Under local anaesthetic, threads are placed beneath the skin to gently reposition sagging tissue. You see the lift straight away."),
            ("The collagen stage", "Over the following months the threads dissolve and stimulate collagen, improving firmness and skin quality."),
        ],
        "split_img": "jowls.webp", "split_pos": "50% 40%",
        "split_title": "Who a thread lift <em>suits</em>",
        "split_lede": "The biggest misconception is that a lift has to mean surgery. For the right face, threads do the job with far less downtime. For others, Dr Ram will say so.",
        "can": ["Early to moderate jowls and a softening jawline", "Cheeks that have dropped and deepened smile lines", "People who can&rsquo;t take weeks off work", "Anyone who wants to look refreshed, not changed"],
        "cant": ["Very loose skin that needs surgical removal", "Volume loss with little sagging, where filler may do more", "Anyone wanting a permanent change"],
        "reel": None,
        "faq": [
            ("How much downtime should I plan for?", "Most people are back to their daily routine within a few days. Swelling, tenderness or bruising can happen early on."),
            ("Does it hurt?", "The areas are numbed with local anaesthetic first. You may feel pressure during, and some tenderness afterwards."),
            ("Will it look natural?", "The aim is to put tissue back where it used to sit, so you look refreshed rather than different. Dr Ram plans the direction of every thread around your face."),
            ("How long do results last?", "It depends on the threads, the areas treated and your skin. Dr Ram will give you a realistic timeframe at consultation."),
            ("Can it be combined with filler or skin boosters?", "Sometimes threads and filler work well together, one for lift and one for volume. That&rsquo;s decided after Dr Ram examines you."),
        ],
        "closing": "See if threads suit your face",
        "lp": {
            "treatment": "Face Thread Lift", "phrase": "a face thread lift", "ref": "FTL",
            "steps": [
                {"id": "concern", "short": "Main concern", "q": "What bothers you most when you look in the mirror?", "layout": "cards", "options": [
                    {"v": "Jowls or a heavy jawline", "img": "assets/jowls.webp", "pos": "45% 70%", "size": "170%"},
                    {"v": "Cheeks that have dropped", "img": "assets/face-hands.webp", "pos": "50% 45%", "size": "160%"},
                    {"v": "Deep smile lines", "img": "assets/tired-face.webp", "pos": "50% 62%", "size": "190%"},
                    {"v": "Loose skin under the chin", "img": "assets/jawline.webp", "pos": "40% 75%", "size": "160%"}]},
                {"id": "age", "short": "Age group", "q": "Which age group are you in?", "hint": "Skin quality changes with age, so this helps Dr Ram prepare.", "layout": "rows", "options": [
                    {"v": "Under 35"}, {"v": "35 to 44"}, {"v": "45 to 54"}, {"v": "55 and above"}]},
                {"id": "timing", "short": "Timing", "q": "When would you like to do it?", "layout": "rows", "options": [
                    {"v": "Within the next 2 weeks"}, {"v": "In the next 1 to 2 months"}, {"v": "I'm just exploring for now"}]},
            ],
        },
        "result_js": """function (a) {
          if (a.age === "Under 35") return "At your stage, threads may be more than you need. Dr Ram will assess honestly and may suggest a lighter option if it suits you better.";
          if (a.age === "55 and above") return "A thread lift may suit you. With more laxity, Dr Ram will look closely at whether threads alone will give the lift you want, or whether combining treatments makes more sense.";
          return "From your answers, a thread lift may suit you. Dr Ram will confirm at your consultation once he has assessed where your face has descended.";
        }""",
    },
    "ha-fillers": {
        "title": "HA Fillers by Dr Ram Nath | Line Aesthetics Clinic",
        "desc": "Doctor-led hyaluronic acid fillers for under-eyes, cheeks, lips, chin and jawline, planned by Dr Ram Nath, 25+ years in aesthetic medicine. Camden Medical Centre, Singapore.",
        "eyebrow": "HA fillers &middot; Camden Medical Centre",
        "h1": "Natural-looking filler, planned by a doctor with <em>25 years&rsquo;</em> experience.",
        "lede": "Under-eyes, cheeks, lips, chin or jawline. Dr Ram Nath assesses your facial anatomy first, then recommends only what suits your face, using reputable FDA-approved and CE-marked hyaluronic acid brands.",
        "cta": "Find out what I'd need",
        "ticks": ["A personal consultation with Dr Ram", "FDA-approved and CE-marked HA brands", "Hyaluronic acid can be dissolved if ever needed"],
        "video": "hero-ha.mp4", "poster": "hero-model.webp",
        "creds": CREDS_FILLER,
        "doc_line": "Every filler plan at Line Aesthetics starts with Dr Ram&rsquo;s assessment of your face.",
        "steps_title": "How your appointment runs",
        "steps": [
            ("Assessment", "Dr Ram looks at your facial structure, the areas you&rsquo;d like to discuss, and whether filler is the right choice at all."),
            ("Your plan", "He explains which areas, how much product and why, so you agree on the plan before anything is injected."),
            ("Treatment", "Filler is placed with care for anatomy and blood vessels. Most people go back to their day straight after."),
        ],
        "split_img": "tired-face.webp", "split_pos": "50% 35%",
        "split_title": "Filler is not <em>one size fits all</em>",
        "split_lede": "The same syringe placed in a different spot gives a very different result. That&rsquo;s why the plan starts with your face, not the product.",
        "can": ["Soften under-eye hollows and shadows", "Restore cheek volume and support", "Shape and balance the lips", "Define the chin and jawline"],
        "cant": ["Lift sagging skin, where threads may do more", "Replace good skincare and sleep", "Look right without a proper assessment"],
        "reel": None,
        "faq": [
            ("Does it hurt?", "Many HA fillers contain a local anaesthetic, and numbing can be used beforehand. Most people feel brief pinches and pressure."),
            ("How long does filler last?", "It depends on the product and the area. Areas that move a lot, like the lips, tend to fade sooner. Dr Ram will tell you what to expect for yours."),
            ("Will I look overdone?", "Not if the plan is right. Dr Ram works in proportion with your features and would rather recommend less product than too much."),
            ("Is there downtime?", "Most people return to their day straight after. Mild swelling or bruising can show for a few days, especially under the eyes and in the lips."),
            ("Can filler be reversed?", "Hyaluronic acid filler can be dissolved with an enzyme if ever needed, which is one reason Dr Ram uses it."),
        ],
        "closing": "Get a filler plan made for your face",
        "lp": {
            "treatment": "HA Fillers", "phrase": "HA fillers", "ref": "HAF",
            "steps": [
                {"id": "area", "short": "Area", "q": "Which area would you like to improve?", "layout": "cards", "options": [
                    {"v": "Under-eyes", "img": "assets/tired-face.webp", "pos": "50% 30%", "size": "190%"},
                    {"v": "Cheeks", "img": "assets/face-glow.webp", "pos": "45% 45%", "size": "170%"},
                    {"v": "Lips", "img": "assets/hero-model.webp", "pos": "48% 62%", "size": "260%"},
                    {"v": "Chin and jawline", "img": "assets/jawline.webp", "pos": "45% 65%", "size": "150%"},
                    {"v": "Nose", "img": "assets/nose-model-cream.webp", "pos": "48% 30%", "size": "230%"},
                    {"v": "More than one area", "img": "assets/model-flower.webp", "pos": "50% 30%", "size": "130%"}]},
                {"id": "history", "short": "Filler before", "q": "Have you had filler before?", "layout": "rows", "options": [
                    {"v": "No, this would be my first time"}, {"v": "Yes, in the last 12 months"}, {"v": "Yes, over a year ago"}]},
                {"id": "timing", "short": "Timing", "q": "When would you like to do it?", "layout": "rows", "options": [
                    {"v": "Within the next 2 weeks"}, {"v": "In the next 1 to 2 months"}, {"v": "I'm just exploring for now"}]},
            ],
        },
        "result_js": """function (a) {
          if (/first/.test(a.history || "")) return "As it's your first time, Dr Ram will walk you through your options and start conservatively, so you can see how your face responds.";
          if (a.area === "More than one area") return "Dr Ram will look at your face as a whole and suggest which area makes the biggest difference first, rather than treating everything at once.";
          return "From your answers, filler for your " + (a.area || "chosen area").toLowerCase() + " may suit you. Dr Ram will confirm after assessing the area at your consultation.";
        }""",
    },
}

TEMPLATE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{title}</title>
<meta name="description" content="{desc}">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:image" content="assets/dr-ram-credentials.webp">
<meta name="theme-color" content="#f5f0e7">
<link rel="icon" href="assets/logo.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Inter:wght@400;500;600&display=swap">
<link rel="preload" as="image" href="assets/{poster}">
<link rel="stylesheet" href="lp.css">
</head>
<body>
<noscript><img height="1" width="1" style="display:none" alt="" src="https://www.facebook.com/tr?id={pixel}&amp;ev=PageView&amp;noscript=1"></noscript>

<header class="top"><div class="wrap">
  <a class="logo" href="#top"><img src="assets/logo.png" alt="Line Aesthetics" width="768" height="175"></a>
  <span class="top-loc">Camden Medical Centre<br>Orchard, Singapore</span>
  <a class="btn top-cta" href="#" data-open>{cta}</a>
</div></header>

<main id="top">
  <section class="hero"><div class="wrap hero-grid">
    <div class="hero-copy">
      <p class="eyebrow">{eyebrow}</p>
      <h1>{h1}</h1>
      <p class="lede">{lede}</p>
      <div class="hero-cta" data-hide-sticky>
        <a class="btn" href="#" data-open>{cta} <span class="arr" aria-hidden="true"></span></a>
        <small>3 quick questions &middot; about 30 seconds</small>
      </div>
      <ul class="ticks">{ticks}</ul>
    </div>
    <div class="hero-media">
      <div class="arch"><video autoplay muted loop playsinline preload="metadata" poster="assets/{poster}" aria-hidden="true"><source src="assets/{video}" type="video/mp4"></video></div>
      <div class="dr-tag"><img src="assets/dr-ram-suit.webp" alt=""><div><b>Dr Ram Nath</b><span>25+ years in aesthetic medicine</span></div></div>
    </div>
  </div></section>

  <section class="sec doctor" id="dr-ram"><div class="wrap doc-grid">
    <figure class="doc-photo">
      <img src="assets/dr-ram-credentials.webp" alt="Dr Ram Nath in his consultation room at Line Aesthetics Clinic" loading="lazy">
      <figcaption>Dr Ram Nath, Founder and Lead Aesthetic Physician</figcaption>
    </figure>
    <div class="doc-copy">
      <p class="eyebrow">Your doctor</p>
      <h2>Refining faces with a light hand <em>since 2001.</em></h2>
      <div class="since">
        <div><b>25+</b><span>years in aesthetic medicine</span></div>
        <div><b>2001</b><span>opened his first aesthetic practice</span></div>
        <div><b>8</b><span>professional memberships</span></div>
      </div>
      <p>Dr Ram trained in medicine in the United Kingdom and has practised aesthetic medicine for more than 25 years. He founded Line Aesthetics Clinic at Camden Medical Centre, and the Line Clinic Academy, where he trains the doctors who work alongside him.</p>
      <p>His approach is evidence-based and conservative: careful dosing, precise technique and results that still look like you. {doc_line}</p>
      <ul class="creds">{creds}</ul>
      <p class="members"><b>Member of</b> the Society of Aesthetic Medicine (Singapore), the Singapore Medical Association, the American Academy of Aesthetic Medicine, the European College of Aesthetic Medicine and the Australasian College of Cosmetic Surgery.</p>
      <blockquote class="quote">&ldquo;Our goal is not to change how you look, but to reveal your most confident, natural self.&rdquo;</blockquote>
      <div class="doc-strip">
        <img src="assets/dr-ram-consult.webp" alt="Dr Ram Nath during a consultation" loading="lazy">
        <img src="assets/dr-ram-clinic.webp" alt="Dr Ram Nath at Line Aesthetics Clinic" loading="lazy">
        <img src="assets/dr-ram-certificates.webp" alt="Dr Ram Nath in front of his certificates" loading="lazy">
      </div>
      <p class="fine-dark">All qualifications and memberships listed reflect Dr Ram&rsquo;s completed training and professional affiliations. Only qualifications accredited by the Singapore Medical Council (SMC) are recognised for medical registration and practice in Singapore.</p>
    </div>
  </div></section>

  <section class="sec"><div class="wrap">
    <div class="sec-head"><p class="eyebrow">Your visit</p><h2>{steps_title}</h2></div>
    <ol class="steps">{steps}</ol>
  </div></section>

  <span class="slash" aria-hidden="true"></span>

  <section class="sec"><div class="wrap split">
    <img src="assets/{split_img}" alt="" loading="lazy" style="object-position:{split_pos}">
    <div>
      <p class="eyebrow">Suitability</p>
      <h2>{split_title}</h2>
      <p style="color:var(--soft);margin:16px 0 0">{split_lede}</p>
      <div class="two-col">
        <div><h3>It can</h3><ul>{can}</ul></div>
        <div class="no"><h3>It won&rsquo;t</h3><ul>{cant}</ul></div>
      </div>
      <p style="margin-top:30px"><a class="btn btn-ghost" href="#" data-open>Check my suitability <span class="arr" aria-hidden="true"></span></a></p>
    </div>
  </div></section>
{reel}
  <section class="sec faq" style="padding-top:24px"><div class="wrap">
    <div class="sec-head"><p class="eyebrow">Questions</p><h2>What people ask Dr Ram</h2></div>
    {faq}
  </div></section>

  <section class="closing" data-hide-sticky><div class="wrap closing-grid">
    <div class="closing-copy">
      <p class="eyebrow">Consultation with Dr Ram Nath</p>
      <h2>{closing}</h2>
      <p>Answer three quick questions and your answers go straight to Dr Ram&rsquo;s team on WhatsApp.</p>
      <a class="btn btn-dark" href="#" data-open>{cta} <span class="arr" aria-hidden="true"></span></a>
    </div>
    <img src="assets/dr-ram-suit.webp" alt="Dr Ram Nath" loading="lazy">
  </div></section>
</main>

<footer><div class="wrap">
  <img src="assets/logo.png" alt="Line Aesthetics" width="768" height="175" loading="lazy">
  <p>1 Orchard Boulevard, #05-05 Camden Medical Centre, Singapore 248649 &middot; <a href="https://wa.me/{whatsapp}">+65 8985 5001</a> &middot; info@linehealth.sg</p>
  <p>Mon, Tue, Thu, Fri 10am to 7pm &middot; Wed 11am to 8pm &middot; Sat 10am to 2pm &middot; Closed Sundays and public holidays</p>
  <p>Results vary from person to person. All treatments are subject to a medical consultation and assessment of suitability.</p>
</div></footer>

<div class="sticky"><a class="btn" href="#" data-open>{cta}</a></div>

<script>
window.LP = Object.assign({lp_json}, {{
  whatsapp: "{whatsapp}",
  pixelId: "{pixel}",
  webhook: "",
  drPhoto: "assets/dr-ram-suit.webp",
  result: {result_js}
}});
</script>
<script src="lp.js"></script>
</body>
</html>
"""

REEL = """
  <section class="sec" style="padding-top:24px"><div class="wrap reel">
    <div class="reel-frame"><button type="button" data-reel="{id}" style="background-image:url(assets/{poster})" aria-label="Play video: {title}"></button><span>Watch on Instagram</span></div>
    <div>
      <p class="eyebrow">From Dr Ram</p>
      <h2>{title}</h2>
      <p style="color:var(--soft);margin:16px 0 28px;max-width:32em">{text}</p>
      <a class="btn" href="#" data-open>Check my suitability <span class="arr" aria-hidden="true"></span></a>
    </div>
  </div></section>
"""


def li(items):
    return "".join(f"<li>{x}</li>" for x in items)


def build(slug, p):
    reel = REEL.format(**p["reel"]) if p["reel"] else ""
    html = TEMPLATE.format(
        title=p["title"], desc=p["desc"], eyebrow=p["eyebrow"], h1=p["h1"], lede=p["lede"], cta=p["cta"],
        ticks=li(p["ticks"]), video=p["video"], poster=p["poster"], doc_line=p["doc_line"],
        creds="".join(f"<li>{a}<span>{b}</span></li>" for a, b in p["creds"]),
        steps_title=p["steps_title"],
        steps="".join(f"<li><h3>{a}</h3><p>{b}</p></li>" for a, b in p["steps"]),
        split_img=p["split_img"], split_pos=p["split_pos"], split_title=p["split_title"], split_lede=p["split_lede"],
        can=li(p["can"]), cant=li(p["cant"]), reel=reel,
        faq="".join(f"<details><summary>{q}</summary><p>{a}</p></details>" for q, a in p["faq"]),
        closing=p["closing"], lp_json=json.dumps(p["lp"], ensure_ascii=False), result_js=p["result_js"].strip(),
        whatsapp=WHATSAPP, pixel=PIXEL_ID,
    )
    (HERE / f"{slug}.html").write_text(html, encoding="utf-8")


if __name__ == "__main__":
    for slug, page in PAGES.items():
        build(slug, page)
        print("built", slug)
