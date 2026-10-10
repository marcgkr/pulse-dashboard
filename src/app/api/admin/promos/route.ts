import { NextResponse } from "next/server";
import { currentUser, isAdmin } from "@/lib/auth";
import { db, now } from "@/lib/db";
import { errorResponse, readJson } from "@/lib/http";
import { generateCode, getPromo, normalizeCode, PromoError, promoFields, validCode, type PromoInput } from "@/lib/promos";

/** Admin: create a promo code. Leave the code blank to generate one. */
export async function POST(req: Request) {
  try {
    const user = await currentUser();
    if (!user || !isAdmin(user)) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
    const body = await readJson<PromoInput & { code?: unknown }>(req, 4000);
    const code = body.code ? normalizeCode(body.code) : generateCode();
    if (!validCode(code)) return NextResponse.json({ error: "Codes are 3 to 32 letters, numbers or dashes." }, { status: 400 });
    if (getPromo(code)) return NextResponse.json({ error: "That code already exists. Pick another." }, { status: 409 });
    const f = promoFields({ plan: body.plan ?? "pro", days: body.days ?? null, max_uses: body.max_uses ?? null, redeem_by: body.redeem_by ?? null, note: body.note ?? "" });
    db()
      .prepare("INSERT INTO promo_codes (code, plan, days, max_uses, uses, redeem_by, note, active, created_at) VALUES (?, ?, ?, ?, 0, ?, ?, 1, ?)")
      .run(code, f.plan, f.days, f.max_uses, f.redeem_by, f.note, now());
    return NextResponse.json({ code });
  } catch (e) {
    if (e instanceof PromoError) return NextResponse.json({ error: e.message }, { status: 400 });
    return errorResponse(e);
  }
}
