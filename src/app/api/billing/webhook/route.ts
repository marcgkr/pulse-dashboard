import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { planForPrice, stripe } from "@/lib/billing";
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

  if (event.type === "checkout.session.completed") {
    const s = event.data.object as Stripe.Checkout.Session;
    const wsId = s.client_reference_id || s.metadata?.workspace_id;
    const plan = s.metadata?.plan;
    if (wsId && plan) {
      db()
        .prepare("UPDATE workspaces SET plan = ?, stripe_customer_id = COALESCE(?, stripe_customer_id) WHERE id = ?")
        .run(plan, typeof s.customer === "string" ? s.customer : (s.customer?.id ?? null), wsId);
    }
  }

  if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    const sub = event.data.object as Stripe.Subscription;
    const wsId = sub.metadata?.workspace_id;
    if (wsId) {
      const active = sub.status === "active" || sub.status === "trialing";
      const plan = event.type === "customer.subscription.deleted" || !active ? "free" : planForPrice(sub.items.data[0]?.price.id ?? "") ?? sub.metadata?.plan ?? "free";
      db().prepare("UPDATE workspaces SET plan = ? WHERE id = ?").run(plan, wsId);
    }
  }

  return NextResponse.json({ received: true });
}
