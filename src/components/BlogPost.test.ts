import { beforeAll, describe, expect, it } from "vitest";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import BlogPost from "./BlogPost.astro";
import { normalizeHtml } from "../test/helpers";

describe("BlogPost", () => {
  let container: Awaited<ReturnType<typeof AstroContainer.create>>;

  beforeAll(async () => {
    container = await AstroContainer.create();
  });

  const props = {
    title: "Engineering notes",
    description: "Practical engineering guidance.",
    url: "/blog/engineering-notes",
    pubDate: new Date("2020-01-01T00:00:00Z"),
    draft: false,
  };

  it("renders published cards without preview state", async () => {
    const html = normalizeHtml(
      await container.renderToString(BlogPost, { props }),
    );
    expect(html).toContain('class="blog-card"');
    expect(html).toContain('class="heading"');
    expect(html).not.toContain("data-preview");
    expect(html).not.toContain('class="status"');
  });

  it.each([
    { draft: true, pubDate: props.pubDate, status: "draft", label: "Draft" },
    {
      draft: false,
      pubDate: new Date("2999-01-01T00:00:00Z"),
      status: "scheduled",
      label: "Scheduled",
    },
  ])(
    "marks $status cards explicitly",
    async ({ draft, pubDate, status, label }) => {
      const html = normalizeHtml(
        await container.renderToString(BlogPost, {
          props: { ...props, draft, pubDate },
        }),
      );
      expect(html).toContain('data-preview="true"');
      expect(html).toContain(`class="status" data-status="${status}"`);
      expect(html).toContain(`aria-label="${label}"`);
    },
  );
});
