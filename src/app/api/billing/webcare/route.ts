import { NextResponse } from "next/server";
import { apiWorkspace, ownedWorkspaces } from "@/lib/auth";
import { stripe, stripeEnabled, subscriptionItems, webcarePriceData } from "@/lib/billing";
import { BRAND, planById } from "@/lib/config";
import { db } from "@/lib/db";
import { errorResponse, readJson } from "@/lib/http";

/**
 * Growth and Pro: adds the website changes add-on to the plan subscription (charged now, prorated,
 * on the card on file) or stops it (credited on the next invoice). It's one item on the subscription
 * with metadata.kind "webcare", held by the account's first business.
 */
export async function POST(req: Request) {
  try {
    const found = await apiWorkspace();
    if (!found) return NextResponse.json({ error: "Log in first." }, { status: 401 });
    const primary = ownedWorkspaces(found.user.id)[0];
    if (!primary || !planById(primary.plan).websiteCare) {
      return NextResponse.json({ error: "Website changes by PULSE is an add-on for the Growth and Pro plans." }, { status: 402 });
    }
    if (!stripeEnabled()) {
      return NextResponse.json({ error: `Online payment isn't switched on yet. Email ${BRAND.contactEmail} to add website changes.` }, { status: 503 });
    }
    if (!primary.stripe_subscription_id || !planById(primary.paid_plan).websiteCare) {
      return NextResponse.json({ error: "Website changes are added to a paid Growth or Pro subscription. Choose one of those plans first." }, { status: 409 });
    }
    const { on } = await readJson<{ on?: unknown }>(req, 500);
    if (typeof on !== "boolean") return NextResponse.json({ error: "Bad request." }, { status: 400 });

    const sub = await stripe().subscriptions.retrieve(primary.stripe_subscription_id);
    const { webcare } = subscriptionItems(sub);
    if (on && !webcare) {
      await stripe().subscriptions.update(sub.id, {
        items: [{ price_data: await webcarePriceData(primary.country), quantity: 1, metadata: { kind: "webcare" } }],
        // Charged for the rest of this month now, on the card on file.
        proration_behavior: "always_invoice",
        payment_behavior: "error_if_incomplete",
      });
    } else if (!on && webcare) {
      await stripe().subscriptions.update(sub.id, {
        items: [{ id: webcare.id, deleted: true }],
        // The unused part of this month is credited to the next invoice.
        proration_behavior: "create_prorations",
        payment_behavior: "error_if_incomplete",
      });
    }
    db().prepare("UPDATE workspaces SET webcare = ? WHERE id = ?").run(on ? 1 : 0, primary.id);
    return NextResponse.json({ ok: true, on });
  } catch (e) {
    const err = e as { type?: string; message?: string };
    if (err?.type?.startsWith?.("Stripe")) {
      return NextResponse.json({ error: err.type === "StripeCardError" ? `Your card was declined: ${err.message}` : "Stripe couldn't make that change. Try again." }, { status: 402 });
    }
    return errorResponse(e);
  }
}
