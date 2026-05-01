import Stripe from "stripe";

// Lazily initialised so the module can be imported at build time without
// STRIPE_SECRET_KEY present. At runtime (Vercel) the key is always set.
let _stripe = null;

function getStripe() {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2024-12-18.acacia",
    });
  }
  return _stripe;
}

// Proxy forwards every property access to the real instance, so all
// existing callers (`stripe.checkout.sessions.create`, etc.) work unchanged.
const stripe = new Proxy({}, {
  get: (_target, prop) => getStripe()[prop],
  apply: (_target, thisArg, args) => getStripe()(...args),
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
