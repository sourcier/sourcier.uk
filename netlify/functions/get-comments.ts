// Fetches approved comment submissions from Netlify Forms API.
// Requires two environment variables set in Netlify site settings:
//   NETLIFY_PAT               — personal access token from https://app.netlify.com/user/applications
//                               NOTE: do NOT use NETLIFY_ACCESS_TOKEN — that name is reserved by Netlify
//                               and auto-overwritten with a limited site-scoped machine token at runtime
//   APPROVED_COMMENTS_FORM_ID — form ID for the "approved-comments" form in the Netlify Forms dashboard
//                               (visible in the URL after the first approved comment is posted)

import type { HandlerEvent } from "@netlify/functions";
import crypto from "node:crypto";

interface NetlifySubmission {
  id: string;
  data: Record<string, string>;
  created_at: string;
}

// MD5 is intentional — Gravatar's API requires it.
function gravatarHash(email: string): string {
  return crypto
    .createHash("md5")
    .update(email.trim().toLowerCase())
    .digest("hex");
}

export const handler = async (event: HandlerEvent) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }

  const slug = event.queryStringParameters?.slug;
  if (!slug) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Missing required query parameter: slug" }),
    };
  }

  const token = process.env.NETLIFY_PAT;
  const formId = process.env.APPROVED_COMMENTS_FORM_ID;

  if (!token || !formId) {
    // Comments are opt-in — returning an empty list rather than an error allows
    // forks and staging deploys to work without the Netlify credentials set up.
    console.warn(
      "NETLIFY_PAT or APPROVED_COMMENTS_FORM_ID not configured — returning empty comments",
    );
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ comments: [] }),
    };
  }

  const apiUrl = `https://api.netlify.com/api/v1/forms/${encodeURIComponent(formId)}/submissions`;
  const response = await fetch(apiUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    console.error(
      `Netlify API error: ${response.status} ${response.statusText}`,
    );
    return {
      statusCode: 502,
      headers: corsHeaders,
      body: JSON.stringify({
        error: "Failed to fetch comments from Netlify API",
      }),
    };
  }

  // Netlify Forms API has no server-side field filter, so we fetch all
  // approved submissions and filter by postSlug here.
  const submissions = (await response.json()) as NetlifySubmission[];

  const comments = submissions
    .filter((s) => s.data?.postSlug === slug)
    .map((s) => ({
      // commentId is the original pending submission's id, carried through
      // approval, so replies can reference a stable identifier — the
      // approved submission's own id is not the same value.
      id: s.data.commentId || s.id,
      parentId: s.data.parentId || null,
      name: s.data.name,
      comment: s.data.comment,
      // Use the original submission date when available so ordering reflects
      // when the comment was written, not when it was approved.
      date: s.data.originalDate || s.created_at,
      emailHash: s.data.email ? gravatarHash(s.data.email) : null,
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({ comments }),
  };
};
