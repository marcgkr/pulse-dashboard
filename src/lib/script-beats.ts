// A video or carousel script broken into beats: what to film, the exact words to say and the text
// on screen. Live reports get beats from the model; older reports and the sample templates write one
// line per beat, which beatsFromLines() splits. Client-safe.

export type Beat = {
  /** "0-2s", "Slide 3", "Frame 1", or "" for a general note. */
  time: string;
  /** What to film or show. */
  shot: string;
  /** The exact words to say, or "". */
  say: string;
  /** Text on screen, or "". */
  on_screen: string;
};

export type ShootStyle = {
  format: string;
  setting: string;
  camera: string;
  people: string;
  sound: string;
  editing: string;
};

const TIME = /^\s*((?:\d+(?:\.\d+)?\s*-\s*\d+(?:\.\d+)?\s*s(?:ec(?:onds)?)?)|(?:slide|frame|card|image)\s*\d+|last slide|end card)\s*[:.-]\s*/i;
const QUOTED = `["“']([^"”]+?)["”'](?=[\\s.,;)]|$)`;

function pull(text: string, re: RegExp): { found: string; rest: string } {
  const m = re.exec(text);
  if (!m) return { found: "", rest: text };
  return { found: m[1].trim(), rest: (text.slice(0, m.index) + text.slice(m.index + m[0].length)).replace(/\s{2,}/g, " ").trim() };
}

const tidy = (s: string) =>
  s
    .replace(/[,;:]\s*\./g, ".")
    .replace(/^[\s,.;:-]+|[\s,;:-]+$/g, "")
    .replace(/\s+\./g, ".")
    .trim();

/** Splits "0-2s: Face to camera, text on screen: "MYTH: ...". Say the hook." into a beat. */
export function beatFromLine(line: string): Beat {
  let rest = line.trim();
  let time = "";
  const t = TIME.exec(rest);
  if (t) {
    time = t[1].replace(/\s+/g, "").replace(/^(slide|frame|card|image)(\d+)$/i, (_, a: string, n: string) => `${a[0].toUpperCase()}${a.slice(1).toLowerCase()} ${n}`);
    if (/last slide|end card/i.test(t[1])) time = t[1].replace(/\b\w/g, (c) => c.toUpperCase());
    rest = rest.slice(t[0].length);
  }
  // On-screen text: "text on screen: '...'", "On-screen text: ...", "Text overlay: ...", "Text: ..."
  let on = pull(rest, new RegExp(`(?:on[- ]screen text|text on screen|text overlay|end card|text)\\s*:?\\s*${QUOTED}`, "i"));
  rest = on.rest;
  // Spoken words: "Back to camera: '...'" keeps the direction as the shot; "Say: ..." and "Voiceover: ..." don't.
  const toCamera = new RegExp(`((?:back |face |talk )?to camera)\\s*:\\s*${QUOTED}`, "i").exec(rest);
  let say = { found: "", rest };
  if (toCamera) {
    say = { found: toCamera[2].trim(), rest: (rest.slice(0, toCamera.index) + toCamera[1] + rest.slice(toCamera.index + toCamera[0].length)).trim() };
  } else {
    say = pull(rest, new RegExp(`(?:say|says|voiceover|vo)\\s*:?\\s*${QUOTED}`, "i"));
  }
  rest = say.rest;
  // A slide whose only content is a quoted line: that's the text on the slide.
  if (!on.found && /^(slide|card|image|frame)/i.test(time)) {
    on = pull(rest, new RegExp(`^${QUOTED}`));
    rest = on.rest;
  }
  // A video beat that is only a quoted line is spoken.
  if (!say.found && !on.found && /\d+s$/.test(time)) {
    say = pull(rest, new RegExp(`^${QUOTED}`));
    rest = say.rest;
  }
  return { time, shot: tidy(rest), say: say.found, on_screen: on.found };
}

export function beatsFromLines(lines: string[]): Beat[] {
  return lines.map((l) => l.trim()).filter(Boolean).map(beatFromLine);
}

/** Every spoken line, in order, for "Copy script". */
export function spokenScript(beats: Beat[]): string {
  return beats
    .filter((b) => b.say)
    .map((b) => (b.time ? `[${b.time}] ${b.say}` : b.say))
    .join("\n");
}

const isVideo = (format: string) => /video|reel|tiktok|short|live|story/i.test(format);

/** Sensible defaults when a report has no shoot style (older reports, sample templates). */
export function defaultShootStyle(format: string, platform: string): ShootStyle {
  if (isVideo(format)) {
    return {
      format: `Vertical 9:16 ${platform} video, 15 to 45 seconds`,
      setting: "Where you actually work, tidy and well lit. Face a window for soft light.",
      camera: "Phone on a tripod or propped at eye level, back camera, 1080p or better",
      people: "You or one team member, talking to the camera like you would to a customer",
      sound: "Quiet room or a clip-on mic. Add a trending sound under the voice at low volume if it fits.",
      editing: "Captions on every line, a cut every 2 to 3 seconds, hook text on screen from the first frame",
    };
  }
  return {
    format: /carousel|slide|document/i.test(format) ? `${platform} carousel, 4:5 slides` : `${platform} ${format.toLowerCase()}`,
    setting: "Real photos of your space, team or work where you can; otherwise a plain background in your brand colour",
    camera: "Phone photos in daylight, or a design tool such as Canva",
    people: "No one on camera needed",
    sound: "None",
    editing: "One idea per slide, big readable text, your handle on the last slide",
  };
}
