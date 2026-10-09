/**
 * Downloads a cover image from Unsplash for a blog post.
 *
 * Fetches photo metadata via Unsplash oEmbed (no API key needed), downloads
 * at 1920px width, processes through sharp to produce a WebP, and outputs a
 * ready-to-paste frontmatter snippet.
 *
 * Accepts a full Unsplash photo URL (including slug-style) or a bare photo ID:
 *   https://unsplash.com/photos/a-building-with-a-sign-6ZT9qHUnesQ
 *   6ZT9qHUnesQ
 *
 * Usage:
 *   node scripts/download-cover-image.mjs <slug> <photo-url-or-id>
 *   node scripts/download-cover-image.mjs <slug> <photo-url-or-id> --alt "Description"
 *   node scripts/download-cover-image.mjs <slug> <photo-url-or-id> --force
 *   node scripts/download-cover-image.mjs <slug> <photo-url-or-id> --dry-run
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { input, select } from "@inquirer/prompts";
import { discoverPosts, resolvePostDirectory } from "./lib/posts.mjs";

const POSTS_DIR = "./collections/posts";
const UTM = "utm_source=sourcier_uk&utm_medium=referral";

const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const isForce = args.includes("--force");

const altFlagIndex = args.indexOf("--alt");
const altText = altFlagIndex !== -1 ? (args[altFlagIndex + 1] ?? null) : null;

const skipIndices = new Set();
args.forEach((arg, i) => {
  if (arg === "--dry-run" || arg === "--force") skipIndices.add(i);
  if (arg === "--alt") {
    skipIndices.add(i);
    skipIndices.add(i + 1);
  }
});
const positional = args.filter((_, i) => !skipIndices.has(i));
let [slug, photoInput] = positional;

if (!slug) {
  const postDirs = discoverPosts(POSTS_DIR)
    .map((post) => post.id)
    .sort();

  slug = await select({
    message: "Select a post:",
    choices: postDirs.map((d) => ({ value: d })),
  }).catch(() => process.exit(0));
}

const { directory: postDir, id: postId } = resolvePostDirectory(
  POSTS_DIR,
  slug,
);

if (!photoInput) {
  photoInput = await input({
    message: "Unsplash photo URL or ID:",
    validate: (v) => v.trim() !== "" || "A photo URL or ID is required.",
  }).catch(() => process.exit(0));
}

function extractPhotoId(input) {
  // Handle slug-style URLs: /photos/description-words-PHOTOID
  // The ID is the trailing run of hyphen-separated segments that contain uppercase letters.
  // Slug words are all lowercase; the ID starts where uppercase chars appear.
  const path = input.replace(/^https?:\/\/unsplash\.com\/photos\//, "");
  const segments = path.split("-");

  let idStartIndex = segments.length - 1;
  for (let i = segments.length - 1; i >= 0; i--) {
    if (/[A-Z]/.test(segments[i])) {
      idStartIndex = i;
    } else {
      break;
    }
  }

  // A "--" right before the ID means the ID itself starts with "-" (some
  // Unsplash IDs do) — split() turns that into an empty segment that would
  // otherwise get dropped, silently truncating the leading "-" off the ID.
  if (segments[idStartIndex - 1] === "") {
    idStartIndex -= 1;
  }

  return segments.slice(idStartIndex).join("-");
}

async function fetchPhotoMeta(photoId) {
  // Unsplash's internal API — no key needed, returns full photo data including CDN URLs
  const response = await fetch(`https://unsplash.com/napi/photos/${photoId}`, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(
      `Could not fetch photo metadata (${response.status} ${response.statusText}) — verify the photo ID is correct: ${photoId}`,
    );
  }

  const data = await response.json();

  const rawCdnUrl = data.urls?.raw;
  if (!rawCdnUrl) {
    throw new Error("Photo metadata did not include a CDN URL.");
  }

  return {
    rawCdnUrl,
    photographerName: data.user?.name ?? null,
    authorUrl: data.user?.links?.html ?? null,
    altDescription: data.alt_description ?? null,
  };
}

async function main() {
  const photoId = extractPhotoId(photoInput);

  console.log(`Slug:     ${slug}`);
  console.log(`Photo ID: ${photoId}`);
  console.log("\nFetching photo metadata...");

  const { rawCdnUrl, photographerName, authorUrl, altDescription } =
    await fetchPhotoMeta(photoId);

  // Strip existing query params then add our own for download
  const imageUrl = `${rawCdnUrl.split("?")[0]}?w=1920&fit=max&fm=webp&q=85`;

  // Always use the canonical short URL in outbound links
  const canonicalPhotoUrl = `https://unsplash.com/photos/${photoId}`;
  const unsplashPhotoUrl = `${canonicalPhotoUrl}?${UTM}`;

  const photographerUrl = authorUrl
    ? `${authorUrl.split("?")[0]}?${UTM}`
    : unsplashPhotoUrl;

  const resolvedName = photographerName ?? "TODO: photographer name";
  const resolvedAlt =
    altText ?? altDescription ?? `Photo by ${resolvedName} on Unsplash`;

  if (photographerName) {
    console.log(`✓ Photographer: ${photographerName}`);
  } else {
    console.log(
      "⚠ Photographer name not found — update the credits frontmatter manually.",
    );
  }

  const outputPath = join(postDir, `${postId}-cover.webp`);

  if (existsSync(outputPath) && !isForce && !isDryRun) {
    console.error(
      `\nError: ${outputPath} already exists. Use --force to overwrite.`,
    );
    process.exit(1);
  }

  if (isDryRun) {
    console.log("\n[DRY RUN] Would download:");
    console.log(`  Source: ${imageUrl}`);
    console.log(`  Output: ${outputPath}`);
  } else {
    if (!existsSync(postDir)) {
      mkdirSync(postDir, { recursive: true });
    }

    console.log("\nDownloading image...");
    const imgResponse = await fetch(imageUrl);
    if (!imgResponse.ok) {
      throw new Error(`Failed to download image: ${imgResponse.status}`);
    }

    const buffer = Buffer.from(await imgResponse.arrayBuffer());
    writeFileSync(outputPath, buffer);
    console.log(`✓ Saved: ${outputPath}`);
  }

  const frontmatter = [
    `cover:`,
    `  image: "./${postId}-cover.webp"`,
    `  alt: "${resolvedAlt}"`,
    `credits:`,
    `  - label: "Cover photo"`,
    `    text: "${resolvedName} on Unsplash"`,
    `    url: "${photographerUrl}"`,
  ].join("\n");

  console.log("\n─────────────────────────────────────────────────");
  console.log("Suggested frontmatter:");
  console.log("─────────────────────────────────────────────────");
  console.log(frontmatter);
  console.log("─────────────────────────────────────────────────");
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
