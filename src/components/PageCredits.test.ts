import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { beforeAll, describe, expect, it } from "vitest";
import PageCredits from "./PageCredits.astro";
import { normalizeHtml } from "../test/helpers";

const withUrl = [
  { label: "Photo", text: "Jane Doe", url: "https://example.com/jane" },
];
const withoutUrl = [{ label: "Tool", text: "Astro" }];

describe("PageCredits", () => {
  let container: Awaited<ReturnType<typeof AstroContainer.create>>;

  beforeAll(async () => {
    container = await AstroContainer.create();
  });

  it("renders a linked credit when url is provided", async () => {
    const normalized = normalizeHtml(
      await container.renderToString(PageCredits, {
        props: { entries: withUrl },
      }),
    );
    expect(normalized).toContain('href="https://example.com/jane"');
    expect(normalized).toContain("Jane Doe");
    expect(normalized).toContain('rel="noopener noreferrer"');
  });

  it("renders a plain text credit when url is omitted", async () => {
    const normalized = normalizeHtml(
      await container.renderToString(PageCredits, {
        props: { entries: withoutUrl },
      }),
    );
    expect(normalized).toContain("Astro");
    expect(normalized).not.toContain("<a ");
  });

  it("renders the label for each entry", async () => {
    const normalized = normalizeHtml(
      await container.renderToString(PageCredits, {
        props: { entries: withUrl },
      }),
    );
    expect(normalized).toContain("Photo");
  });

  it("renders an empty list when no entries are provided", async () => {
    const normalized = normalizeHtml(
      await container.renderToString(PageCredits, { props: { entries: [] } }),
    );
    expect(normalized).toContain('class="list"');
    expect(normalized).not.toContain('class="item"');
  });
});
