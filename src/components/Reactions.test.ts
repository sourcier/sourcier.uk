import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { beforeAll, describe, expect, it } from "vitest";
import Reactions from "./Reactions.astro";
import { normalizeHtml } from "../test/helpers";

describe("Reactions", () => {
  let container: Awaited<ReturnType<typeof AstroContainer.create>>;

  beforeAll(async () => {
    container = await AstroContainer.create();
  });

  it("renders with default variant", async () => {
    const normalized = normalizeHtml(
      await container.renderToString(Reactions, {
        props: { postId: "my-post" },
      }),
    );
    expect(normalized).not.toContain('data-variant="hero"');
    expect(normalized).not.toContain("data-compact");
  });

  it("renders hero variant", async () => {
    const normalized = normalizeHtml(
      await container.renderToString(Reactions, {
        props: { postId: "my-post", variant: "hero" },
      }),
    );
    expect(normalized).toContain('data-variant="hero"');
  });

  it("renders compact modifier", async () => {
    const normalized = normalizeHtml(
      await container.renderToString(Reactions, {
        props: { postId: "my-post", compact: true },
      }),
    );
    expect(normalized).toContain('data-compact="true"');
  });

  it("changes heading text for hero variant", async () => {
    const defaultHtml = normalizeHtml(
      await container.renderToString(Reactions, {
        props: { postId: "my-post" },
      }),
    );
    const heroHtml = normalizeHtml(
      await container.renderToString(Reactions, {
        props: { postId: "my-post", variant: "hero" },
      }),
    );
    expect(defaultHtml).toContain("Did you find this useful?");
    expect(heroHtml).toContain("Was this useful?");
  });

  it("sets data-post-id from props", async () => {
    const normalized = normalizeHtml(
      await container.renderToString(Reactions, {
        props: { postId: "my-post" },
      }),
    );
    expect(normalized).toContain('data-post-id="my-post"');
  });

  it("renders all four reaction buttons", async () => {
    const normalized = normalizeHtml(
      await container.renderToString(Reactions, {
        props: { postId: "my-post" },
      }),
    );
    expect(normalized).toContain('data-reaction="heart"');
    expect(normalized).toContain('data-reaction="fire"');
    expect(normalized).toContain('data-reaction="bulb"');
    expect(normalized).toContain('data-reaction="clap"');
  });
});
