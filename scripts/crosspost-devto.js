#!/usr/bin/env node
// Cross-posts a blog post to Dev.to with a canonical URL pointing back to sourcier.uk.
// Prepends an original-post link and converts unsupported SVG embeds into PNG fallbacks.
// Discovers index.md posts recursively by their stable folder-derived IDs.
//
// Usage:
//   node scripts/crosspost-devto.js
//   node scripts/crosspost-devto.js --update
//   node scripts/crosspost-devto.js --update <devto-article-id>
//
// Required environment variables (set in .env or shell):
//   DEVTO_API_KEY  — API key from https://dev.to/settings/extensions → DEV Community API Keys
//   SITE_URL       — public URL of the site, e.g. https://sourcier.uk

import { select, confirm } from "@inquirer/prompts";
import { readFileSync, existsSync } from "fs";
import { join, resolve } from "path";
import { discoverPosts, findPost } from "./lib/posts.mjs";

const root = resolve(new URL(".", import.meta.url).pathname, "..");

const envFile = join(root, ".env");
if (existsSync(envFile) && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(envFile);
}

const apiKey = process.env.DEVTO_API_KEY;
const siteBase = (process.env.SITE_URL ?? "https://sourcier.uk").replace(
  /\/$/,
  "",
);
const mermaidMode = (process.env.DEVTO_MERMAID_MODE ?? "image").toLowerCase();

function parseCliArgs(argv) {
  let explicitArticleId = null;
  let updateOnly = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--help" || arg === "-h") {
      console.log("Usage:");
      console.log("  node scripts/crosspost-devto.js");
      console.log("  node scripts/crosspost-devto.js --update");
      console.log(
        "  node scripts/crosspost-devto.js --update <devto-article-id>",
      );
      process.exit(0);
    }

    if (arg === "--update") {
      updateOnly = true;
      const maybeId = argv[i + 1];
      if (maybeId && !maybeId.startsWith("--")) {
        explicitArticleId = Number(maybeId);
        i += 1;
      }
      continue;
    }

    console.error(`Error: Unknown argument '${arg}'.`);
    console.error("Use --help to see supported options.");
    process.exit(1);
  }

  return { explicitArticleId, updateOnly };
}

const { explicitArticleId, updateOnly } = parseCliArgs(process.argv.slice(2));

if (!apiKey) {
  console.error("Error: DEVTO_API_KEY environment variable is required.");
  console.error("Get one at: https://dev.to/settings/extensions");
  process.exit(1);
}

if (explicitArticleId !== null && !Number.isInteger(explicitArticleId)) {
  console.error("Error: --update <devto-article-id> must be a valid integer.");
  process.exit(1);
}

// ── Frontmatter parser ────────────────────────────────────────────────────────

function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const yaml = match[1];
  const result = {};

  for (const line of yaml.split(/\r?\n/)) {
    const m = line.match(/^(\w+):\s*["'>]?(.*?)["']?\s*$/);
    if (m) result[m[1]] = m[2].trim();
  }

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

  // Parse tags array: tags: ["tag1", "tag2"]
  const tagsMatch = yaml.match(/^tags:\s*\[(.+?)\]/m);
  if (tagsMatch) {
    result.tags = tagsMatch[1]
      .split(",")
      .map((t) => t.trim().replace(/^["']|["']$/g, ""));
  }

  return result;
}

function stripFrontmatter(content) {
  return content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "").trim();
}

// Dev.to tags: lowercase alphanumeric only, max 4
function normaliseTags(tags = []) {
  return tags
    .map((t) => t.toLowerCase().replace(/[^a-z0-9]/g, ""))
    .filter(Boolean)
    .slice(0, 4);
}

function escapeMarkdownLinkText(value) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]");
}

function makeUrlAbsolute(url) {
  if (!url) return url;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/")) return `${siteBase}${url}`;
  return url;
}

function buildOriginalPostLine(title, canonicalUrl) {
  return `> Original post: [${escapeMarkdownLinkText(title)}](${canonicalUrl})`;
}

function swapSvgExtension(url) {
  return url.replace(/\.svg(?=(?:\?[^)]*)?$)/i, ".png");
}

// Replace relative /post-images/ paths and ./image references with absolute URLs
function makeImagesAbsolute(markdown, slug) {
  return markdown
    .replace(/\(\/post-images\//g, `(${siteBase}/post-images/`)
    .replace(
      /\(\.\/([^)]+\.(png|jpg|jpeg|gif|webp|svg))\)/g,
      `(${siteBase}/post-images/${slug}/$1)`,
    );
}

function stripHtmlTags(str) {
  let result = str;
  let prev;
  do {
    prev = result;
    result = result.replace(/<[^>]*>?/g, "");
  } while (result !== prev);
  return result;
}

function normaliseSeriesCallout(line) {
  const match = line.match(
    /^<div class="series-callout"><span class="series-callout__label">([^<]+)<\/span><span class="series-callout__text">([\s\S]*?)<\/span><\/div>$/,
  );

  if (!match) return null;

  const label = match[1].trim();
  const text = stripHtmlTags(
    match[2].replace(
      /<a href="([^"]+)">([\s\S]*?)<\/a>/g,
      (_, href, linkText) =>
        `[${escapeMarkdownLinkText(stripHtmlTags(linkText))}](${makeUrlAbsolute(href)})`,
    ),
  )
    .replace(/\s+/g, " ")
    .trim();

  return `> ${label}: ${text}`;
}

function toBase64Url(value) {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function normaliseFenceLanguage(info) {
  const token = info.trim().split(/\s+/)[0] ?? "";
  return /^[a-z0-9#+.-]+$/i.test(token) ? token.toLowerCase() : "";
}

function mermaidFallback(markdown, canonicalUrl) {
  const diagram = markdown.trim();
  if (!diagram) return "";

  if (mermaidMode === "code") {
    return [
      `> Mermaid diagram is available in the canonical article: ${canonicalUrl}`,
      "",
      "```mermaid",
      diagram,
      "```",
    ].join("\n");
  }

  const encoded = toBase64Url(diagram);
  const imageUrl = `https://mermaid.ink/img/${encoded}`;

  return [
    `![Mermaid diagram](${imageUrl})`,
    "",
    `> Diagram fallback for Dev.to. View the canonical article for the full version: ${canonicalUrl}`,
  ].join("\n");
}

function svgFallback(alt, svgUrl, canonicalUrl) {
  const pngUrl = swapSvgExtension(svgUrl);

  return [
    `![${escapeMarkdownLinkText(alt)}](${pngUrl})`,
    "",
    `> Diagram fallback for Dev.to. View the canonical article for the original SVG: ${canonicalUrl}`,
  ].join("\n");
}

function normaliseSvgImage(line, canonicalUrl) {
  const match = line.match(/^!\[([^\]]*)\]\(([^)\s]+\.svg(?:\?[^)]*)?)\)$/i);
  if (!match) return null;

  const alt = match[1].trim() || "Diagram";
  const url = match[2];

  return svgFallback(alt, url, canonicalUrl);
}

function normaliseMarkdownForDevto(markdown, canonicalUrl, title) {
  const lines = markdown.split(/\r?\n/);
  const output = [];
  const stats = {
    mermaidBlocks: 0,
    codeFencesNormalised: 0,
    seriesCalloutsNormalised: 0,
    svgImagesConverted: 0,
  };

  let inFence = false;
  let fenceMarker = "";
  let fenceInfo = "";
  let fenceLines = [];

  for (const line of lines) {
    if (!inFence) {
      const open = line.match(/^(`{3,})(.*)$/);
      if (!open) {
        const seriesCallout = normaliseSeriesCallout(line);
        if (seriesCallout) {
          stats.seriesCalloutsNormalised += 1;
          output.push(seriesCallout);
          continue;
        }

        const svgImage = normaliseSvgImage(line, canonicalUrl);
        if (svgImage) {
          stats.svgImagesConverted += 1;
          output.push(svgImage);
          continue;
        }

        output.push(line);
        continue;
      }

      inFence = true;
      fenceMarker = open[1];
      fenceInfo = open[2] ?? "";
      fenceLines = [];
      continue;
    }

    const trimmed = line.trim();
    const isFenceClose =
      trimmed.startsWith(fenceMarker) &&
      /^`+$/.test(trimmed) &&
      trimmed.length >= fenceMarker.length;

    if (!isFenceClose) {
      fenceLines.push(line);
      continue;
    }

    const rawCode = fenceLines.join("\n");
    const language = normaliseFenceLanguage(fenceInfo);

    if (language === "mermaid") {
      stats.mermaidBlocks += 1;
      output.push(mermaidFallback(rawCode, canonicalUrl));
    } else {
      if (fenceInfo.trim()) stats.codeFencesNormalised += 1;
      output.push(language ? `\`\`\`${language}` : "```");
      output.push(rawCode);
      output.push("```");
    }

    inFence = false;
    fenceMarker = "";
    fenceInfo = "";
    fenceLines = [];
  }

  if (inFence) {
    output.push(`${fenceMarker}${fenceInfo}`);
    output.push(...fenceLines);
  }

  return {
    markdown: `${buildOriginalPostLine(title, canonicalUrl)}\n\n${output.join("\n").trimStart()}`,
    stats,
  };
}

function loadPost(slug) {
  const { filePath } = findPost(join(root, "collections", "posts"), slug);
  const raw = readFileSync(filePath, "utf8");
  const fm = parseFrontmatter(raw);
  if (!fm.title) throw new Error(`No title found in frontmatter for: ${slug}`);

  const title = fm.title.replace(/^["']|["']$/g, "");
  const canonicalUrl = `${siteBase}/blog/${slug}`;
  const markdownBody = makeImagesAbsolute(stripFrontmatter(raw), slug);
  const normalised = normaliseMarkdownForDevto(
    markdownBody,
    canonicalUrl,
    title,
  );

  return {
    title,
    description: fm.description || "",
    tags: normaliseTags(fm.tags),
    draft: fm.draft === "true",
    pubDate: fm.pubDate ? new Date(fm.pubDate) : null,
    body: normalised.markdown,
    canonicalUrl,
    transformStats: normalised.stats,
  };
}

function listPostIds() {
  const postsDir = join(root, "collections", "posts");
  return discoverPosts(postsDir)
    .map((post) => {
      const content = readFileSync(post.filePath, "utf8");
      const fm = parseFrontmatter(content);
      return {
        id: post.id,
        pubDate: fm.pubDate ? new Date(fm.pubDate) : new Date(0),
        isDraft: fm.draft === "true",
        isFuture: fm.pubDate ? new Date(fm.pubDate) > new Date() : false,
      };
    })
    .filter((p) => !p.isDraft && !p.isFuture)
    .sort((a, b) => b.pubDate - a.pubDate)
    .map((p) => p.id);
}

function normaliseUrl(value) {
  return String(value || "").replace(/\/$/, "");
}

function buildArticlePayload(post) {
  return {
    article: {
      title: post.title,
      body_markdown: post.body,
      published: true,
      canonical_url: post.canonicalUrl,
      description: post.description,
      tags: post.tags,
    },
  };
}

async function findExistingArticleByCanonical(canonicalUrl) {
  const target = normaliseUrl(canonicalUrl);
  let page = 1;
  const perPage = 100;

  while (true) {
    const res = await fetch(
      `https://dev.to/api/articles/me/all?page=${page}&per_page=${perPage}`,
      {
        headers: {
          "api-key": apiKey,
        },
      },
    );

    const data = await res.json();

    if (!res.ok) {
      throw new Error(
        `Unable to list Dev.to articles (${res.status}): ${JSON.stringify(data)}`,
      );
    }

    if (!Array.isArray(data) || data.length === 0) return null;

    const existing = data.find((article) => {
      const canonical = normaliseUrl(article.canonical_url);
      return canonical && canonical === target;
    });

    if (existing) return existing;
    if (data.length < perPage) return null;

    page += 1;
  }
}

// ── Select post ───────────────────────────────────────────────────────────────

const postIds = listPostIds();
if (postIds.length === 0) {
  console.log("\nNo published posts found.");
  process.exit(0);
}

const slug = await select({
  message: "Select a post to cross-post:",
  choices: postIds.map((id) => ({ value: id })),
}).catch(() => process.exit(0));

let post;
try {
  post = loadPost(slug);
} catch (err) {
  console.error(`Error: ${err.message}`);
  process.exit(1);
}

// ── Preview ───────────────────────────────────────────────────────────────────

console.log("\n─────────────────────────────────────────");
console.log(`  Title        : ${post.title}`);
console.log(`  Canonical URL: ${post.canonicalUrl}`);
console.log(`  Tags         : ${post.tags.join(", ") || "(none)"}`);
console.log(
  `  Description  : ${post.description.slice(0, 80)}${post.description.length > 80 ? "…" : ""}`,
);
console.log(
  `  Mermaid      : ${post.transformStats.mermaidBlocks} converted (${mermaidMode} mode)`,
);
console.log(
  `  Code fences  : ${post.transformStats.codeFencesNormalised} normalised`,
);
console.log(
  `  Series notes : ${post.transformStats.seriesCalloutsNormalised} normalised`,
);
console.log(
  `  SVG images   : ${post.transformStats.svgImagesConverted} converted to links`,
);
console.log("  Original link: prepended");
console.log(`  Body length  : ${post.body.length} chars`);
console.log("─────────────────────────────────────────\n");

// ── Detect existing Dev.to article ───────────────────────────────────────────

let existingArticle = null;

if (explicitArticleId !== null) {
  existingArticle = { id: explicitArticleId };
  console.log(
    `--update ${explicitArticleId} provided — forcing update mode.\n`,
  );
} else {
  console.log("Checking for existing Dev.to article by canonical URL…");
  try {
    existingArticle = await findExistingArticleByCanonical(post.canonicalUrl);
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
  if (existingArticle) {
    console.log(
      `Found existing article: https://dev.to/articles/${existingArticle.id}\n`,
    );
  } else {
    console.log("No existing article found — will create a new one.\n");
  }
}

const isUpdate = Boolean(existingArticle?.id);

if (updateOnly && !isUpdate) {
  console.error(
    "Error: --update was set, but no existing Dev.to article was found for this canonical URL.",
  );
  console.error("Re-run without --update to create a new article instead.");
  process.exit(1);
}

// ── Confirm action ────────────────────────────────────────────────────────────

let proceed;

if (explicitArticleId !== null || updateOnly) {
  const ok = await confirm({
    message: `Update Dev.to article ${existingArticle.id}?`,
    default: false,
  }).catch(() => process.exit(0));
  if (!ok) {
    console.log("Aborted.");
    process.exit(0);
  }
  proceed = "update";
} else if (isUpdate) {
  proceed = await select({
    message: `An existing article was found. What would you like to do?`,
    choices: [
      { name: "Update the existing article", value: "update" },
      { name: "Create a new article", value: "create" },
      { name: "Cancel", value: "cancel" },
    ],
  }).catch(() => process.exit(0));
} else {
  const ok = await confirm({
    message: "Cross-post to Dev.to?",
    default: false,
  }).catch(() => process.exit(0));
  proceed = ok ? "create" : "cancel";
}

if (proceed === "cancel") {
  console.log("Aborted.");
  process.exit(0);
}

const doUpdate = proceed === "update";

// ── CREATE or UPDATE via Dev.to API ──────────────────────────────────────────

const endpoint = doUpdate
  ? `https://dev.to/api/articles/${existingArticle.id}`
  : "https://dev.to/api/articles";
const method = doUpdate ? "PUT" : "POST";

console.log(`\n${doUpdate ? "Updating" : "Posting"} on Dev.to…`);

const res = await fetch(endpoint, {
  method,
  headers: {
    "Content-Type": "application/json",
    "api-key": apiKey,
  },
  body: JSON.stringify(buildArticlePayload(post)),
});

const data = await res.json();

if (!res.ok) {
  console.error(
    `\nDev.to API error (${res.status}):`,
    JSON.stringify(data, null, 2),
  );
  process.exit(1);
}

console.log(`\n✓ ${doUpdate ? "Updated" : "Published"}! View at: ${data.url}`);
console.log("  Dev.to article ID:", data.id);
console.log(
  "\nNote: Mermaid and expressive code fences were normalised for Dev.to compatibility.",
);
console.log(
  "Review the Dev.to article to confirm formatting. Original-post link and canonical URL are set correctly.",
);
