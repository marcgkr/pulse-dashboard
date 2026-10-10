import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { applyCheckout, planOfSubscription, stripe, subscriptionItems } from "@/lib/billing";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Webhook not configured." }, { status: 503 });
  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(body, req.headers.get("stripe-signature") ?? "", secret);
  } catch {
    return NextResponse.json({ error: "Bad signature." }, { status: 400 });
  }

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    applyCheckout(event.data.object as Stripe.Checkout.Session);
  }

  if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    const sub = event.data.object as Stripe.Subscription;
    // Only the workspace's current subscription can change its plan; stale or duplicate ones are ignored.
    const ws = db().prepare("SELECT id FROM workspaces WHERE stripe_subscription_id = ?").get(sub.id) as { id: string } | undefined;
    if (ws) {
      const active = sub.status === "active" || sub.status === "trialing";
      if (event.type === "customer.subscription.deleted" || !active) {
        db().prepare("UPDATE workspaces SET plan = 'free', extra_outlets = 0, webcare = 0, stripe_subscription_id = CASE WHEN ? THEN NULL ELSE stripe_subscription_id END WHERE id = ?").run(event.type === "customer.subscription.deleted" ? 1 : 0, ws.id);
      } else {
        const plan = planOfSubscription(sub);
        if (plan) db().prepare("UPDATE workspaces SET plan = ? WHERE id = ?").run(plan, ws.id);
        else console.warn(`[stripe] subscription ${sub.id} has a price that isn't mapped to a plan; plan left unchanged`);
        const items = subscriptionItems(sub);
        db().prepare("UPDATE workspaces SET extra_outlets = ?, webcare = ? WHERE id = ?").run(items.outlets?.quantity ?? 0, items.webcare ? 1 : 0, ws.id);
      }
    }
  }

  return NextResponse.json({ received: true });
}
