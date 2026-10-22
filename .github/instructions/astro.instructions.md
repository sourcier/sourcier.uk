---
description: "Astro project-specific conventions for sourcier.uk (supplements the global Astro instructions)"
applyTo: "**/*.astro, **/*.ts, **/*.js, **/*.md, **/*.mdx"
---

# Astro: sourcier.uk Project Conventions

## Tech Stack

- **Astro 6** with Islands Architecture and Content Layer API
- **Styling:** Native CSS — scoped plain `<style>` blocks in components and an ordered global entrypoint at `src/styles/global.css`; no Bulma dependency or Sass preprocessor is required
- **Content:** Markdown in `collections/posts/` (separate git repo), loaded via `glob()` in `src/content.config.ts`
- **Hosting:** Netlify (serverless functions, edge functions, scheduled builds)
- **Search:** Pagefind static site search, indexed after build

## Development Commands

```sh
pnpm dev              # Dev server with drafts (localhost:8888 via Netlify CLI)
pnpm dev:no-drafts    # Dev server without drafts
pnpm build            # Production build to dist/
pnpm search:index     # Full local Pagefind index rebuild
pnpm talk:playwright  # Regenerate the Playwright JavaScript London talk deck and companion cover/thumbnail assets
pnpm thumbnails:generate  # Generate <slug>-thumbnail.webp for any post with a cover but no thumbnail
pnpm thumbnails:copy      # Mirror <slug>-thumbnail.webp files to public/search-thumbnails/<slug>/
pnpm post-images:copy     # Mirror SVG files to public/post-images/<slug>/ and generate PNG fallbacks
```

`pnpm dev` and `pnpm search:index` automatically run `thumbnails:copy` and `post-images:copy` first.

## Project-Specific Styling

- `src/styles/global.css` is the ordered global entrypoint imported by
  `BaseLayout.astro` after `reset.css`.
- Its imports are ordered by purpose: `theme.css`, `base.css`,
  `navigation.css`, `home-hero.css`, `controls.css`, `panels.css`,
  `series.css`, `post-markers.css`, `blog-cards.css`, `social-icons.css`,
  `contact.css`, `article.css`, and `search.css`.
- Shared color, surface, spacing, radius, and shadow tokens live in
  `src/styles/theme.css`; light and dark values are selected with
  `[data-theme="dark"]`.
- Use plain scoped `<style>` blocks for component-specific rules. Put styles
  for markup injected through `innerHTML` in the appropriate global CSS file,
  because Astro scoping does not reach injected elements.
- Global utilities such as `.visually-hidden` live in `src/styles/base.css`.
- The styles use native CSS; neither Bulma nor Sass is a project dependency.
- Breakpoints: 640px (mobile/tablet), 768px (tablet/desktop)
- Primary colour: `--color-pink: #e8006a`
- `cover.thumbnail` in content schema is a plain string (not an Astro image) — bypasses filename hashing so the path stays stable

## UI Conventions

- Audience-navigation surfaces should call curated routes **guides**; prefer "guide" over "path" in headings, buttons, and supporting copy unless explicitly asked otherwise
- In compact stat cards, place the small uppercase label above the value; longer role or employer details belong in sidebar-style fact cards instead
- When something is launching soon, promote that status into a distinct badge or label instead of relying on paragraph copy alone
- Draft and scheduled posts are distinct preview states — keep explicit `Draft` / `Scheduled` ribbons in cards and post heroes; do not present either state as published
- Full-bleed separators (footer dividers, section dividers) must span the full viewport width, not the container width

## Visual QA

- Dev server runs at `http://localhost:8888` — always use this URL for Playwright visual checks
- During visual QA, explicitly check supporting-label readability, hero-to-first-section spacing, footer divider spacing, and last-section-to-footer separation when those surfaces are present

## Thumbnail Pipeline

Pagefind search results display a thumbnail per post. The pipeline:

1. Cover images are stored as `<slug>-cover.webp` colocated with the article
2. `<slug>-thumbnail.webp` (96×96, center-cropped WebP) is pre-generated via `pnpm thumbnails:generate`
3. `pnpm thumbnails:copy` mirrors thumbnails to `public/search-thumbnails/<slug>/<slug>-thumbnail.webp`
4. The layout references the stable path `/search-thumbnails/${postId}/${postId}-thumbnail.webp`
5. `public/search-thumbnails/` is gitignored — regenerated on every build

When adding a new post with a cover:

1. Save cover as `<slug>-cover.webp` in the post directory
2. Run `pnpm thumbnails:generate` to create `<slug>-thumbnail.webp`
3. Add `cover.thumbnail: './<slug>-thumbnail.webp'` to the post frontmatter

When renaming a post slug:

1. Rename `collections/posts/<old-slug>/` to the new slug
2. Rename every slug-derived asset in that folder (`<slug>-cover-source.*`, `<slug>-cover.webp`, `<slug>-thumbnail.webp`)
3. Update frontmatter, any generator scripts, and any public download paths that derive from the old slug

## Testing

- Test files live in `src/components/__tests__/`
- Shared HTML normalizer lives in `src/test/helpers.ts` — call `normalizeHtml()` before snapshotting to strip `data-astro-cid-*` hashes
- `pnpm test` / `pnpm test:watch` / `pnpm test:update`

## Visual Regression

Full-page screenshot tests using Playwright, covering 12 routes × 3 viewports.

- Config: `playwright.config.ts` — all Chromium, desktop (1280×900), tablet (Galaxy Tab S9), mobile (Pixel 7)
- Spec: `src/e2e/visual.spec.ts`
- Snapshots: `src/e2e/__snapshots__/visual.spec.ts-snapshots/{testFile}-snapshots/{platform}-{arch}/`, per `snapshotPathTemplate` in `playwright.config.ts`. Two folders are committed: `darwin-arm64` (generated natively on macOS, for local dev sanity checks) and `linux-x64` (the folder CI actually compares against, maintained only by the "Update Visual Baselines" workflow below)
- `pnpm test:visual` / `pnpm test:visual:update` — runs Playwright directly on the host (no Docker). Locally on macOS this produces/compares `darwin-arm64` baselines. These are for your own dev-loop only; they are never compared in CI

### Stability patterns

- Dynamic sections (recent posts, stats, tag cloud, guide meta) are masked with `dynamicSelectors`
- `.reactions` and `.comments` are hidden via injected CSS to prevent height variability
- `blog-post` clips height to `Math.floor(footerY / 16) * 16` to absorb sub-pixel font jitter, and uses `maxDiffPixelRatio: 0.05`
- All other routes use `maxDiffPixelRatio: 0.01`
- **Always hide `dynamicSelectors` before computing `clipToContent`, never after.** `clipToContent` measures `.footer`'s position to derive the clip height; if a dynamic section is hidden only afterwards (right before the screenshot), its height still leaks into that measurement even though it's invisible in the final image. On mobile this bit us via `.tags-sidebar`, which stacks below the article and grows/shrinks with `SHOW_DRAFTS`-dependent tag counts.
- **Don't visually test third-party client-rendered content with non-deterministic sizing — hide it instead.** The Mermaid diagram on `blog-post` renders from an external CDN script with font-dependent node sizing; across several CI runs the same height mismatch flip-flopped between which build (prod vs preview) it hit, proving genuine run-to-run non-determinism rather than a content difference. `.mermaid-diagram` is in `dynamicSelectors` for this reason, not because its content varies with drafts.
- If a pixel-diff shows the "first differing row" landing inside some element, that does **not** prove that element caused the shift — once two screenshots have different total heights, everything below the true divergence point renders as "different" wherever content is dense enough to register, regardless of where the divergence actually started. Confirm root cause by diffing the SSR HTML (both `SHOW_DRAFTS` states) byte-for-byte before trusting a pixel-scan location.

### CI

The `visual-regression` / `visual-regression-preview` jobs in `.github/workflows/ci.yml` run on
`ubuntu-latest` inside the pinned Playwright Docker image, and only ever compare against the
committed `linux-x64` baselines — they never write snapshots back to the repo. If no `linux-x64`
baselines exist yet for a route/viewport, that check is skipped rather than failed.

To (re)generate the `linux-x64` baselines, manually dispatch the **Update Visual Baselines**
workflow (`.github/workflows/update-visual-baselines.yml`) from the Actions tab. It builds the
site and runs Playwright with `--update-snapshots` on the same `ubuntu-latest` + Docker image the
CI check uses, then opens a PR with the resulting PNGs for review — baselines are always generated
and compared on the same machine type, so there's no cross-platform/cross-arch drift to chase.

The prod `build` job waits on `build-preview` and `visual-regression-preview` succeeding (or being
legitimately skipped, e.g. on `schedule`/`workflow_dispatch(prod)` triggers, where preview never
runs at all) before starting — a broken preview build blocks the prod path instead of both running
in parallel and wasting a prod build on a commit that's already known to fail.

Lighthouse (`lighthouse` / `lighthouse-preview` jobs, each a mobile+desktop matrix) passes a unique
`environment` input through to `.github/actions/lighthouse/action.yml`, which builds
`artifactName: lighthouse-results-${environment}-${form_factor}`. Without this, all four jobs in a
single run would try to upload an artifact named `lighthouse-results` and collide.
