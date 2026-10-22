import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { beforeAll, describe, expect, it } from "vitest";
import CourseInterestForm from "./CourseInterestForm.astro";
import { normalizeHtml } from "../test/helpers";

describe("CourseInterestForm", () => {
  let container: Awaited<ReturnType<typeof AstroContainer.create>>;

  beforeAll(async () => {
    container = await AstroContainer.create();
  });

  it("renders without stacked layout by default", async () => {
    const html = await container.renderToString(CourseInterestForm);
    expect(normalizeHtml(html)).not.toContain("data-stacked");
  });

  it("renders stacked layout", async () => {
    const html = await container.renderToString(CourseInterestForm, {
      props: { stackFields: true },
    });
    expect(normalizeHtml(html)).toContain('data-stacked="true"');
  });

  it("uses custom idPrefix for form element IDs", async () => {
    const html = await container.renderToString(CourseInterestForm, {
      props: { idPrefix: "js-frontend" },
    });
    expect(normalizeHtml(html)).toContain('id="js-frontend-form"');
    expect(normalizeHtml(html)).toContain('id="js-frontend-email"');
  });

  it("renders custom button label", async () => {
    const html = await container.renderToString(CourseInterestForm, {
      props: { buttonLabel: "Notify me" },
    });
    expect(normalizeHtml(html)).toContain("Notify me");
  });
});
