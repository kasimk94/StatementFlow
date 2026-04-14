import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-12-18.acacia",
});

export default stripe;

export const PLANS = {
  FREE: {
    name: "Free",
    uploads: 1,
    priceId: null,
    price: 0,
  },
  PRO: {
    name: "Pro",
    uploads: Infinity,
    priceId: process.env.STRIPE_PRO_PRICE_ID,
    price: 4.99,
  },
  BUSINESS: {
    name: "Business",
    uploads: Infinity,
    priceId: process.env.STRIPE_BUSINESS_PRICE_ID,
    price: 19.99,
  },
};
