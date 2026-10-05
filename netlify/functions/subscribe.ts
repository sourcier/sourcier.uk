// Adds a subscriber to the Resend contacts list and assigns them to a segment,
// then sends a welcome email.
//
// Required environment variables (Netlify → Site configuration → Env vars):
//   RESEND_API_KEY              — API key from https://resend.com
//   RESEND_SEGMENT_ID           — ID of the Resend segment to add contacts to
//   NOTIFY_FROM_EMAIL           — verified Resend sender address, e.g. hello@sourcier.uk
//   SITE_URL                    — public URL of the site, e.g. https://sourcier.uk
//   RESEND_WELCOME_TEMPLATE_ID  — (optional) published Resend template ID for the welcome email.
//                                 Run scripts/create-welcome-template.js once to create + publish it.

import type { HandlerEvent } from "@netlify/functions";

const ALLOWED_ORIGIN = process.env.SITE_URL?.replace(/\/$/, "") ?? "";

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export const handler = async (event: HandlerEvent) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  const apiKey = process.env.RESEND_API_KEY;
  const segmentId = process.env.RESEND_SEGMENT_ID;
  const fromEmail = process.env.NOTIFY_FROM_EMAIL;
  const siteUrl = process.env.SITE_URL?.replace(/\/$/, "") ?? "";
  const welcomeTemplateId = process.env.RESEND_WELCOME_TEMPLATE_ID;

  if (!apiKey || !segmentId) {
    console.error("subscribe: RESEND_API_KEY or RESEND_SEGMENT_ID is not set");
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Server configuration error" }),
    };
  }

  let body: { email?: unknown; website?: unknown };
  try {
    body = JSON.parse(event.body ?? "{}");
  } catch {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Invalid request body" }),
    };
  }

  const email = (typeof body.email === "string" ? body.email : "")
    .trim()
    .toLowerCase();
  const honeypot = body.website ?? "";

  if (honeypot) {
    // Bot filled the honeypot — silently accept to avoid revealing the check
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ success: true }),
    };
  }

  if (!email || !isValidEmail(email)) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: "A valid email address is required" }),
    };
  }

  const res = await fetch(`https://api.resend.com/contacts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      unsubscribed: false,
      segments: [{ id: segmentId }],
    }),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    console.error(`subscribe: Resend API error ${res.status}: ${errorBody}`);
    return {
      statusCode: 502,
      headers: corsHeaders,
      body: JSON.stringify({
        error: "Could not subscribe. Please try again later.",
      }),
    };
  }

  if (fromEmail) {
    const emailPayload = welcomeTemplateId
      ? {
          from: `Sourcier <${fromEmail}>`,
          to: [email],
          template: {
            id: welcomeTemplateId,
            variables: { BLOG_URL: `${siteUrl}/blog` },
          },
        }
      : {
          from: `Sourcier <${fromEmail}>`,
          to: [email],
          subject: "You're subscribed to Sourcier",
          html: `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:2rem 1.5rem;color:#0f0f0f">
  <p style="font-size:1.5rem;font-weight:800;text-transform:uppercase;letter-spacing:0.02em;margin:0 0 1rem">Welcome to Sourcier</p>
  <p style="margin:0 0 1rem;line-height:1.6">Thanks for signing up. You'll get an email whenever I publish something new — engineering deep-dives, lessons from the field, and the occasional opinion.</p>
  <p style="margin:0 0 1.5rem;line-height:1.6">In the meantime, browse the <a href="${siteUrl}/blog" style="color:#e8006a">blog</a> to see what's already there.</p>
  <p style="margin:0;color:#6b6b6b;font-size:0.875rem">You can unsubscribe at any time by replying to this email.</p>
</div>`,
        };

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        // Stable per-recipient key so a retried request (network error, Netlify
        // function timeout, etc.) never results in a second welcome email.
        "Idempotency-Key": `welcome-${email}`,
      },
      body: JSON.stringify(emailPayload),
    }).catch((err) => console.error("subscribe: welcome email failed:", err));
  }

  return {
    statusCode: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ success: true }),
  };
};
