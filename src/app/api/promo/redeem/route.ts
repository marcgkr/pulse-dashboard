import { NextResponse } from "next/server";
import { apiWorkspace, primaryWorkspace } from "@/lib/auth";
import { planById } from "@/lib/config";
import { errorResponse, rateLimit, readJson } from "@/lib/http";
import { PromoError, redeemPromo } from "@/lib/promos";

/** Settings > Plan > Have a promo code? Applies to the whole account. */
export async function POST(req: Request) {
  try {
    const auth = await apiWorkspace();
    if (!auth) return NextResponse.json({ error: "Log in first." }, { status: 401 });
    if (!rateLimit(`promo-redeem:${auth.user.id}`, 10, 60 * 60 * 1000)) {
      return NextResponse.json({ error: "Too many tries. Wait a while and try again." }, { status: 429 });
    }
    const { code } = await readJson<{ code?: unknown }>(req, 1000);
    const r = redeemPromo(primaryWorkspace(auth.user.id) ?? auth.ws, code, auth.user.email);
    return NextResponse.json({ plan: planById(r.plan).name, until: r.until });
  } catch (e) {
    if (e instanceof PromoError) return NextResponse.json({ error: e.message }, { status: 400 });
    return errorResponse(e);
  }
}
