import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { beforeAll, describe, expect, it } from "vitest";
import PageHistory from "./PageHistory.astro";
import { normalizeHtml } from "../test/helpers";

const entries = [
  { datetime: new Date("2025-01-15T00:00:00Z"), note: "Initial publication" },
  { datetime: new Date("2025-03-20T00:00:00Z"), note: "Added code examples" },
];

describe("PageHistory", () => {
  let container: Awaited<ReturnType<typeof AstroContainer.create>>;

  beforeAll(async () => {
    container = await AstroContainer.create();
  });

  it("renders an entry for each item", async () => {
    const normalized = normalizeHtml(
      await container.renderToString(PageHistory, { props: { entries } }),
    );
    expect(normalized).toContain("Initial publication");
    expect(normalized).toContain("Added code examples");
  });

  it("renders a machine-readable datetime attribute", async () => {
    const normalized = normalizeHtml(
      await container.renderToString(PageHistory, { props: { entries } }),
    );
    expect(normalized).toContain('datetime="2025-01-15');
    expect(normalized).toContain('datetime="2025-03-20');
  });

  it("renders an empty list when no entries are provided", async () => {
    const normalized = normalizeHtml(
      await container.renderToString(PageHistory, { props: { entries: [] } }),
    );
    expect(normalized).toContain('class="log"');
    expect(normalized).not.toContain('class="entry"');
  });
});
