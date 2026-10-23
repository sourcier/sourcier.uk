import { test, expect, type Locator, type Page } from "@playwright/test";

async function visit(page: Page, path: string) {
  await page.goto(path);
  await page.evaluate(() => document.fonts.ready);
}

async function expectColumns(locator: Locator, columns: number) {
  await expect(locator).toBeVisible();
  await expect
    .poll(() =>
      locator.evaluate(
        (element) =>
          getComputedStyle(element).gridTemplateColumns.split(" ").length,
      ),
    )
    .toBe(columns);
}

async function expectWithinViewport(locator: Locator, width: number) {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(-1);
  expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
}

for (const width of [639, 640, 1023, 1024]) {
  test(`blog grid at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await visit(page, "/blog");
    await expectColumns(
      page.locator(".blog-grid-section .layout"),
      width < 640 ? 1 : width < 1024 ? 2 : 3,
    );
  });
}

for (const width of [767, 768, 769]) {
  test(`home grids at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await visit(page, "/");
    await expectColumns(
      page.locator(".audience-paths .grid"),
      width < 768 ? 1 : 3,
    );
    await expectColumns(page.locator(".home-post-grid"), width < 769 ? 1 : 3);
  });
}

for (const width of [959, 960]) {
  test(`home community layout at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await visit(page, "/");
    await expectColumns(
      page.locator(".community-offer .grid"),
      width < 960 ? 1 : 3,
    );
  });

  test(`course bundle layout at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await visit(page, "/courses");
    await expectColumns(
      page.locator(".courses-bundle .courses"),
      width < 960 ? 2 : 4,
    );
  });

  test(`charity intro layout at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await visit(page, "/charity-support");
    await expectColumns(
      page.locator(".charity-intro .grid"),
      width < 960 ? 1 : 2,
    );
  });
}

for (const width of [1099, 1100]) {
  test(`course launch modules at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await visit(page, "/");
    await expectColumns(
      page.locator(".course-launch .modules"),
      width < 1100 ? 2 : 4,
    );
  });
}

for (const width of [1215, 1216, 1407, 1408]) {
  test(`container width at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await visit(page, "/");
    await expect(page.locator(".site-nav > .container")).toHaveCSS(
      "max-width",
      `${width < 1216 ? 960 : width < 1408 ? 1152 : 1344}px`,
    );
  });
}

for (const width of [1279, 1280]) {
  test(`article sidebar at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await visit(page, "/blog/markdown-test");
    const sidebar = page.locator(".post .sidebar");
    if (width < 1280) {
      await expect(sidebar).toBeHidden();
    } else {
      await expect(sidebar).toBeVisible();
    }
  });
}

for (const width of [320, 768, 1024, 1279, 1280, 1440, 1920]) {
  test(`series navigation aligns with article at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await visit(page, "/blog/how-this-blog-was-built");
    const navigation = page.getByRole("navigation", { name: "Article series" });
    await expectWithinViewport(navigation, width);
    const navigationBox = await navigation.boundingBox();
    const contentBox = await page.locator("#post-content").boundingBox();
    expect(contentBox).not.toBeNull();
    expect(navigationBox!.x).toBeCloseTo(contentBox!.x, 0);
    expect(navigationBox!.width).toBeCloseTo(contentBox!.width, 0);
  });
}

test("article table of contents marks its current location", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await visit(page, "/blog/markdown-test");
  const tocLink = page.locator(".toc .link").first();
  const href = await tocLink.getAttribute("href");
  if (!href) throw new Error("Expected a table-of-contents link.");
  expect(href).toMatch(/^#/);
  const heading = page.locator(href);
  await heading.evaluate((element) => {
    window.scrollTo(
      0,
      element.getBoundingClientRect().top + window.scrollY - 120,
    );
  });
  await expect(tocLink).toHaveAttribute("aria-current", "location");
  await expect(tocLink).not.toHaveClass(/is-active/);
});

test("subscription feedback retains its styling through failure and retry", async ({
  page,
}) => {
  let succeed = false;
  await page.route("**/.netlify/functions/subscribe", async (route) => {
    await route.fulfill({
      status: succeed ? 200 : 503,
      json: succeed ? { success: true } : { error: "Please try again." },
    });
  });
  await visit(page, "/courses");
  const form = page.locator("form[data-email-id]").first();
  const feedback = form.locator("[aria-live]");
  const originalClass = await feedback.getAttribute("class");
  await form
    .getByRole("textbox", { name: "Email address" })
    .fill("reader@example.com");
  await form.getByRole("button").click();
  await expect(feedback).toHaveAttribute("data-status", "error");
  await expect(feedback).toHaveAttribute("class", originalClass ?? "");
  await expect(form.getByRole("button")).toBeEnabled();
  succeed = true;
  await form.getByRole("button").click();
  await expect(feedback).toHaveAttribute("data-status", "success");
  await expect(feedback).toHaveAttribute("class", originalClass ?? "");
  await expect(form.getByRole("button")).toBeDisabled();
});

test.describe("touch interactions", () => {
  test.use({ isMobile: true, hasTouch: true });

  for (const width of [320, 375, 425, 768, 960, 1023, 1024]) {
    test(`navigation and search at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1024 });
      await visit(page, "/");
      const menu = page.locator("#mobileMenu");
      const burger = page.getByRole("button", { name: "menu", exact: true });

      if (width < 1024) {
        await expect(menu).toBeHidden();
        await burger.tap();
        await expect(burger).toHaveAttribute("aria-expanded", "true");
        await expect(menu).toHaveAttribute("data-open", "");
        await expect(menu).toBeVisible();
        await expectWithinViewport(menu, width);
        await burger.tap();
        await expect(burger).toHaveAttribute("aria-expanded", "false");
        await expect(menu).not.toHaveAttribute("data-open");
        await expect(menu).toBeHidden();
      } else {
        await expect(burger).toBeHidden();
        await expect(menu).toBeVisible();
      }

      await page
        .getByRole("button", { name: "Open search" })
        .filter({ visible: true })
        .tap();
      const search = page.getByRole("dialog", { name: "Site search" });
      await expect(search).toBeVisible();
      await expect(
        page.getByRole("searchbox", { name: "Search query" }),
      ).toBeFocused();
      await expectWithinViewport(page.locator(".site-search .surface"), width);
      await page.getByRole("button", { name: "Close search" }).tap();
      await expect(search).toBeHidden();
    });

    test(`course signup at ${width}px`, async ({ page }) => {
      let submission: unknown;
      await page.route("**/.netlify/functions/subscribe", async (route) => {
        submission = route.request().postDataJSON();
        await route.fulfill({ json: { success: true } });
      });
      await page.setViewportSize({ width, height: 1024 });
      await visit(page, "/courses");
      const form = page.locator(".course-interest-form");
      await expectWithinViewport(form, width);
      await form
        .getByRole("textbox", { name: "Email address" })
        .fill("reader@example.com");
      await form.getByRole("button").tap();
      await expect(form.locator("[aria-live]")).toBeVisible();
      await expect(form.locator("[aria-live]")).toHaveText(
        (await form.getAttribute("data-success")) ?? "",
      );
      await expect(form.getByRole("button")).toBeDisabled();
      expect(submission).toMatchObject({ email: "reader@example.com" });
    });

    test(`support amount selection at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1024 });
      await visit(page, "/blog/markdown-test");
      const modal = page.getByRole("dialog", { name: "Support checkout" });
      test.skip(
        (await page.locator("[data-support-modal]").count()) === 0,
        "Support checkout requires PUBLIC_STRIPE_PUBLISHABLE_KEY at build time.",
      );
      // Never create a checkout session or contact Stripe from this interaction check.
      await page.route("https://js.stripe.com/**", (route) => route.abort());
      await page.route(
        "**/.netlify/functions/support-checkout-session",
        (route) => route.abort(),
      );
      await page
        .locator("[data-support-modal-open]")
        .filter({ visible: true })
        .first()
        .tap();
      await expect(modal).toBeVisible();
      await expectWithinViewport(modal, width);
      await modal.getByRole("radio", { name: "Custom" }).check();
      await expect(modal.getByLabel("Custom amount in pounds")).toBeVisible();
      await modal.getByLabel("Custom amount in pounds").fill("12.50");
      await modal.getByRole("button", { name: "Close support checkout" }).tap();
      await expect(modal).toBeHidden();
    });
  }
});

for (const path of [
  "/",
  "/about",
  "/courses",
  "/blog/markdown-test",
  "/contact",
]) {
  test(`desktop reflow at 320px: ${path}`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await visit(page, path);
    expect(await page.evaluate(() => window.innerWidth)).toBe(320);
    await expectWithinViewport(page.locator("h1").first(), 320);
    await expectWithinViewport(page.locator(".site-nav .brand"), 320);
    await expectWithinViewport(page.locator(".footer"), 320);
    const overflow = await page.locator("main").evaluate((main) => {
      const width = document.documentElement.clientWidth;
      return Array.from(main.querySelectorAll("h1, h2, p, a, button, input"))
        .filter((element) => {
          if (
            element.closest(
              "pre, table, svg, [aria-hidden='true'], .visually-hidden",
            )
          )
            return false;
          const box = element.getBoundingClientRect();
          let ancestor = element.parentElement;
          while (ancestor && ancestor !== main) {
            const style = getComputedStyle(ancestor);
            if (
              ["hidden", "clip", "auto", "scroll"].includes(style.overflowX)
            ) {
              const bounds = ancestor.getBoundingClientRect();
              // Offscreen carousel slides are deliberately clipped, not page overflow.
              if (box.right <= bounds.left || box.left >= bounds.right) {
                return false;
              }
            }
            ancestor = ancestor.parentElement;
          }
          return (
            box.width > 0 &&
            box.height > 0 &&
            (box.left < -1 || box.right > width + 1)
          );
        })
        .map((element) => `${element.tagName}.${element.className}`);
    });
    expect(overflow).toEqual([]);
  });
}
