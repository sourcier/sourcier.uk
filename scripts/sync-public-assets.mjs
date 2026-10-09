import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { select } from "@inquirer/prompts";
import { discoverPosts } from "./lib/posts.mjs";

import { rasterizePostImages } from "./rasterize-post-images.mjs";

const postsDir = "./collections/posts";

const syncJobs = {
  thumbnails: {
    destinationDir: "./public/search-thumbnails",
    includePatterns: ["*-thumbnail.webp"],
    skipMessage:
      "No collections/posts directory found; skipping thumbnail copy.",
    successMessage: "Copied thumbnails to public/search-thumbnails/",
  },
  "post-images": {
    destinationDir: "./public/post-images",
    includePatterns: ["*.svg"],
    skipMessage:
      "No collections/posts directory found; skipping post image copy.",
    successMessage: "Copied post images to public/post-images/",
  },
};

let mode = process.argv[2];
let syncJob = syncJobs[mode];

if (!syncJob) {
  mode = await select({
    message: "What would you like to sync?",
    choices: Object.keys(syncJobs).map((key) => ({ value: key })),
  }).catch(() => process.exit(0));
  syncJob = syncJobs[mode];
}

if (!existsSync(postsDir)) {
  console.log(syncJob.skipMessage);
  process.exit(0);
}

mkdirSync(syncJob.destinationDir, { recursive: true });

const posts = discoverPosts(postsDir);
const ids = new Set(posts.map((post) => post.id));
for (const entry of readdirSync(syncJob.destinationDir, {
  withFileTypes: true,
})) {
  if (entry.isDirectory() && !ids.has(entry.name)) {
    rmSync(join(syncJob.destinationDir, entry.name), { recursive: true });
  }
}
for (const post of posts) {
  const destination = join(syncJob.destinationDir, post.id);
  mkdirSync(destination, { recursive: true });
  execFileSync(
    "rsync",
    [
      "-a",
      "--delete",
      "--delete-excluded",
      ...syncJob.includePatterns.map((pattern) => `--include=${pattern}`),
      "--exclude=*",
      `${post.directory}/`,
      `${destination}/`,
    ],
    { stdio: "inherit" },
  );
}
console.log(syncJob.successMessage);

if (mode === "post-images") {
  const generated = await rasterizePostImages(syncJob.destinationDir);
  console.log(`Generated ${generated} PNG fallback(s) in public/post-images/`);
}
