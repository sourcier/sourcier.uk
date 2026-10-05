// Handles approve / delete actions from the email notification links.
// Called by the admin clicking a link; returns an HTML confirmation page.
//
// Query parameters:
//   action  — "approve" or "delete"
//   id      — Netlify submission ID
//   token   — HMAC-SHA256 of "{id}:{action}" signed with APPROVAL_SECRET
//
// Approve flow:
//   1. Verify the HMAC token
//   2. Fetch the pending submission data from the Netlify API
//   3. POST to the approved-comments form (Netlify edge intercepts it)
//   4. Delete the pending submission from the queue
//   5. If the approved comment is a reply, best-effort email the parent
//      comment's author (only reached once the reply is actually live)
//
// Delete flow:
//   1. Verify the HMAC token
//   2. Delete the pending submission from the queue
//
// Reply notification requires the same RESEND_API_KEY / NOTIFY_FROM_EMAIL
// used by comment-handler.ts, plus APPROVED_COMMENTS_FORM_ID (already used
// by get-comments.ts) to look up the parent comment's stored email.

import type { HandlerEvent } from "@netlify/functions";
import crypto from "node:crypto";

interface NetlifySubmission {
  id: string;
  data: Record<string, string>;
  created_at: string;
}

function hmac(submissionId: string, action: string, secret: string): string {
  return crypto
    .createHmac("sha256", secret)
    .update(`${submissionId}:${action}`)
    .digest("hex");
}

function verifyToken(
  submissionId: string,
  action: string,
  token: string,
  secret: string,
): boolean {
  const expected = hmac(submissionId, action, secret);
  if (token.length !== expected.length) return false;
  // Constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(token, "hex"),
    Buffer.from(expected, "hex"),
  );
}

export const handler = async (event: HandlerEvent) => {
  const { action, id, token } = event.queryStringParameters ?? {};

  if (!action || !id || !token) {
    return htmlPage(400, "Bad Request", "Missing required parameters.");
  }

  if (!["approve", "delete"].includes(action)) {
    return htmlPage(400, "Bad Request", "Unknown action.");
  }

  const secret = process.env.APPROVAL_SECRET;
  const accessToken = process.env.NETLIFY_PAT;
  const siteUrl = process.env.SITE_URL?.replace(/\/$/, "");
  const approvedFormId = process.env.APPROVED_COMMENTS_FORM_ID;

  if (!secret || !accessToken || !siteUrl) {
    console.error("approve-comment: missing environment variables");
    return htmlPage(
      500,
      "Configuration Error",
      "Server is not configured correctly.",
    );
  }

  try {
    if (!verifyToken(id, action, token, secret)) {
      return htmlPage(403, "Forbidden", "Invalid or expired token.");
    }
  } catch {
    // token may be wrong length or otherwise malformed
    return htmlPage(403, "Forbidden", "Invalid or expired token.");
  }

  if (action === "delete") {
    const res = await fetch(
      `https://api.netlify.com/api/v1/submissions/${encodeURIComponent(id)}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    if (!res.ok && res.status !== 404) {
      console.error(`approve-comment: delete failed ${res.status}`);
      return htmlPage(
        502,
        "Error",
        "Could not delete the submission. Try again or remove it from the Netlify dashboard.",
      );
    }
    return htmlPage(
      200,
      "Comment Deleted",
      "The comment has been removed from the queue.",
    );
  }

  // Approve: fetch pending submission, re-post to approved form, then delete
  const submissionRes = await fetch(
    `https://api.netlify.com/api/v1/submissions/${encodeURIComponent(id)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (submissionRes.status === 404) {
    return htmlPage(
      404,
      "Not Found",
      "This comment has already been actioned or doesn't exist.",
    );
  }

  if (!submissionRes.ok) {
    console.error(
      `approve-comment: fetch submission failed ${submissionRes.status}`,
    );
    return htmlPage(
      502,
      "Error",
      "Could not retrieve the submission from Netlify.",
    );
  }

  const submission = (await submissionRes.json()) as NetlifySubmission;
  const { data, created_at } = submission;
  let parentSubmission: NetlifySubmission | null = null;

  if (data.parentId) {
    if (!approvedFormId) {
      console.error(
        "approve-comment: missing APPROVED_COMMENTS_FORM_ID for reply validation",
      );
      return htmlPage(
        500,
        "Configuration Error",
        "Server is not configured correctly.",
      );
    }

    try {
      parentSubmission = await findApprovedSubmission({
        accessToken,
        approvedFormId,
        parentId: data.parentId,
      });
    } catch (error) {
      console.error("approve-comment: failed to validate reply parent", error);
      return htmlPage(502, "Error", "Could not validate the reply target.");
    }

    if (
      parentSubmission &&
      (parentSubmission.data?.postSlug ?? "") !== (data.postSlug ?? "")
    ) {
      return htmlPage(
        400,
        "Bad Request",
        "Reply parent does not belong to this post.",
      );
    }
  }

  const formPayload = new URLSearchParams({
    "form-name": "approved-comments",
    postSlug: data.postSlug ?? "",
    name: data.name ?? "",
    email: data.email ?? "",
    comment: data.comment ?? "",
    originalDate: created_at ?? new Date().toISOString(),
    // The pending submission's own id, so it stays stable across approval
    // (the approved-comments submission gets a different id of its own) —
    // this is what reply threads reference as parentId.
    commentId: id,
    parentId: data.parentId ?? "",
  });

  const postRes = await fetch(siteUrl + "/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formPayload.toString(),
  });

  if (!postRes.ok) {
    console.error(
      `approve-comment: post to approved form failed ${postRes.status}`,
    );
    return htmlPage(
      502,
      "Error",
      "Failed to post the comment to the approved form.",
    );
  }

  await fetch(
    `https://api.netlify.com/api/v1/submissions/${encodeURIComponent(id)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  if (data.parentId) {
    // Best-effort: the reply is already live at this point, so a failure
    // here should never turn the approval itself into an error response.
    await notifyParentAuthor({
      siteUrl,
      replyName: data.name ?? "anonymous",
      replyComment: data.comment ?? "",
      postSlug: data.postSlug ?? "",
      replyCommentId: id,
      parentEmail: parentSubmission?.data?.email ?? "",
    }).catch((err) =>
      console.error("approve-comment: reply notification failed", err),
    );
  }

  return htmlPage(
    200,
    "Comment Approved",
    `The comment from <strong>${escapeHtml(data.name ?? "anonymous")}</strong> is now live.`,
  );
};

async function notifyParentAuthor(opts: {
  siteUrl: string;
  replyName: string;
  replyComment: string;
  postSlug: string;
  replyCommentId: string;
  parentEmail: string;
}) {
  const resendApiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.NOTIFY_FROM_EMAIL;

  if (!resendApiKey || !fromEmail) {
    console.warn(
      "approve-comment: missing Resend/form env vars — skipping reply notification",
    );
    return;
  }

  if (!opts.parentEmail) {
    // Parent comment not found, or its author didn't leave an email.
    return;
  }

  const postUrl = opts.postSlug
    ? `${opts.siteUrl}/blog/${encodeURIComponent(opts.postSlug)}/#comment-${encodeURIComponent(opts.replyCommentId)}`
    : opts.siteUrl;

  const emailHtml = `
<p>${escapeHtml(opts.replyName)} replied to your comment on <strong>${escapeHtml(opts.postSlug || "a post")}</strong>:</p>

<blockquote style="border-left:3px solid #e8006a;margin:1rem 0;padding:0.75rem 1.25rem;background:#f9f9f9;">
  ${escapeHtml(opts.replyComment)}
</blockquote>

<p><a href="${postUrl}">View the reply</a></p>
`.trim();

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${resendApiKey}`,
      // Keyed on the reply's comment id so retrying approval never sends the
      // parent author a duplicate reply notification.
      "Idempotency-Key": `reply-notify-${opts.replyCommentId}`,
    },
    body: JSON.stringify({
      from: fromEmail,
      to: opts.parentEmail,
      subject: `${opts.replyName} replied to your comment`,
      html: emailHtml,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`approve-comment: Resend API error ${res.status}: ${body}`);
  }
}

async function findApprovedSubmission(opts: {
  accessToken: string;
  approvedFormId: string;
  parentId: string;
}): Promise<NetlifySubmission | null> {
  for (let page = 1; ; page += 1) {
    const submissionsRes = await fetch(
      `https://api.netlify.com/api/v1/forms/${encodeURIComponent(opts.approvedFormId)}/submissions?per_page=100&page=${page}`,
      { headers: { Authorization: `Bearer ${opts.accessToken}` } },
    );

    if (!submissionsRes.ok) {
      throw new Error(
        `failed to list approved submissions ${submissionsRes.status}`,
      );
    }

    const submissions = (await submissionsRes.json()) as NetlifySubmission[];
    const parent = submissions.find(
      (s) => s.data?.commentId === opts.parentId || s.id === opts.parentId,
    );
    if (parent) {
      return parent;
    }

    if (submissions.length < 100) {
      return null;
    }
  }
}

function htmlPage(statusCode: number, heading: string, message: string) {
  const color = statusCode === 200 ? "#257942" : "#e8006a";
  return {
    statusCode,
    headers: { "Content-Type": "text/html; charset=utf-8" },
    body: `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${heading}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 480px; margin: 6rem auto; padding: 0 1.5rem; color: #111; }
    h1 { font-size: 1.5rem; margin-bottom: 0.5rem; color: ${color}; }
    p { line-height: 1.6; color: #444; }
  </style>
</head>
<body>
  <h1>${heading}</h1>
  <p>${message}</p>
</body>
</html>`,
  };
}

function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
