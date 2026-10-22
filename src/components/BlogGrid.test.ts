import { beforeAll, describe, expect, it } from "vitest";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import BlogGrid from "./BlogGrid.astro";
import { normalizeHtml } from "../test/helpers";

describe("BlogGrid", () => {
  let container: Awaited<ReturnType<typeof AstroContainer.create>>;

  beforeAll(async () => {
    container = await AstroContainer.create();
  });

  const props = {
    posts: [
      {
        id: "engineering-notes",
        body: "Practical engineering guidance.",
        data: {
          title: "Engineering notes",
          description: "Practical engineering guidance.",
          pubDate: new Date("2020-01-01T00:00:00Z"),
          draft: false,
        },
      },
    ],
    currentPage: 1,
    totalPages: 2,
    prevUrl: null,
    nextUrl: "/blog/page/2",
  };

  it("uses ARIA for disabled and current pagination states", async () => {
    const html = normalizeHtml(
      await container.renderToString(BlogGrid, { props }),
    );
    expect(html).toContain('class="step" aria-disabled="true" tabindex="-1"');
    expect(html).toContain('class="page" aria-current="page"');
    expect(html).toContain('href="/blog/page/2" class="step"');
  });

  it("does not show ghost cells before the final page", async () => {
    const html = normalizeHtml(
      await container.renderToString(BlogGrid, { props }),
    );
    expect(html).not.toContain("data-viewport");
  });

  it("marks final-page ghost cells by viewport", async () => {
    const html = normalizeHtml(
      await container.renderToString(BlogGrid, {
        props: {
          ...props,
          currentPage: 2,
          prevUrl: "/blog",
          nextUrl: null,
        },
      }),
    );
    expect(html).toContain('class="cell ghost" data-viewport="tablet-up"');
    expect(html).toContain('class="cell ghost" data-viewport="desktop-only"');
    expect(html).not.toContain('data-viewport="tablet-only"');
  });
});
