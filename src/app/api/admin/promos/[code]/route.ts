import { NextResponse } from "next/server";
import { currentUser, isAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { errorResponse, readJson } from "@/lib/http";
import { getPromo, normalizeCode, PromoError, promoFields, type PromoInput } from "@/lib/promos";

async function admin() {
  const user = await currentUser();
  return user && isAdmin(user) ? user : null;
}

/** Admin: change a code. Plan and length apply to people who redeem it from now on. */
export async function PATCH(req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    if (!(await admin())) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
    const code = normalizeCode(decodeURIComponent((await params).code));
    if (!getPromo(code)) return NextResponse.json({ error: "Code not found." }, { status: 404 });
    const f = promoFields(await readJson<PromoInput>(req, 4000));
    const keys = Object.keys(f) as (keyof typeof f)[];
    if (keys.length) db().prepare(`UPDATE promo_codes SET ${keys.map((k) => `${k} = ?`).join(", ")} WHERE code = ?`).run(...keys.map((k) => f[k]), code);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof PromoError) return NextResponse.json({ error: e.message }, { status: 400 });
    return errorResponse(e);
  }
}

/** Admin: delete a code nobody has used. Used codes can only be switched off, so the record stays. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  if (!(await admin())) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  const code = normalizeCode(decodeURIComponent((await params).code));
  const p = getPromo(code);
  if (!p) return NextResponse.json({ error: "Code not found." }, { status: 404 });
  if (p.uses > 0) return NextResponse.json({ error: "Someone has used this code, so switch it off instead of deleting it." }, { status: 409 });
  db().prepare("DELETE FROM promo_codes WHERE code = ?").run(code);
  return NextResponse.json({ ok: true });
}
