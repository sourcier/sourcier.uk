import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { beforeAll, describe, expect, it } from "vitest";
import PageHero from "./PageHero.astro";
import { normalizeHtml } from "../test/helpers";

describe("PageHero", () => {
  let container: Awaited<ReturnType<typeof AstroContainer.create>>;

  beforeAll(async () => {
    container = await AstroContainer.create();
  });

  it("renders the title", async () => {
    const normalized = normalizeHtml(
      await container.renderToString(PageHero, {
        props: { title: "About me" },
      }),
    );
    expect(normalized).toContain("About me");
    expect(normalized).toContain('class="heading"');
  });

  it("sets the default primary tone", async () => {
    const normalized = normalizeHtml(
      await container.renderToString(PageHero, { props: { title: "Test" } }),
    );
    expect(normalized).toContain('data-tone="primary"');
  });

  it("sets the requested tone", async () => {
    const normalized = normalizeHtml(
      await container.renderToString(PageHero, {
        props: { title: "Test", tone: "secondary" },
      }),
    );
    expect(normalized).toContain('data-tone="secondary"');
  });

  it("sets the cover image CSS variable when a cover is provided", async () => {
    const normalized = normalizeHtml(
      await container.renderToString(PageHero, {
        props: { title: "Test", coverImage: { src: "/images/hero.jpg" } },
      }),
    );
    expect(normalized).toContain("--cover-image: url('/images/hero.jpg')");
    expect(normalized).toContain('data-has-cover="true"');
  });

  it("sets data-has-cover to false when no cover is provided", async () => {
    const normalized = normalizeHtml(
      await container.renderToString(PageHero, { props: { title: "Test" } }),
    );
    expect(normalized).toContain('data-has-cover="false"');
  });

  it("renders subtitle when provided", async () => {
    const normalized = normalizeHtml(
      await container.renderToString(PageHero, {
        props: { title: "Test", subtitle: "A short intro" },
      }),
    );
    expect(normalized).toContain("A short intro");
  });

  it("renders kicker when provided", async () => {
    const normalized = normalizeHtml(
      await container.renderToString(PageHero, {
        props: { title: "Test", kicker: "Series" },
      }),
    );
    expect(normalized).toContain("Series");
  });

  it("renders tag links when tags are provided", async () => {
    const normalized = normalizeHtml(
      await container.renderToString(PageHero, {
        props: { title: "Test", tags: ["astro", "web-dev"] },
      }),
    );
    expect(normalized).toContain('href="/tags/astro"');
    expect(normalized).toContain('href="/tags/web-dev"');
  });
});
