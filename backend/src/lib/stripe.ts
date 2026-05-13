import Stripe from 'stripe';

// Initialize Stripe only if key is configured
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

/**
 * Create a Stripe PaymentIntent for an invoice amount.
 * Returns the client secret for frontend to complete payment.
 */
export async function createPaymentIntent(
  amountInDollars: number,
  invoiceId: number,
  customerEmail: string
): Promise<{ clientSecret: string; paymentIntentId: string } | null> {
  if (!stripe) {
    console.warn('Stripe skipped: STRIPE_SECRET_KEY not configured');
    return null;
  }

  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(amountInDollars * 100), // Stripe uses cents
    currency: 'usd',
    metadata: { invoiceId: String(invoiceId) },
    receipt_email: customerEmail,
  });

  return {
    clientSecret: paymentIntent.client_secret!,
    paymentIntentId: paymentIntent.id,
  };
}

/**
 * Verify a payment was successful (used after frontend confirms payment).
 */
export async function verifyPayment(paymentIntentId: string): Promise<boolean> {
  if (!stripe) return false;

  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
  return paymentIntent.status === 'succeeded';
}
