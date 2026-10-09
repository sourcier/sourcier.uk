import { existsSync, readdirSync } from "node:fs";
import { basename, join, posix } from "node:path";

/** @param {string} entry */
export function getPostId(entry) {
  const normalized = entry.replaceAll("\\", "/");
  const id = posix.basename(posix.dirname(normalized));
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
    throw new Error(`Invalid post folder name: ${entry}`);
  }
  return id;
}

/** @param {string} postsDir */
export function discoverPosts(postsDir) {
  /** @type {{ id: string, directory: string, filePath: string }[]} */
  const posts = [];
  /** @type {Map<string, string>} */
  const ids = new Map();

  /** @param {string} directory */
  function visit(directory) {
    const entries = readdirSync(directory, { withFileTypes: true }).sort(
      (a, b) => a.name.localeCompare(b.name),
    );
    if (entries.some((entry) => entry.isFile() && entry.name === "index.md")) {
      const filePath = join(directory, "index.md");
      const id = getPostId(filePath);
      const previous = ids.get(id);
      if (previous) {
        throw new Error(
          `Duplicate post ID "${id}": ${previous} and ${filePath}`,
        );
      }
      ids.set(id, filePath);
      posts.push({ id, directory, filePath });
    }
    for (const entry of entries) {
      if (
        entry.isDirectory() &&
        !entry.name.startsWith(".") &&
        entry.name !== "node_modules"
      ) {
        visit(join(directory, entry.name));
      }
    }
  }

  visit(postsDir);
  return posts;
}

/** @param {string} postsDir @param {string} id */
export function findPost(postsDir, id) {
  const post = discoverPosts(postsDir).find((post) => post.id === id);
  if (!post) throw new Error(`Post not found: ${id}`);
  return post;
}

/** @param {string} postsDir @param {string} input */
export function resolvePostDirectory(postsDir, input) {
  const parts = input.split("/");
  if (parts.some((part) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(part))) {
    throw new Error(`Invalid post slug or relative folder path: ${input}`);
  }
  const existing = existsSync(postsDir)
    ? discoverPosts(postsDir).find((post) => post.id === input)
    : undefined;
  const directory = existing?.directory ?? join(postsDir, ...parts);
  return { directory, id: basename(directory) };
}
