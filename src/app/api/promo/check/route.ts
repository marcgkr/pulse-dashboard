import { NextResponse } from "next/server";
import { planById } from "@/lib/config";
import { clientIp, errorResponse, rateLimit, readJson } from "@/lib/http";
import { checkPromo, PromoError } from "@/lib/promos";

/** Checks a promo code at signup, before the account exists. Doesn't use it up. */
export async function POST(req: Request) {
  try {
    if (!rateLimit(`promo-check:${clientIp(req)}`, 20, 60 * 60 * 1000)) {
      return NextResponse.json({ error: "Too many tries. Wait a while and try again." }, { status: 429 });
    }
    const { code } = await readJson<{ code?: unknown }>(req, 1000);
    const p = checkPromo(code);
    return NextResponse.json({ code: p.code, plan: planById(p.plan).name, days: p.days });
  } catch (e) {
    if (e instanceof PromoError) return NextResponse.json({ error: e.message }, { status: 400 });
    return errorResponse(e);
  }
}
