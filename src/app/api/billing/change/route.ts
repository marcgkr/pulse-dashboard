import { NextResponse } from "next/server";
import { apiWorkspace, primaryWorkspace } from "@/lib/auth";
import { fixedOrInline, stripe, stripeEnabled } from "@/lib/billing";
import { PLANS, planById, type PlanId } from "@/lib/config";
import { db } from "@/lib/db";
import { errorResponse, readJson } from "@/lib/http";

/**
 * Switches an existing subscription to another plan straight away. Upgrades charge the prorated
 * difference now, on the card already on file; downgrades credit the next invoice. Choosing the free
 * plan cancels at the end of the period already paid for.
 */
export async function POST(req: Request) {
  try {
    const found = await apiWorkspace();
    if (!found) return NextResponse.json({ error: "Log in first." }, { status: 401 });
    if (!stripeEnabled()) return NextResponse.json({ error: "Online payment isn't switched on yet." }, { status: 503 });
    const ws = primaryWorkspace(found.user.id) ?? found.ws;
    const { plan } = await readJson<{ plan?: PlanId }>(req, 1000);
    if (!plan || !PLANS.some((p) => p.id === plan)) return NextResponse.json({ error: "Pick a plan." }, { status: 400 });
    if (!ws.stripe_subscription_id) return NextResponse.json({ error: "You don't have a subscription yet. Choose a plan to check out." }, { status: 409 });

    const sub = await stripe().subscriptions.retrieve(ws.stripe_subscription_id);
    if (plan === "free") {
      const s = await stripe().subscriptions.update(sub.id, { cancel_at_period_end: true });
      const end = s.items.data[0]?.current_period_end;
      return NextResponse.json({ ok: true, cancelsAt: end ? new Date(end * 1000).toISOString() : null });
    }

    const item = sub.items.data[0];
    if (!item) return NextResponse.json({ error: "That subscription has no plan on it. Use Manage billing." }, { status: 409 });
    await stripe().subscriptions.update(sub.id, {
      items: [{ id: item.id, ...(await fixedOrInline(plan, ws.country)) }],
      metadata: { ...sub.metadata, plan, workspace_id: ws.id },
      cancel_at_period_end: false,
      proration_behavior: "always_invoice",
      // If the card is declined the switch doesn't happen and the customer sees why.
      payment_behavior: "error_if_incomplete",
    });
    db().prepare("UPDATE workspaces SET plan = ? WHERE id = ?").run(plan, ws.id);
    return NextResponse.json({ ok: true, plan: planById(plan).name });
  } catch (e) {
    const err = e as { type?: string; message?: string };
    if (err?.type?.startsWith?.("Stripe")) {
      return NextResponse.json({ error: err.type === "StripeCardError" ? `Your card was declined: ${err.message}` : "Stripe couldn't make that change. Try again, or use Manage billing." }, { status: 402 });
    }
    return errorResponse(e);
  }
}
