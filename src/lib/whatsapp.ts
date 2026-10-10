// WhatsApp for support: the wa.me link Pro owners tap, and a best-effort alert to the PULSE team
// when an owner writes in the Help chat (WhatsApp Cloud API).

const GRAPH = "https://graph.facebook.com/v23.0";
const THROTTLE_MS = 10 * 60_000;

/** The team's WhatsApp number from SUPPORT_WHATSAPP, digits only. Null when unset. */
export function supportWhatsAppNumber(): string | null {
  const digits = (process.env.SUPPORT_WHATSAPP ?? "").replace(/\D/g, "");
  return digits || null;
}

/** Opens a WhatsApp chat with the team, with the business named in the first message. */
export function supportWhatsAppLink(businessName: string): string | null {
  const number = supportWhatsAppNumber();
  if (!number) return null;
  return `https://wa.me/${number}?text=${encodeURIComponent(`Hi PULSE, it's ${businessName} (MarketingRx Pro).`)}`;
}

// When each thread last alerted the team. Per process, so a restart can let one extra alert through.
const g = globalThis as unknown as { __supportAlerts?: Map<string, number> };
const lastAlert = (g.__supportAlerts ??= new Map());

/**
 * Tells the team on WhatsApp that a business wrote in the Help chat. Business-initiated WhatsApp
 * messages need a template approved in WhatsApp Manager, with two body variables: the business name
 * and the message. At most one alert per thread every 10 minutes. Does nothing unless every setting
 * is there, and never throws: the owner's message is already saved.
 */
export async function alertSupportTeam(workspaceId: string, businessName: string, message: string): Promise<void> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const to = (process.env.SUPPORT_NOTIFY_NUMBERS ?? "")
    .split(",")
    .map((n) => n.replace(/\D/g, ""))
    .filter(Boolean);
  if (!token || !phoneId || !to.length) return;

  const at = Date.now();
  if (at - (lastAlert.get(workspaceId) ?? 0) < THROTTLE_MS) return;
  lastAlert.set(workspaceId, at);
  if (lastAlert.size > 10_000) for (const [k, v] of lastAlert) if (at - v >= THROTTLE_MS) lastAlert.delete(k);

  // Template variables can't hold new lines, tabs or long runs of spaces.
  const text = (s: string, max: number) => s.replace(/\s+/g, " ").trim().slice(0, max) || "-";
  const template = {
    name: process.env.WHATSAPP_TEMPLATE || "new_support_message",
    language: { code: process.env.WHATSAPP_TEMPLATE_LANG || "en" },
    components: [{ type: "body", parameters: [{ type: "text", text: text(businessName, 120) }, { type: "text", text: text(message, 200) }] }],
  };
  await Promise.all(
    to.map(async (number) => {
      try {
        const res = await fetch(`${GRAPH}/${encodeURIComponent(phoneId)}/messages`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ messaging_product: "whatsapp", to: number, type: "template", template }),
          signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) {
          const err = ((await res.json().catch(() => ({}))) as { error?: { code?: number; message?: string } }).error;
          console.warn(`[support] WhatsApp alert failed (${res.status}${err?.code ? `, code ${err.code}` : ""}): ${err?.message ?? "no details"}`);
        }
      } catch (e) {
        console.warn("[support] WhatsApp alert failed:", (e as Error).name);
      }
    }),
  );
}
