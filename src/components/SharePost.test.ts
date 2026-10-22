import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { beforeAll, describe, expect, it } from "vitest";
import SharePost from "./SharePost.astro";
import { normalizeHtml } from "../test/helpers";

const baseProps = {
  title: "How to build a blog with Astro",
  url: "https://sourcier.uk/blog/how-this-blog-was-built/",
};

describe("SharePost", () => {
  let container: Awaited<ReturnType<typeof AstroContainer.create>>;

  beforeAll(async () => {
    container = await AstroContainer.create();
  });

  it("renders without variant modifiers by default", async () => {
    const normalized = normalizeHtml(
      await container.renderToString(SharePost, { props: baseProps }),
    );
    expect(normalized).not.toContain("data-vertical");
    expect(normalized).not.toContain('data-variant="hero"');
    expect(normalized).not.toContain('data-variant="sidebar"');
  });

  it("renders vertical layout", async () => {
    const html = await container.renderToString(SharePost, {
      props: { ...baseProps, vertical: true },
    });
    expect(normalizeHtml(html)).toContain('data-vertical="true"');
  });

  it("renders hero variant", async () => {
    const html = await container.renderToString(SharePost, {
      props: { ...baseProps, variant: "hero" },
    });
    expect(normalizeHtml(html)).toContain('data-variant="hero"');
  });

  it("renders sidebar variant", async () => {
    const html = await container.renderToString(SharePost, {
      props: { ...baseProps, variant: "sidebar" },
    });
    expect(normalizeHtml(html)).toContain('data-variant="sidebar"');
  });

  it("encodes the url in share links", async () => {
    const html = await container.renderToString(SharePost, {
      props: baseProps,
    });
    expect(normalizeHtml(html)).toContain(encodeURIComponent(baseProps.url));
  });
});
