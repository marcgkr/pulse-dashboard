import { NextResponse } from "next/server";
import { apiWorkspace, primaryWorkspace } from "@/lib/auth";
import { appUrl, stripe, stripeEnabled } from "@/lib/billing";

export async function POST(req: Request) {
  const found = await apiWorkspace();
  if (!found) return NextResponse.json({ error: "Log in first." }, { status: 401 });
  // Billing lives on the account's first business, whichever business is open.
  const auth = { user: found.user, ws: primaryWorkspace(found.user.id) ?? found.ws };
  if (!stripeEnabled() || !auth.ws.stripe_customer_id) return NextResponse.json({ error: "No billing account found." }, { status: 400 });
  const session = await stripe().billingPortal.sessions.create({ customer: auth.ws.stripe_customer_id, return_url: `${appUrl(req)}/app/settings#plan` });
  return NextResponse.json({ url: session.url });
}
