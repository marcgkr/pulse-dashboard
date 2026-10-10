// Speech to text for the owner's own videos (ElevenLabs Scribe). Server only. Never log the API key
// or the signed media links, which work as short-lived credentials.

import { ConnectorError, fetchJson, scrub } from "./connectors/http";

const env = (k: string) => process.env[k]?.trim() || "";

export function transcriptionReady(): boolean {
  return Boolean(env("ELEVENLABS_API_KEY"));
}

const base = () => (env("ELEVENLABS_API_BASE") || "https://api.elevenlabs.io").replace(/\/+$/, "");
const model = () => env("ELEVENLABS_STT_MODEL") || "scribe_v2";

/** Where Meta serves video files from. Anything else is refused before we download it. */
const MEDIA_HOSTS = [/\.cdninstagram\.com$/, /\.fbcdn\.net$/, /(^|\.)facebook\.com$/];
const MAX_UPLOAD_BYTES = 200 * 1024 * 1024;

export function allowedMediaUrl(u: string): boolean {
  try {
    const url = new URL(u);
    return url.protocol === "https:" && MEDIA_HOSTS.some((re) => re.test(url.hostname));
  } catch {
    return false;
  }
}

async function send(form: FormData): Promise<string> {
  const key = env("ELEVENLABS_API_KEY");
  const res = await fetchJson(`${base()}/v1/speech-to-text`, { method: "POST", headers: { "xi-api-key": key }, body: form }, { timeoutMs: 600_000 });
  if (!res.ok) {
    const b = (res.body ?? {}) as { detail?: { message?: string } | string };
    const msg = typeof b.detail === "string" ? b.detail : (b.detail?.message ?? `HTTP ${res.status}`);
    throw new ConnectorError(`Transcription failed: ${scrub(msg, [key])}`, res.status === 401 ? "auth" : res.status === 429 ? "rate_limit" : "api", res.status);
  }
  const text = (res.body as { text?: unknown })?.text;
  return typeof text === "string" ? text.trim() : "";
}

function baseForm(): FormData {
  const form = new FormData();
  form.set("model_id", model());
  form.set("tag_audio_events", "false");
  return form;
}

/**
 * Transcribes a video by link. ElevenLabs fetches the file itself; if it can't, we download it
 * (Meta hosts only, up to 200 MB) and upload it.
 */
export async function transcribeMediaUrl(mediaUrl: string): Promise<string> {
  if (!transcriptionReady()) throw new ConnectorError("Transcription isn't switched on.", "config");
  if (!allowedMediaUrl(mediaUrl)) throw new ConnectorError("That video link isn't one we can read.", "api");
  const byLink = baseForm();
  byLink.set("cloud_storage_url", mediaUrl);
  try {
    return await send(byLink);
  } catch (e) {
    if (!(e instanceof ConnectorError) || e.status < 400 || e.status >= 500 || e.code === "auth" || e.code === "rate_limit") throw e;
  }
  const res = await fetch(mediaUrl, { redirect: "error", signal: AbortSignal.timeout(300_000) }).catch(() => null);
  if (!res?.ok || !res.body) throw new ConnectorError("Couldn't download the video for transcription.", "api", res?.status ?? 0);
  if (Number(res.headers.get("content-length") || 0) > MAX_UPLOAD_BYTES) {
    await res.body.cancel().catch(() => {});
    throw new ConnectorError("The video is too large to transcribe.", "too_much_data");
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  const reader = res.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > MAX_UPLOAD_BYTES) {
      await reader.cancel().catch(() => {});
      throw new ConnectorError("The video is too large to transcribe.", "too_much_data");
    }
    chunks.push(value);
  }
  const upload = baseForm();
  upload.set("file", new Blob([Buffer.concat(chunks)], { type: res.headers.get("content-type") || "video/mp4" }), "video.mp4");
  return send(upload);
}
