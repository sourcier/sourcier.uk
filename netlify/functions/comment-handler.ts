// Triggered by a Netlify form-submission webhook whenever a comment lands in
// the blog-comments queue. Sends an email notification containing the comment
// text and HMAC-signed approve / delete links.
//
// Required environment variables (Netlify → Site configuration → Env vars):
//   NETLIFY_PAT           — personal access token (already used by get-comments)
//                           NOTE: do NOT name it NETLIFY_ACCESS_TOKEN — Netlify auto-overwrites that
//   APPROVAL_SECRET       — random secret used to sign approve/delete tokens
//   SITE_URL              — public URL of the site, e.g. https://sourcier.uk
//   RESEND_API_KEY        — API key from https://resend.com (free tier is ample)
//   NOTIFY_FROM_EMAIL     — verified Resend sender address, e.g. comments@sourcier.uk
//   NOTIFY_EMAIL          — address to send the notification to
//
// Netlify webhook setup (one-time, done in the Netlify dashboard):
//   Forms → blog-comments → Form notifications → Add notification
//   → Outgoing webhook → URL: https://{your-site}/.netlify/functions/comment-handler

import type { HandlerEvent } from "@netlify/functions";
import crypto from "node:crypto";

interface WebhookPayload {
  id?: string;
  created_at?: string;
  data?: {
    name?: string;
    email?: string;
    comment?: string;
    postSlug?: string;
    parentId?: string;
  };
}

function hmac(submissionId: string, action: string, secret: string): string {
  return crypto
    .createHmac("sha256", secret)
    .update(`${submissionId}:${action}`)
    .digest("hex");
}

export const handler = async (event: HandlerEvent) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  const secret = process.env.APPROVAL_SECRET;
  const siteUrl = process.env.SITE_URL?.replace(/\/$/, "");
  const resendApiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.NOTIFY_FROM_EMAIL;
  const toEmail = process.env.NOTIFY_EMAIL;

  if (!secret || !siteUrl || !resendApiKey || !fromEmail || !toEmail) {
    console.warn(
      "comment-handler: missing environment variables — skipping notification",
    );
    return { statusCode: 200, body: "OK" };
  }

  let payload: WebhookPayload;
  try {
    payload = JSON.parse(event.body ?? "{}");
  } catch {
    return { statusCode: 400, body: "Invalid payload" };
  }

  const { id, data, created_at } = payload;
  if (!id || !data) {
    return { statusCode: 400, body: "Missing submission id or data" };
  }

  if (data.name && data.name.length > 100) {
    return { statusCode: 400, body: "Name too long" };
  }
  if (data.comment && data.comment.length > 5000) {
    return { statusCode: 400, body: "Comment too long" };
  }
  if (data.postSlug && data.postSlug.length > 200) {
    return { statusCode: 400, body: "Post slug too long" };
  }
  if (data.parentId && data.parentId.length > 100) {
    return { statusCode: 400, body: "Parent id too long" };
  }

  const approveToken = hmac(id, "approve", secret);
  const deleteToken = hmac(id, "delete", secret);
  const base = `${siteUrl}/.netlify/functions/approve-comment`;
  const approveUrl = `${base}?action=approve&id=${encodeURIComponent(id)}&token=${approveToken}`;
  const deleteUrl = `${base}?action=delete&id=${encodeURIComponent(id)}&token=${deleteToken}`;

  const submittedAt = created_at
    ? new Date(created_at).toLocaleString("en-GB", { timeZone: "UTC" }) + " UTC"
    : "unknown time";

  const postUrl = data.postSlug
    ? `${siteUrl}/blog/${encodeURIComponent(data.postSlug)}/`
    : null;

  const emailHtml = `
<p>New ${data.parentId ? "reply" : "comment"} from <strong>${escapeHtml(data.name ?? "anonymous")}</strong>
${data.email ? `(<a href="mailto:${escapeHtml(data.email)}">${escapeHtml(data.email)}</a>) ` : ""}
on post <strong>${escapeHtml(data.postSlug ?? "(unknown)")}</strong>
at ${submittedAt}:</p>

<blockquote style="border-left:3px solid #e8006a;margin:1rem 0;padding:0.75rem 1.25rem;background:#f9f9f9;">
  ${escapeHtml(data.comment ?? "")}
</blockquote>

${postUrl ? `<p><a href="${postUrl}#comments">View the article and comments</a></p>` : ""}

<p>
  <a href="${approveUrl}" style="background:#e8006a;color:#fff;padding:0.6rem 1.2rem;text-decoration:none;margin-right:0.5rem;">Approve</a>
  <a href="${deleteUrl}" style="background:#333;color:#fff;padding:0.6rem 1.2rem;text-decoration:none;">Delete</a>
</p>
<p style="font-size:0.8rem;color:#999;">These links are single-use and tied to this submission.</p>
`.trim();

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${resendApiKey}`,
      // Keyed on the Netlify form submission id so a webhook retry never
      // produces a second moderator notification for the same comment.
      "Idempotency-Key": `comment-notify-${id}`,
    },
    body: JSON.stringify({
      from: fromEmail,
      to: toEmail,
      subject: `New ${data.parentId ? "reply" : "comment"}: ${data.postSlug ?? "blog"} — ${data.name ?? "anonymous"}`,
      html: emailHtml,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`comment-handler: Resend API error ${res.status}: ${body}`);
    return { statusCode: 502, body: "Failed to send notification" };
  }

  return { statusCode: 200, body: "OK" };
};

function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
