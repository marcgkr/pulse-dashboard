import { NextResponse } from "next/server";
import { apiWorkspace, primaryWorkspace } from "@/lib/auth";
import { appUrl, lineItem, stripe, stripeEnabled } from "@/lib/billing";
import { PLANS, type PlanId } from "@/lib/config";

export async function POST(req: Request) {
  const found = await apiWorkspace();
  if (!found) return NextResponse.json({ error: "Log in first." }, { status: 401 });
  // Billing lives on the account's first business, whichever business is open.
  const auth = { user: found.user, ws: primaryWorkspace(found.user.id) ?? found.ws };
  if (!stripeEnabled()) return NextResponse.json({ error: "Online payment isn't switched on yet. Email us to upgrade." }, { status: 503 });
  const { plan } = (await req.json().catch(() => ({}))) as { plan?: PlanId };
  if (!plan || !PLANS.some((p) => p.id === plan && p.id !== "free")) return NextResponse.json({ error: "That plan isn't available for online checkout." }, { status: 400 });
  if (auth.ws.stripe_subscription_id) {
    return NextResponse.json({ error: "You already have a subscription. Switch plans from Settings instead." }, { status: 409 });
  }
  const base = appUrl(req);
  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    line_items: [await lineItem(plan, auth.ws.country)],
    client_reference_id: auth.ws.id,
    metadata: { workspace_id: auth.ws.id, plan },
    subscription_data: { metadata: { workspace_id: auth.ws.id, plan } },
    ...(auth.ws.stripe_customer_id ? { customer: auth.ws.stripe_customer_id } : { customer_email: auth.user.email }),
    // The session id lets Settings apply the plan as soon as they're back, without waiting for the webhook.
    success_url: `${base}/app/settings?checkout={CHECKOUT_SESSION_ID}#plan`,
    cancel_url: `${base}/app/settings#plan`,
    allow_promotion_codes: true,
  });
  return NextResponse.json({ url: session.url });
}
