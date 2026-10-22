import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { beforeAll, describe, expect, it } from "vitest";
import Breadcrumb from "./Breadcrumb.astro";
import { normalizeHtml } from "../test/helpers";

const crumbs = [{ label: "Blog", href: "/blog/" }];
const deepCrumbs = [
  { label: "Blog", href: "/blog/" },
  { label: "Tag: astro", href: "/blog/tag/astro/" },
];

describe("Breadcrumb", () => {
  let container: Awaited<ReturnType<typeof AstroContainer.create>>;

  beforeAll(async () => {
    container = await AstroContainer.create();
  });

  it("renders with container div by default", async () => {
    const html = await container.renderToString(Breadcrumb, {
      props: { crumbs },
    });
    expect(normalizeHtml(html)).toContain(
      'class="container" data-width="narrow"',
    );
  });

  it("renders without container div when noContainer is true", async () => {
    const html = await container.renderToString(Breadcrumb, {
      props: { crumbs, noContainer: true },
    });
    expect(normalizeHtml(html)).not.toContain(
      'class="container" data-width="narrow"',
    );
  });

  it("adds inverted modifier class", async () => {
    const html = await container.renderToString(Breadcrumb, {
      props: { crumbs, inverted: true },
    });
    expect(normalizeHtml(html)).toContain("breadcrumb-nav--inverted");
  });

  it("renders multiple crumb levels with schema markup", async () => {
    const html = await container.renderToString(Breadcrumb, {
      props: { crumbs: deepCrumbs },
    });
    const normalized = normalizeHtml(html);
    expect(normalized).toContain(
      'itemtype="https://schema.org/BreadcrumbList"',
    );
    expect(normalized).toContain('itemprop="position"');
  });

  it("prepends Home as the first crumb", async () => {
    const html = await container.renderToString(Breadcrumb, {
      props: { crumbs: [] },
    });
    expect(normalizeHtml(html)).toContain("Home");
  });

  it("marks the last crumb as the current page", async () => {
    const html = await container.renderToString(Breadcrumb, {
      props: { crumbs },
    });
    expect(normalizeHtml(html)).toContain('aria-current="page"');
  });
});
