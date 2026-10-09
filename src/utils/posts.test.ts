import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  discoverPosts,
  findPost,
  getPostId,
  resolvePostDirectory,
} from "../../scripts/lib/posts.mjs";

describe("post discovery", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "sourcier-posts-"));
  });
  afterEach(() => {
    rmSync(root, { recursive: true });
  });

  function post(path: string) {
    const directory = join(root, path);
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, "index.md"), "---\ntitle: Test\n---");
    return directory;
  }

  it("preserves leaf IDs across flat and nested paths", () => {
    expect(getPostId("post-name/index.md")).toBe("post-name");
    expect(getPostId("series/post-name/index.md")).toBe("post-name");
    expect(getPostId("series\\post-name\\index.md")).toBe("post-name");
  });

  it("discovers overview and nested posts while ignoring tool directories", () => {
    post("standalone");
    post("series");
    post("series/part-one");
    post(".git/hidden");
    post("node_modules/package");
    writeFileSync(join(root, "README.md"), "Not a post");
    expect(
      discoverPosts(root)
        .map((post) => post.id)
        .sort(),
    ).toEqual(["part-one", "series", "standalone"]);
  });

  it("rejects duplicate IDs rather than silently replacing a post", () => {
    post("one/same-id");
    post("two/same-id");
    expect(() => discoverPosts(root)).toThrow('Duplicate post ID "same-id"');
  });

  it("finds a moved post by its unchanged slug", () => {
    const directory = post("series/article");
    expect(findPost(root, "article").directory).toBe(directory);
    expect(() => findPost(root, "missing")).toThrow("Post not found: missing");
  });

  it("resolves existing slugs and new nested cover destinations", () => {
    const directory = post("series/article");
    expect(resolvePostDirectory(root, "article")).toEqual({
      directory,
      id: "article",
    });
    expect(resolvePostDirectory(root, "series/new-article")).toEqual({
      directory: join(root, "series/new-article"),
      id: "new-article",
    });
    expect(() => resolvePostDirectory(root, "../outside")).toThrow(
      "Invalid post slug",
    );
    expect(() => resolvePostDirectory(root, "/absolute")).toThrow(
      "Invalid post slug",
    );
  });
});
