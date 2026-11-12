import type { HandlerEvent } from "@netlify/functions";
import Stripe from "stripe";

const TIP_CURRENCY = "gbp";

interface RequestBody {
  amountPence?: unknown;
  returnPath?: unknown;
  receiptEmail?: unknown;
  source?: unknown;
}

function getOrigin(event: HandlerEvent): string {
  const headerOrigin = event.headers?.origin?.replace(/\/$/, "");
  if (headerOrigin) {
    return headerOrigin;
  }

  const forwardedProto = event.headers?.["x-forwarded-proto"] ?? "https";
  const forwardedHost =
    event.headers?.["x-forwarded-host"] ?? event.headers?.host ?? "";

  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`.replace(/\/$/, "");
  }

  return process.env.SITE_URL?.replace(/\/$/, "") ?? "";
}

function getCorsHeaders(event: HandlerEvent): Record<string, string> {
  const origin = getOrigin(event);

  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function getReturnUrl(origin: string, returnPath: unknown): string | null {
  if (typeof returnPath !== "string") {
    return null;
  }

  if (!returnPath.startsWith("/") || returnPath.startsWith("//")) {
    return null;
  }

  try {
    const url = new URL(returnPath, origin);

    if (url.origin !== origin) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

function parseAmountPence(value: unknown): number | null {
  if (!Number.isInteger(value)) {
    return null;
  }

  if ((value as number) < 1) {
    return null;
  }

  return value as number;
}

function parseReceiptEmail(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const email = value.trim();
  if (!email) {
    return null;
  }

  if (email.length > 320) {
    return null;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function createStripeClient(): Stripe | null {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    return null;
  }

  return new Stripe(secretKey);
}

export const handler = async (event: HandlerEvent) => {
  const corsHeaders = getCorsHeaders(event);

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }

  const stripe = createStripeClient();
  if (!stripe) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Stripe is not configured on the server" }),
    };
  }

  if (event.httpMethod === "POST") {
    let body: RequestBody;

    try {
      body = JSON.parse(event.body ?? "{}");
    } catch {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Invalid request body" }),
      };
    }

    const amountPence = parseAmountPence(body.amountPence);
    if (!amountPence) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          error: "Enter an amount greater than £0.00",
        }),
      };
    }

    const origin = getOrigin(event);
    if (!origin) {
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Could not determine the site origin" }),
      };
    }

    const returnUrl = getReturnUrl(origin, body.returnPath);
    if (!returnUrl) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          error: "Choose a valid page to return to after checkout",
        }),
      };
    }

    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountPence,
        currency: TIP_CURRENCY,
        allowed_payment_method_types: ["card"],
        description:
          "One-off tip to support the writing and upcoming course work on Sourcier.",
        receipt_email: parseReceiptEmail(body.receiptEmail) ?? undefined,
        metadata: {
          flow: "support-tip",
          amount_pence: String(amountPence),
          source:
            typeof body.source === "string"
              ? body.source
              : "support-modal-custom",
          return_path:
            typeof body.returnPath === "string" ? body.returnPath : "",
        },
      });

      return {
        statusCode: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({
          clientSecret: paymentIntent.client_secret,
          paymentIntentId: paymentIntent.id,
          returnUrl,
        }),
      };
    } catch (error) {
      console.error("support-payment-intent:create", error);

      return {
        statusCode: 502,
        headers: corsHeaders,
        body: JSON.stringify({
          error:
            error instanceof Error && error.message
              ? error.message
              : "Stripe could not create the payment intent",
        }),
      };
    }
  }

  if (event.httpMethod === "GET") {
    const paymentIntentId =
      event.queryStringParameters?.payment_intent_id?.trim();

    if (!paymentIntentId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          error: "A payment_intent_id query parameter is required",
        }),
      };
    }

    try {
      const paymentIntent =
        await stripe.paymentIntents.retrieve(paymentIntentId);

      return {
        statusCode: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({
          status: paymentIntent.status,
          amountTotal: paymentIntent.amount,
          currency: paymentIntent.currency,
          customerEmail: paymentIntent.receipt_email ?? null,
        }),
      };
    } catch (error) {
      console.error("support-payment-intent:retrieve", error);

      return {
        statusCode: 502,
        headers: corsHeaders,
        body: JSON.stringify({
          error: "Stripe could not retrieve that payment intent",
        }),
      };
    }
  }

  return {
    statusCode: 405,
    headers: corsHeaders,
    body: JSON.stringify({ error: "Method not allowed" }),
  };
};
