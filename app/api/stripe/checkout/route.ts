import { NextResponse, type NextRequest } from "next/server";
import Stripe from "stripe";

import { requireApiAuth } from "@/lib/auth/api";

function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw new Error("Missing STRIPE_SECRET_KEY environment variable.");
  }

  return new Stripe(secretKey);
}

const priceMap = {
  professional: process.env.STRIPE_PROFESSIONAL_PRICE_ID,
  premium: process.env.STRIPE_PREMIUM_PRICE_ID,
};

export async function POST(request: NextRequest) {
  const { plan } = await request.json();

  const priceId = priceMap[plan as keyof typeof priceMap];

  if (!priceId) {
    return NextResponse.json(
      { error: "Invalid plan" },
      { status: 400 }
    );
  }

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.PUBLIC_APP_URL ||
    "http://localhost:3000";

  const auth = await requireApiAuth(request);
  const businessId = auth.ok ? auth.context.businessId : undefined;

  const session = await getStripeClient().checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    client_reference_id: businessId,
    metadata: businessId ? { business_id: businessId, plan } : { plan },
    subscription_data: businessId
      ? {
          metadata: {
            business_id: businessId,
            plan,
          },
        }
      : undefined,
    success_url: `${appUrl}/dashboard/settings?checkout=success`,
    cancel_url: `${appUrl}/pricing?checkout=cancelled`,
  });

  return NextResponse.json({
    url: session.url,
  });
}
