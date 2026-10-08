import { NextResponse } from "next/server";
import { apiWorkspace } from "@/lib/auth";
import { appUrl, stripe, stripeEnabled } from "@/lib/billing";

export async function POST(req: Request) {
  const auth = await apiWorkspace();
  if (!auth) return NextResponse.json({ error: "Log in first." }, { status: 401 });
  if (!stripeEnabled() || !auth.ws.stripe_customer_id) return NextResponse.json({ error: "No billing account found." }, { status: 400 });
  const session = await stripe().billingPortal.sessions.create({ customer: auth.ws.stripe_customer_id, return_url: `${appUrl(req)}/app/settings#plan` });
  return NextResponse.json({ url: session.url });
}
