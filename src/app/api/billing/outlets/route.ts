import { NextResponse } from "next/server";
import { apiWorkspace, ownedWorkspaces } from "@/lib/auth";
import { outletPriceData, stripe, stripeEnabled, subscriptionItems } from "@/lib/billing";
import { outletLimit, planById } from "@/lib/config";
import { db } from "@/lib/db";
import { errorResponse, readJson } from "@/lib/http";

/**
 * Pro: buys one more outlet (charged now, prorated, on the card on file) or stops paying for a spare
 * one (credited on the next invoice). Outlets are a quantity on one item of the Pro subscription.
 */
export async function POST(req: Request) {
  try {
    const found = await apiWorkspace();
    if (!found) return NextResponse.json({ error: "Log in first." }, { status: 401 });
    const owned = ownedWorkspaces(found.user.id);
    const primary = owned[0];
    if (!primary || !planById(primary.plan).extraOutlets) return NextResponse.json({ error: "Extra outlets are part of the Pro plan." }, { status: 402 });
    if (!stripeEnabled()) return NextResponse.json({ error: "Online payment isn't switched on yet. Message us on Help and we'll add the outlet for you." }, { status: 503 });
    if (!primary.stripe_subscription_id || primary.paid_plan !== "pro") {
      return NextResponse.json({ error: "Outlets are added to a paid Pro subscription. Choose Pro first." }, { status: 409 });
    }
    const { change } = await readJson<{ change?: unknown }>(req, 500);
    if (change !== 1 && change !== -1) return NextResponse.json({ error: "Bad request." }, { status: 400 });
    const current = primary.extra_outlets ?? 0;
    if (change === -1) {
      if (current < 1) return NextResponse.json({ error: "You have no extra outlets to remove." }, { status: 409 });
      if (owned.length > outletLimit(primary) - 1) return NextResponse.json({ error: "Every outlet is in use. Remove one of your businesses first." }, { status: 409 });
    }
    const plan = planById(primary.plan);
    if (change === 1 && plan.businesses + current >= plan.maxOutlets) {
      return NextResponse.json({ error: `${plan.name} covers up to ${plan.maxOutlets} outlets.` }, { status: 409 });
    }

    const sub = await stripe().subscriptions.retrieve(primary.stripe_subscription_id);
    const { outlets } = subscriptionItems(sub);
    const next = current + change;
    const items =
      next === 0
        ? outlets
          ? [{ id: outlets.id, deleted: true }]
          : []
        : outlets
          ? [{ id: outlets.id, quantity: next }]
          : [{ price_data: await outletPriceData(primary.country), quantity: next, metadata: { kind: "outlet" } }];
    await stripe().subscriptions.update(sub.id, {
      items,
      // Adding charges the prorated amount now; removing credits the next invoice.
      proration_behavior: change === 1 ? "always_invoice" : "create_prorations",
      payment_behavior: "error_if_incomplete",
    });
    db().prepare("UPDATE workspaces SET extra_outlets = ? WHERE id = ?").run(next, primary.id);
    return NextResponse.json({ ok: true, extra: next });
  } catch (e) {
    const err = e as { type?: string; message?: string };
    if (err?.type?.startsWith?.("Stripe")) {
      return NextResponse.json({ error: err.type === "StripeCardError" ? `Your card was declined: ${err.message}` : "Stripe couldn't make that change. Try again." }, { status: 402 });
    }
    return errorResponse(e);
  }
}
