import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { beforeAll, describe, expect, it } from "vitest";
import GuideCard from "./GuideCard.astro";
import { normalizeHtml } from "../test/helpers";

const baseProps = {
  slug: "transition-into-tech",
  title: "Transition into Tech",
  summary: "Break into the industry and land your first role.",
  href: "/guides/transition-into-tech/",
  publishedCount: 4,
  plannedCount: 3,
};

describe("GuideCard", () => {
  let container: Awaited<ReturnType<typeof AstroContainer.create>>;

  beforeAll(async () => {
    container = await AstroContainer.create();
  });

  it("renders with default primary variant", async () => {
    const html = await container.renderToString(GuideCard, {
      props: baseProps,
    });
    expect(normalizeHtml(html)).toContain('data-variant="primary"');
  });

  it("renders secondary variant", async () => {
    const html = await container.renderToString(GuideCard, {
      props: { ...baseProps, variant: "secondary" },
    });
    expect(normalizeHtml(html)).toContain('data-variant="secondary"');
  });

  it("hides meta row when hideMeta is true", async () => {
    const html = await container.renderToString(GuideCard, {
      props: { ...baseProps, hideMeta: true },
    });
    expect(normalizeHtml(html)).not.toContain("published now");
  });

  it("shows meta row by default", async () => {
    const html = await container.renderToString(GuideCard, {
      props: baseProps,
    });
    expect(normalizeHtml(html)).toContain("4 published now");
    expect(normalizeHtml(html)).toContain("3 planned next");
  });

  it("uses fallback icon for unknown slug", async () => {
    const html = await container.renderToString(GuideCard, {
      props: { ...baseProps, slug: "unknown-guide" },
    });
    const normalized = normalizeHtml(html);
    expect(normalized).toContain('class="icon"');
    expect(normalized).toContain("<svg");
  });

  it("renders the CTA link with correct href", async () => {
    const html = await container.renderToString(GuideCard, {
      props: baseProps,
    });
    expect(normalizeHtml(html)).toContain(
      'href="/guides/transition-into-tech/"',
    );
  });
});
