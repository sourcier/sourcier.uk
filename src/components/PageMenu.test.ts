import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { beforeAll, describe, expect, it } from "vitest";
import PageMenu from "./PageMenu.astro";
import { normalizeHtml } from "../test/helpers";

const headings = [
  { depth: 2, slug: "intro", text: "Introduction" },
  { depth: 2, slug: "setup", text: "Setup" },
];

describe("PageMenu", () => {
  let container: Awaited<ReturnType<typeof AstroContainer.create>>;

  beforeAll(async () => {
    container = await AstroContainer.create();
  });

  it("renders no panel when no props are provided", async () => {
    const normalized = normalizeHtml(await container.renderToString(PageMenu));
    expect(normalized).toContain('data-has-panel="false"');
    expect(normalized).not.toContain("popover");
  });

  it("renders a table of contents when tocHeadings has more than one entry", async () => {
    const normalized = normalizeHtml(
      await container.renderToString(PageMenu, {
        props: { tocHeadings: headings },
      }),
    );
    expect(normalized).toContain('data-has-toc="true"');
    expect(normalized).toContain("Introduction");
    expect(normalized).toContain("Setup");
    expect(normalized).toContain('class="link toc-link"');
  });

  it("does not render a TOC for a single heading", async () => {
    const normalized = normalizeHtml(
      await container.renderToString(PageMenu, {
        props: { tocHeadings: [headings[0]] },
      }),
    );
    expect(normalized).toContain('data-has-toc="false"');
  });

  it("renders share section when shareTitle and shareUrl are provided", async () => {
    const normalized = normalizeHtml(
      await container.renderToString(PageMenu, {
        props: {
          shareTitle: "My Post",
          shareUrl: "https://sourcier.uk/blog/my-post/",
        },
      }),
    );
    expect(normalized).toContain('data-has-panel="true"');
    expect(normalized).toContain(
      encodeURIComponent("https://sourcier.uk/blog/my-post/"),
    );
  });
});
