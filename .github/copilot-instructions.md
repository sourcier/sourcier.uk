# Copilot Instructions — sourcier.uk

Personal tech blog and engineering consultancy site built with Astro 6, Sass/Bulma, hosted on Netlify. Live at [sourcier.uk](https://sourcier.uk).

## Multi-repo setup

This project spans **two separate GitHub repositories** that must be treated independently for git operations:

1. **`sourcier/sourcier.uk`** (this repo) — the Astro site: pages, components, layouts, styles, Netlify functions, CI/CD, tests.
2. **`sourcier/sourcier.uk-content`** — blog post content (Markdown + images), cloned into `collections/posts/` at this repo's root.

`collections/posts/` is **not a submodule**. It's a plain git clone of the content repo, and `collections/posts/` is listed in this repo's `.gitignore` — the site repo has no knowledge of it as tracked content. CI clones it fresh on every build via `pnpm build:content:fetch` using a `GH_PAT` secret.

For local development, clone it once:

```sh
git clone git@github.com:sourcier/sourcier.uk-content.git collections/posts
```

**When working across both repos in the same task:**

- Run `git status` / `git diff` / commits separately in each repo — `collections/posts/` has its own `.git`, its own history, and its own remote.
- Never assume a single `git add -A && git commit` at the site repo root will pick up content changes; it won't (gitignored), and running git commands from inside `collections/posts/` operates on the content repo instead.
- The two repos have **different branching conventions** (see below) — don't apply one repo's rule to the other.

## Git workflow per repo

**Site repo (`sourcier.uk`):** trunk-based, `main` is the only long-lived branch. Make changes on short-lived feature branches and open a PR against `main` — do not commit directly to `main` unless the user explicitly asks for an urgent direct push. Every PR gets a real preview via the stable `preview` alias deploy (`preview--sourcieruk.netlify.app`, passcode-protected).

**Content repo (`sourcier.uk-content`):** stays on `main` unless the user asks for a different branch. Commits and pushes here trigger a full site rebuild via GitHub Actions (`repository_dispatch`) and deploy. Activate the commit-msg hook once per clone: `git config core.hooksPath .githooks`.

Never commit or push in either repo without an explicit instruction from the user.

## Key commands (site repo)

```sh
pnpm dev              # Dev server with drafts (localhost:8888 via Netlify CLI)
pnpm dev:no-drafts    # Dev server without drafts
pnpm build            # Production build to dist/
pnpm test             # Vitest unit tests
pnpm test:visual      # Playwright visual regression (native, darwin-arm64 locally)
pnpm lint / format
```

Requires Node.js (see `.nvmrc`), pnpm, and Netlify CLI.

## Where to look for more detail

- `.github/instructions/astro.instructions.md` — Astro conventions, thumbnail pipeline, testing, visual regression architecture, CI
- `.github/instructions/blog-content-patterns.instructions.md` — post frontmatter, content authoring checklist, tags
- `.github/instructions/markdown-content-creation.instructions.md` — markdown style rules for blog posts
- `.github/instructions/wireframe-design.instructions.md` — SVG wireframe conventions
- `.claude/CLAUDE.md` — the same project context, formatted for Claude Code

## Quick facts worth knowing before making changes

- Draft posts controlled by `SHOW_DRAFTS` env var and the `isPublished()` / `isPubliclyPublished()` utilities in `src/utils/drafts.ts`.
- CI (`.github/workflows/ci.yml`) always builds and tests the **preview** path (content with drafts) before the **prod** path (content without drafts) — the prod `build` job waits on `build-preview` and `visual-regression-preview` succeeding or being legitimately skipped, so a broken preview never wastes a redundant prod build.
- Visual regression baselines: `linux-x64` (used by CI, regenerated only via the manual `update-visual-baselines.yml` workflow) and `darwin-arm64` (local dev sanity check, never compared in CI) — never compare screenshots across architectures.
- For any task that changes rendered UI, use Playwright against the dev server (`http://localhost:8888`) to verify visually — don't rely on code inspection alone.
