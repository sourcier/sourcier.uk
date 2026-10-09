/**
 * Generates 96×96 center-cropped WebP thumbnails for all posts that have
 * a cover image (*-cover.webp) but no <slug>-thumbnail.webp yet.
 *
 * Usage:
 *   node scripts/process-thumbnails.mjs                    # skip existing thumbnails
 *   node scripts/process-thumbnails.mjs --force            # regenerate all thumbnails
 *   node scripts/process-thumbnails.mjs --force <slug>     # regenerate one post only
 *   node scripts/process-thumbnails.mjs --dry-run          # preview without changes
 */

import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { discoverPosts } from "./lib/posts.mjs";

const POSTS_DIR = "./collections/posts";
const THUMB_SIZE = "96x96";

const force = process.argv.includes("--force");
const dryRun = process.argv.includes("--dry-run");

// Optional slug argument: any non-flag argument after the script name
const slugFilter = process.argv.slice(2).find((a) => !a.startsWith("--"));

if (dryRun) console.log("Dry run — no files will be changed.\n");
if (slugFilter) console.log(`Filtering to slug: ${slugFilter}\n`);

let generated = 0;
let skipped = 0;

for (const { id: slug, directory: dir } of discoverPosts(POSTS_DIR)) {
  if (slugFilter && slug !== slugFilter) continue;

  const cover = readdirSync(dir).find((f) => /-cover\.webp$/i.test(f));
  if (!cover) continue;

  const thumbPath = join(dir, `${slug}-thumbnail.webp`);
  if (existsSync(thumbPath) && !force) {
    skipped++;
    continue;
  }

  console.log(`${slug}: generating ${slug}-thumbnail.webp`);
  if (!dryRun) {
    execFileSync(
      "magick",
      [
        join(dir, cover),
        "-resize",
        `${THUMB_SIZE}^`,
        "-gravity",
        "Center",
        "-extent",
        THUMB_SIZE,
        thumbPath,
      ],
      { stdio: "inherit" },
    );
  }
  generated++;
}

console.log(`\nDone.`);
console.log(`  Thumbs generated: ${generated}`);
console.log(`  Skipped:          ${skipped}`);
if (dryRun) console.log(`\n(dry run — no changes made)`);
