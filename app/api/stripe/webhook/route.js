import { NextResponse } from "next/server";
import stripe from "@/lib/stripe";
import prisma from "@/lib/prisma";

export async function POST(req) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature error:", err.message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const { userId, plan } = session.metadata;
        const subscriptionId = session.subscription;

        await prisma.user.update({
          where: { id: userId },
          data: { plan, stripeSubscriptionId: subscriptionId },
        });
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object;
        const customer = await stripe.customers.retrieve(sub.customer);
        const userId = customer.metadata?.userId;
        if (!userId) break;

        let plan = "FREE";
        const priceId = sub.items.data[0]?.price?.id;
        if (priceId === process.env.STRIPE_PRO_PRICE_ID) plan = "PRO";
        else if (priceId === process.env.STRIPE_BUSINESS_PRICE_ID) plan = "BUSINESS";

        await prisma.user.update({
          where: { id: userId },
          data: { plan, stripeSubscriptionId: sub.id },
        });
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object;
        const customer = await stripe.customers.retrieve(sub.customer);
        const userId = customer.metadata?.userId;
        if (!userId) break;

        await prisma.user.update({
          where: { id: userId },
          data: { plan: "FREE", stripeSubscriptionId: null },
        });
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Webhook handler error:", err);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
