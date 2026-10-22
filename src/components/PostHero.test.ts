import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { beforeAll, describe, expect, it } from "vitest";
import PostHero from "./PostHero.astro";
import { normalizeHtml } from "../test/helpers";

describe("PostHero", () => {
  let container: Awaited<ReturnType<typeof AstroContainer.create>>;

  beforeAll(async () => {
    container = await AstroContainer.create();
  });

  it("renders the title", async () => {
    const normalized = normalizeHtml(
      await container.renderToString(PostHero, {
        props: { title: "How I built this blog" },
      }),
    );
    expect(normalized).toContain("How I built this blog");
  });

  it("adds cover modifier class when a cover image is provided", async () => {
    const normalized = normalizeHtml(
      await container.renderToString(PostHero, {
        props: { title: "Test" },
      }),
    );
    expect(normalized).not.toContain("data-has-cover");
  });

  it("renders fact row for date when provided", async () => {
    const normalized = normalizeHtml(
      await container.renderToString(PostHero, {
        props: { title: "Test", date: "25 Apr 2026" },
      }),
    );
    expect(normalized).toContain("25 Apr 2026");
    expect(normalized).toContain("Published");
  });

  it("uses custom dateLabel when provided", async () => {
    const normalized = normalizeHtml(
      await container.renderToString(PostHero, {
        props: { title: "Test", date: "25 Apr 2026", dateLabel: "Updated" },
      }),
    );
    expect(normalized).toContain("Updated");
  });

  it("renders reading time when provided", async () => {
    const normalized = normalizeHtml(
      await container.renderToString(PostHero, {
        props: { title: "Test", readingTime: "5 min read" },
      }),
    );
    expect(normalized).toContain("5 min read");
  });

  it("renders status when provided", async () => {
    const normalized = normalizeHtml(
      await container.renderToString(PostHero, {
        props: { title: "Test", status: "In progress" },
      }),
    );
    expect(normalized).toContain("In progress");
  });

  it("renders tag links when tags are provided", async () => {
    const normalized = normalizeHtml(
      await container.renderToString(PostHero, {
        props: { title: "Test", tags: ["astro", "netlify"] },
      }),
    );
    expect(normalized).toContain('href="/tags/astro"');
    expect(normalized).toContain('href="/tags/netlify"');
  });
});
