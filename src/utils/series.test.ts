import { describe, expect, it, vi } from "vitest";
import { getSeriesNavigation } from "./series";
import { isPubliclyPublished } from "./drafts";

function post(
  id: string,
  seriesOrder: number,
  draft = false,
  pubDate = new Date("2020-01-01"),
) {
  return {
    id,
    data: { title: id, draft, pubDate, series: "series", seriesOrder },
  };
}

describe("series navigation", () => {
  it("follows explicit reading order rather than dates or input order", () => {
    const navigation = getSeriesNavigation([
      post("last", 2),
      post("series", 0),
      post("first", 1),
    ]);
    expect(navigation.get("series")?.next?.id).toBe("first");
    expect(navigation.get("first")?.previous?.id).toBe("series");
    expect(navigation.get("first")?.next?.id).toBe("last");
    expect(navigation.get("last")?.previous?.id).toBe("first");
    expect(navigation.get("last")?.next).toBeUndefined();
    expect(navigation.get("first")?.overview.id).toBe("series");
  });

  it("excludes draft and future articles from public navigation", () => {
    const navigation = getSeriesNavigation(
      [
        post("series", 0),
        post("first", 1),
        post("draft", 2, true),
        post("scheduled", 3, false, new Date("2999-01-01")),
        post("last", 4),
      ],
      isPubliclyPublished,
    );
    expect(navigation.has("draft")).toBe(false);
    expect(navigation.has("scheduled")).toBe(false);
    expect(navigation.get("first")?.next?.id).toBe("last");
    expect(navigation.get("last")?.order).toBe(4);
    expect(navigation.get("series")?.total).toBe(2);
  });

  it("includes explicit draft and scheduled statuses in previews", () => {
    const navigation = getSeriesNavigation(
      [
        post("series", 0),
        post("draft", 1, true),
        post("scheduled", 2, false, new Date("2999-01-01")),
      ],
      () => true,
    );
    expect(navigation.get("series")?.next?.status).toBe("draft");
    expect(navigation.get("draft")?.next?.status).toBe("scheduled");
    expect(navigation.get("draft")?.previous?.id).toBe("series");
  });

  it.each(["true", "false"])(
    "uses SHOW_DRAFTS=%s for default navigation visibility",
    async (showDrafts) => {
      vi.stubEnv("SHOW_DRAFTS", showDrafts);
      vi.resetModules();
      try {
        const { getSeriesNavigation: getNavigation } = await import("./series");
        const navigation = getNavigation([
          post("series", 0),
          post("first", 1),
          post("draft", 2, true),
          post("scheduled", 3, false, new Date("2999-01-01")),
        ]);
        expect(navigation.get("first")?.previous?.id).toBe("series");
        expect(navigation.get("first")?.next?.id).toBe(
          showDrafts === "true" ? "draft" : undefined,
        );
        expect(navigation.has("scheduled")).toBe(showDrafts === "true");
      } finally {
        vi.unstubAllEnvs();
        vi.resetModules();
      }
    },
  );

  it("omits next when all remaining articles are unpublished", () => {
    const navigation = getSeriesNavigation(
      [
        post("series", 0),
        post("first", 1),
        post("draft", 2, true),
        post("scheduled", 3, false, new Date("2999-01-01")),
      ],
      isPubliclyPublished,
    );
    expect(navigation.get("first")?.next).toBeUndefined();
  });

  it("does not reveal a hidden overview or its title", () => {
    expect(
      getSeriesNavigation(
        [post("series", 0, true), post("first", 1)],
        isPubliclyPublished,
      ).size,
    ).toBe(0);
  });

  it("leaves standalone posts unchanged", () => {
    expect(
      getSeriesNavigation([
        {
          id: "standalone",
          data: {
            title: "Standalone",
            draft: false,
            pubDate: new Date("2020-01-01"),
          },
        },
      ]).size,
    ).toBe(0);
  });

  it("rejects missing overview, duplicate orders, and mismatched metadata", () => {
    expect(() => getSeriesNavigation([post("first", 1)])).toThrow(
      "needs an overview",
    );
    expect(() =>
      getSeriesNavigation([post("series", 0), post("a", 1), post("b", 1)]),
    ).toThrow("duplicate reading order");
    expect(() =>
      getSeriesNavigation([
        {
          id: "bad",
          data: {
            title: "Bad",
            draft: false,
            pubDate: new Date(),
            series: "series",
          },
        },
      ]),
    ).toThrow("both series and seriesOrder");
  });
});
