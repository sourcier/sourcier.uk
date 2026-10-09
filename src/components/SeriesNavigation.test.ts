import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { beforeAll, describe, expect, it } from "vitest";
import SeriesNavigation from "./SeriesNavigation.astro";
import { normalizeHtml } from "../test/helpers";
import type { SeriesNavigationData } from "../utils/series";
import { getSeriesNavigation } from "../utils/series";

const navigation: SeriesNavigationData = {
  overview: { id: "series", title: "Example series", status: "published" },
  order: 2,
  total: 3,
  previous: { id: "first", title: "First article", status: "published" },
  next: { id: "third", title: "Third article", status: "published" },
};

describe("SeriesNavigation", () => {
  let container: Awaited<ReturnType<typeof AstroContainer.create>>;
  beforeAll(async () => {
    container = await AstroContainer.create();
  });

  it("renders accessible overview and previous/next links with stable URLs", async () => {
    const html = normalizeHtml(
      await container.renderToString(SeriesNavigation, {
        props: { navigation },
      }),
    );
    expect(html).toContain('aria-label="Article series"');
    expect(html).toContain("data-pagefind-ignore");
    expect(html).toContain("Part 2");
    expect(html).toContain('href="/blog/series"');
    expect(html).toContain('href="/blog/first" rel="prev"');
    expect(html).toContain('href="/blog/third" rel="next"');
  });

  it("renders a start link on the overview without a self-link", async () => {
    const html = await container.renderToString(SeriesNavigation, {
      props: { navigation: { ...navigation, order: 0, previous: undefined } },
    });
    expect(html).toContain("Start the series");
    expect(html).toContain("3 articles");
    expect(html).not.toContain('href="/blog/series"');
    expect(html).not.toContain('rel="prev"');
  });

  it("labels unpublished preview links distinctly", async () => {
    const html = await container.renderToString(SeriesNavigation, {
      props: {
        navigation: {
          ...navigation,
          previous: { ...navigation.previous!, status: "draft" },
          next: { ...navigation.next!, status: "scheduled" },
        },
      },
    });
    expect(html).toContain("Draft");
    expect(html).toContain("Scheduled");
  });

  it("links the first draft article to its overview and next draft", async () => {
    const posts = [
      { id: "series", order: 0, title: "Example series" },
      { id: "first", order: 1, title: "First article" },
      { id: "second", order: 2, title: "Second article" },
    ].map(({ id, order, title }) => ({
      id,
      data: {
        title,
        draft: true,
        pubDate: new Date("2020-01-01"),
        series: "series",
        seriesOrder: order,
      },
    }));
    const html = normalizeHtml(
      await container.renderToString(SeriesNavigation, {
        props: {
          navigation: getSeriesNavigation(posts, () => true).get("first"),
        },
      }),
    );
    expect(html).toContain('href="/blog/series" rel="prev"');
    expect(html).toContain('href="/blog/second" rel="next"');
    expect(html).toContain("Previous");
    expect(html).toContain("Next");
    expect(html).toContain("Draft");
  });

  it("omits next navigation on the final article", async () => {
    const html = await container.renderToString(SeriesNavigation, {
      props: { navigation: { ...navigation, next: undefined } },
    });
    expect(html).not.toContain('rel="next"');
    expect(html).toContain('rel="prev"');
  });
});
