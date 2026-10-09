#!/usr/bin/env node
// Sends a "new post" broadcast email to all Resend subscribers.
// Discovers index.md posts recursively by their stable folder-derived IDs.
// Shows a console preview and asks for confirmation before sending.
//
// Usage:
//   node scripts/notify-new-post.js
//
// Reads RESEND_API_KEY, NOTIFY_FROM_EMAIL, and SITE_URL from a .env file in
// the project root (if present). Environment variables set in the shell take
// precedence over the .env file.

import { select, confirm } from "@inquirer/prompts";
import { readFileSync, existsSync } from "fs";
import { join, resolve } from "path";
import { discoverPosts, findPost } from "./lib/posts.mjs";

const root = resolve(new URL(".", import.meta.url).pathname, "..");

// Load .env from the project root if it exists (Node 20.6+ built-in)
const envFile = join(root, ".env");
if (existsSync(envFile)) {
  // process.loadEnvFile is available from Node 20.12 / 21.7
  if (typeof process.loadEnvFile === "function") {
    process.loadEnvFile(envFile);
  }
}

const args = process.argv.slice(2);
const isDebug = args.includes("--debug");

const apiKey = process.env.RESEND_API_KEY;
const segmentId = process.env.RESEND_SEGMENT_ID;
const topicId = process.env.RESEND_TOPIC_ID;
const siteBase = (process.env.SITE_URL ?? "https://sourcier.uk").replace(
  /\/$/,
  "",
);

if (!apiKey) {
  console.error("Error: RESEND_API_KEY environment variable is required.");
  process.exit(1);
}

if (!segmentId) {
  console.error("Error: RESEND_SEGMENT_ID environment variable is required.");
  process.exit(1);
}

// ── Frontmatter parser ────────────────────────────────────────────────────────

function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const yaml = match[1];
  const result = {};

  for (const line of yaml.split(/\r?\n/)) {
    // Only handle simple key: value lines (skip nested/multiline blocks)
    const m = line.match(/^(\w+):\s*["'>]?(.*?)["']?\s*$/);
    if (m) result[m[1]] = m[2].trim();
  }

  // Handle YAML block scalar for description (>- or >)
  const descBlock = yaml.match(
    /^description:\s*>-?\r?\n((?:[ \t]+.+\r?\n?)*)/m,
  );
  if (descBlock) {
    result.description = descBlock[1]
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .join(" ");
  }

  return result;
}

function loadPost(postId) {
  const { filePath } = findPost(join(root, "collections", "posts"), postId);
  const content = readFileSync(filePath, "utf8");
  const fm = parseFrontmatter(content);
  if (!fm.title)
    throw new Error(`No title found in frontmatter for post: ${postId}`);
  return {
    title: fm.title.replace(/^["']|["']$/g, ""),
    excerpt: fm.description || fm.subTitle || "",
    url: `${siteBase}/blog/${postId}`,
    draft: fm.draft === "true",
  };
}

function listPostIds() {
  const postsDir = join(root, "collections", "posts");
  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  return discoverPosts(postsDir)
    .map((post) => {
      const content = readFileSync(post.filePath, "utf8");
      const fm = parseFrontmatter(content);
      const pubDate = fm.pubDate ? new Date(fm.pubDate).getTime() : 0;
      const isDraft = fm.draft === "true";
      return { id: post.id, pubDate, isDraft };
    })
    .filter(
      (p) => !p.isDraft && p.pubDate >= oneWeekAgo && p.pubDate <= Date.now(),
    )
    .sort((a, b) => b.pubDate - a.pubDate)
    .map((p) => p.id);
}

// ── Prompt helper ─────────────────────────────────────────────────────────────

// ── Ask for post ID ───────────────────────────────────────────────────────────

const postIds = listPostIds();
if (postIds.length === 0) {
  console.log("\nNo published posts found in the past week.");
  process.exit(0);
}
const postId = await select({
  message: "Select a post to notify subscribers about:",
  choices: postIds.map((id) => ({ value: id })),
}).catch(() => process.exit(0));

let post;
try {
  post = loadPost(postId);
} catch (err) {
  console.error(`Error: ${err.message}`);
  process.exit(1);
}

if (post.draft) {
  console.warn(
    "\n⚠  Warning: this post is marked draft: true in its frontmatter.",
  );
  const ok = await confirm({ message: "Send anyway?", default: false }).catch(
    () => process.exit(0),
  );
  if (!ok) {
    console.log("Aborted.");
    process.exit(0);
  }
}

const { title, url, excerpt } = post;

const SUBJECT = `New post: ${title}`;
const FROM =
  process.env.NOTIFY_FROM_EMAIL ?? "Roger @ Sourcier <hello@sourcier.uk>";
const RESEND_API = "https://api.resend.com";

function buildHtml() {
  return `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:2rem 1.5rem;color:#0f0f0f">
  <p style="margin:0 0 1.5rem;line-height:1.6">Hi — I just published something new on Sourcier.</p>
  <p style="font-size:1.5rem;font-weight:800;letter-spacing:-0.01em;margin:0 0 1rem;line-height:1.2">${title}</p>
  ${excerpt ? `<p style="margin:0 0 1.5rem;line-height:1.6;color:#444">${excerpt}</p>` : ""}
  <a href="${url}" style="display:inline-block;background:#e8006a;color:#fff;text-decoration:none;padding:0.65rem 1.5rem;font-weight:700;font-size:0.875rem;letter-spacing:0.04em;text-transform:uppercase">Read the post →</a>
  <p style="margin:1.5rem 0 0;line-height:1.6;color:#444">If it sparks any thoughts, I'd love to hear them — there's a comments section at the bottom of the post.</p>
  <p style="margin:1rem 0 0;line-height:1.6">— Roger</p>
  <hr style="margin:2rem 0;border:none;border-top:1px solid #e5e5e5">
  <p style="margin:0;color:#999;font-size:0.8125rem;line-height:1.5">
    You're receiving this because you subscribed at <a href="https://sourcier.uk" style="color:#999">sourcier.uk</a>.<br>
    <a href="{{{RESEND_UNSUBSCRIBE_URL}}}" style="color:#999">Unsubscribe</a>
  </p>
</div>`.trim();
}

function buildText() {
  return [
    "Hi — I just published something new on Sourcier.",
    "",
    title,
    "",
    excerpt ? excerpt : null,
    "",
    `Read it here: ${url}`,
    "",
    "If it sparks any thoughts, I'd love to hear them — there's a comments section at the bottom of the post.",
    "",
    "— Roger",
    "",
    "---",
    "You're receiving this because you subscribed at sourcier.uk.",
    "Unsubscribe: {{{RESEND_UNSUBSCRIBE_URL}}}",
  ]
    .filter((l) => l !== null)
    .join("\n");
}

// Resend's Idempotency-Key only covers POST /emails and /emails/batch, not
// /broadcasts — so accidental double-sends of the same broadcast (e.g.
// re-running this script for a post that was already announced) aren't
// protected by the API itself. Guard against that here by checking for an
// existing broadcast with the same name before creating a new one. The
// list-broadcasts response only exposes `name` (what sendBroadcast() sets
// from the post title), not `subject`, and defaults to 20 per page, so this
// follows `has_more`/`after` pagination until a match is found or exhausted.
async function findExistingBroadcast() {
  let after;

  do {
    const url = `${RESEND_API}/broadcasts${after ? `?after=${after}` : ""}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!res.ok) {
      console.error(
        `\n⚠  Could not check for existing broadcasts (${res.status}) — aborting to avoid an unchecked duplicate send.`,
      );
      process.exit(1);
    }

    const { data: broadcasts = [], has_more: hasMore } = await res.json();
    const match = broadcasts.find(
      (b) =>
        b.name === title &&
        (b.status === "sent" ||
          b.status === "queued" ||
          b.status === "sending" ||
          b.status === "scheduled"),
    );
    if (match) return match;

    after = hasMore ? broadcasts.at(-1)?.id : undefined;
  } while (after);

  return null;
}

function printPreview() {
  const divider = "─".repeat(60);
  console.log("\n" + divider);
  console.log("  EMAIL PREVIEW");
  console.log(divider);
  console.log(`  From:    ${FROM}`);
  console.log(`  Subject: ${SUBJECT}`);
  console.log(divider);
  console.log();
  for (const line of buildText().split("\n")) {
    console.log("  " + line);
  }
  console.log();
  console.log(divider + "\n");
}

async function sendBroadcast() {
  const payload = {
    name: title,
    from: FROM,
    subject: SUBJECT,
    html: buildHtml(),
    text: buildText(),
    segment_id: segmentId,
    ...(topicId ? { topic_id: topicId } : {}),
  };

  if (isDebug) {
    console.log("\n[debug] POST /broadcasts payload:");
    console.log(JSON.stringify({ ...payload, html: "<omitted>" }, null, 2));
  }

  const createRes = await fetch(`${RESEND_API}/broadcasts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const rawBody = await createRes.text();
  if (isDebug) {
    console.log(`\n[debug] POST /broadcasts → ${createRes.status}`);
    console.log(rawBody);
  }

  let created;
  try {
    created = JSON.parse(rawBody);
  } catch {
    created = {};
  }

  if (!createRes.ok) {
    throw new Error(`Resend API error (${createRes.status}): ${rawBody}`);
  }

  const sendRes = await fetch(`${RESEND_API}/broadcasts/${created.id}/send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  const rawSendBody = await sendRes.text();
  if (isDebug) {
    console.log(
      `\n[debug] POST /broadcasts/${created.id}/send → ${sendRes.status}`,
    );
    console.log(rawSendBody);
  }

  if (!sendRes.ok) {
    throw new Error(`Resend send error (${sendRes.status}): ${rawSendBody}`);
  }

  return created;
}

printPreview();

const existing = await findExistingBroadcast();
if (existing) {
  console.warn(
    `\n⚠  A broadcast with this exact subject was already ${existing.status} (id: ${existing.id}).`,
  );
  const sendAnyway = await confirm({
    message: "This looks like a duplicate send. Send again anyway?",
    default: false,
  }).catch(() => process.exit(0));
  if (!sendAnyway) {
    console.log("Aborted — nothing was sent.");
    process.exit(0);
  }
}

const shouldSend = await confirm({
  message: "Send this to all subscribers?",
  default: false,
}).catch(() => process.exit(0));

if (!shouldSend) {
  console.log("Aborted — nothing was sent.");
  process.exit(0);
}

console.log("\nCreating broadcast…");
try {
  const broadcast = await sendBroadcast();
  console.log(`\n✓ Broadcast sent (id: ${broadcast.id})`);
  console.log("  Check your Resend dashboard to confirm delivery.");
} catch (err) {
  console.error("\nError:", err.message);
  process.exit(1);
}
