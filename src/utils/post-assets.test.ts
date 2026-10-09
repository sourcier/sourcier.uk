import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const syncScript = resolve("scripts/sync-public-assets.mjs");
const thumbnailScript = resolve("scripts/process-thumbnails.mjs");

describe("nested post assets", () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "sourcier-assets-"));
    for (const slug of ["series", "series/article"]) {
      const directory = join(root, "collections/posts", slug);
      mkdirSync(directory, { recursive: true });
      writeFileSync(join(directory, "index.md"), "---\ntitle: Test\n---");
    }
  });
  afterEach(() => rmSync(root, { recursive: true }));

  it("copies thumbnails to stable leaf-ID paths without nesting child posts", () => {
    const source = join(
      root,
      "collections/posts/series/article/article-thumbnail.webp",
    );
    writeFileSync(source, "thumbnail");
    const stale = join(root, "public/search-thumbnails/old-post");
    mkdirSync(stale, { recursive: true });
    writeFileSync(join(stale, "old-thumbnail.webp"), "stale");
    execFileSync(process.execPath, [syncScript, "thumbnails"], { cwd: root });
    expect(
      readFileSync(
        join(root, "public/search-thumbnails/article/article-thumbnail.webp"),
        "utf8",
      ),
    ).toBe("thumbnail");
    expect(
      existsSync(join(root, "public/search-thumbnails/series/article")),
    ).toBe(false);
    expect(existsSync(stale)).toBe(false);
    expect(existsSync(source)).toBe(true);
  });

  it("copies SVGs and generates PNG fallbacks at unchanged public URLs", () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="#fff"/></svg>';
    writeFileSync(
      join(root, "collections/posts/series/article/diagram.svg"),
      svg,
    );
    execFileSync(process.execPath, [syncScript, "post-images"], { cwd: root });
    expect(
      readFileSync(
        join(root, "public/post-images/article/diagram.svg"),
        "utf8",
      ),
    ).toBe(svg);
    expect(
      existsSync(join(root, "public/post-images/article/diagram.png")),
    ).toBe(true);
    expect(existsSync(join(root, "public/post-images/series/article"))).toBe(
      false,
    );
  });

  it("finds nested covers by stable slug when generating thumbnails", () => {
    writeFileSync(
      join(root, "collections/posts/series/article/article-cover.webp"),
      "cover",
    );
    const output = execFileSync(
      process.execPath,
      [thumbnailScript, "--dry-run", "article"],
      { cwd: root, encoding: "utf8" },
    );
    expect(output).toContain("article: generating article-thumbnail.webp");
    expect(output).toContain("Thumbs generated: 1");
    expect(
      existsSync(
        join(root, "collections/posts/series/article/article-thumbnail.webp"),
      ),
    ).toBe(false);
  });
});
