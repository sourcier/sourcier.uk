# Contributing

Development and contribution guidelines for [sourcier.uk](https://sourcier.uk),
a personally maintained blog and consultancy site.

## Issues and questions

Use the [issue forms](https://github.com/sourcier/sourcier.uk/issues/new/choose)
for reproducible bugs and proposed improvements. For general project questions,
search existing issues first, then open an issue with relevant context.
Discuss substantial changes before starting implementation.

For vulnerabilities, follow the [security policy](SECURITY.md) instead of
opening a public issue.

## Pull requests

- Create a short-lived feature branch and open a PR targeting `main`.
- Keep changes focused and explain the user impact.
- Follow existing code patterns and the relevant
  [project instructions](.github/instructions/astro.instructions.md).
- Add or update tests when changing behaviour.
- Describe checks performed and any limitations in the PR.
- Update the changelog for notable user-facing changes, or explain why no entry
  is needed.

Use Conventional Commits for commit subjects, followed by a blank line and
bullet-point details when appropriate:

```text
fix(search): preserve the search query when navigating back

- Restore the previous query when reopening search
```

Site PRs deploy to the passcode-protected preview at
<https://preview--sourcieruk.netlify.app>. Successful merges to `main` deploy
automatically to production. There is no separate release step.

The shared preview is refreshed on every PR build and every push to `main`.
Scheduled production builds run daily at 07:45 UTC to publish future-dated posts.

## Content repository

Blog posts live in the separate
[sourcier.uk-content repository](https://github.com/sourcier/sourcier.uk-content).
Contributors with access can clone it for local development:

```sh
git clone git@github.com:sourcier/sourcier.uk-content.git collections/posts
git -C collections/posts config core.hooksPath .githooks
```

`collections/posts/` is a separate clone, not a submodule. Keep its git operations
separate from this repository. If you do not have content access, mention that
limitation in your PR rather than copying private posts into this repository.

The content repository stays on `main` unless a different branch is requested.
Its commits and pushes trigger site rebuilds without a software release.
Inspect, stage, and commit changes independently in each repository.

## Project Structure

```text
collections/posts/       # Blog posts (markdown + cover images)
src/
  components/            # Astro components
  layouts/               # Page layouts
  pages/                 # Routes (blog, tags, RSS, etc.)
  plugins/               # Remark plugins (Mermaid)
  styles/                # Ordered native CSS entrypoint and purpose-focused stylesheets
  utils/                 # Utilities (drafts, tags, icons)
netlify/functions/       # Serverless functions (comments, subscriptions, scheduled builds)
scripts/                 # One-off utility scripts (email templates, notifications)
```

### Styling

`src/styles/global.css` is the ordered global stylesheet entrypoint. Its
imports are `theme.css`, `base.css`, `navigation.css`, `home-hero.css`,
`controls.css`, `panels.css`, `series.css`, `post-markers.css`,
`blog-cards.css`, `social-icons.css`, `contact.css`, `article.css`, and
`search.css`. `BaseLayout.astro` imports `reset.css` before that entrypoint.
Shared design tokens, including light and dark theme values, live in
`theme.css`; use these CSS variables instead of duplicating theme values. Keep
component-specific rules in plain scoped `<style>` blocks in Astro components.
The site has no Bulma dependency and does not require Sass.

Prefer single-word class names when their scope makes the meaning clear.
Shared utilities include `.button`, `.actions`, `.field`, `.label`,
`.input`, `.container`, `.section`, and `.panel`. Component parts use short
names such as `.heading`, `.body`, and `.icon`, scoped to their owning
component. Keep descriptive compound roots when they distinguish components.
Do not reuse a global utility name for an unrelated local part.

Use native or ARIA attributes for interactive state, and data attributes for
presentation variants, such as `data-width="narrow"` on `.container` and
`data-tone="secondary"` on `.panel`. Keep accessibility utilities,
vendor-owned classes, and authored-content contracts such as `date-chip`,
`update-divider`, and `series-callout` unchanged.

### Browser compatibility

The targeted browser window is the latest stable major release plus the two
previous released majors of Chrome, Edge, Firefox, Safari, and iOS Safari.
Count actual releases, not consecutive version numbers: Safari jumped from
18 to 26. This is a compatibility target, not a claim of verified support.

The explicit CSS minimums in `astro.config.mjs` were reviewed on **23 October
2026**:

| Browser    | Latest stable major | Targeted majors | CSS minimum |
| ---------- | ------------------- | --------------- | ----------- |
| Chrome     | 156                 | 154, 155, 156   | 154         |
| Edge       | 156                 | 154, 155, 156   | 154         |
| Firefox    | 158                 | 156, 157, 158   | 156         |
| Safari     | 27                  | 18, 26, 27      | 18          |
| iOS Safari | 27                  | 18, 26, 27      | 18          |

Review the window monthly and when updating Astro/Vite. Check stable releases
against the [Chrome release dashboard](https://chromestatus.com/roadmap),
[Edge release notes](https://learn.microsoft.com/en-us/deployedge/microsoft-edge-relnote-stable-channel),
[Firefox release notes](https://www.firefox.com/en-US/firefox/notes/), and
[Safari release notes](https://developer.apple.com/documentation/safari-release-notes).
Update `vite.build.cssTarget`, this table, and the review date together, then
rebuild and inspect emitted CSS. Targets are pinned for reproducible builds;
they do not advance automatically.

Production CSS is explicitly minified by Lightning CSS using these targets,
which controls compatibility transforms and generated vendor prefixes.
Write standard mask and text-size-adjust declarations rather than duplicating
their prefixed forms. There is no Autoprefixer or Browserslist dependency;
Sass never provided automatic prefixing. The targets apply to production CSS,
not JavaScript, and do not guarantee identical processing in the dev server.
Check production output as well as the development UI.

Necessary handwritten vendor rules remain, with comments at their use sites:
the legacy line-clamp trio for consistent multiline truncation, macOS font
smoothing, the outlined 404 numeral's text stroke, and the search input's
native clear-button selector. These cannot all be replaced by interoperable
standard declarations or generated by a prefixer. Third-party styles may retain
their own prefixes.

Native nesting, `:has()`, `color-mix()`, balanced text wrapping, and unprefixed
backdrop filters fit this window. `text-wrap: pretty` is progressive enhancement:
browsers without it use ordinary wrapping. Prefixes cannot polyfill unsupported
features. Automated browser checks cover bundled Chromium only, not the
historical minimum versions, Firefox, or Safari; matching build targets is not
a substitute for cross-browser testing.

### Article series

Posts can be grouped inside a series folder without changing their URLs:

```text
collections/posts/
  how-this-blog-was-built/
    index.md                    # Series overview
    how-this-blog-was-built-cover.webp
    choosing-the-tech-stack/
      index.md
      choosing-the-tech-stack-cover.webp
```

The directory containing `index.md` supplies the post ID, regardless of nesting.
Post directory names must be globally unique lowercase, hyphenated slugs.
Duplicate IDs fail discovery rather than replacing content. Only `index.md`
files are articles; README files, hidden directories, and dependencies are excluded.

Add `series: how-this-blog-was-built` and `seriesOrder: 0` to the overview.
Use the same `series` ID and distinct positive `seriesOrder` values for articles.
Reading order is independent of publication dates. Each series requires an overview
whose post ID matches `series`; incomplete metadata and duplicate orders fail the build.

Article pages show an overview link and previous/next links above the article body,
replacing hand-written series kicker banners. Production navigation
excludes drafts and scheduled posts; preview navigation includes them with explicit
status labels. The first visible article links back to the overview as its previous
entry. A hidden overview suppresses navigation for its series.

Cover downloads, thumbnails, SVG exports, notifications, and Dev.to cross-posting
discover nested posts by their unchanged IDs. Public asset URLs stay flat:
`/search-thumbnails/<post-id>/` and `/post-images/<post-id>/`.
For a new nested post, use `pnpm cover:download <series>/<post-id> <photo-url-or-id>`.
For an existing post, its ID alone locates its current directory.

## Getting Started

### Prerequisites

- Node.js (see [.nvmrc](.nvmrc) for version)
- [pnpm](https://pnpm.io/) 12.11.1
- [Netlify CLI](https://docs.netlify.com/cli/get-started/), included in the
  project's development dependencies

### Install pnpm

With pnpm available, install and enable Corepack to use the version pinned in
`package.json`:

```sh
pnpm add -g corepack@0.34.5
corepack enable pnpm
pnpm --version            # Should print 12.11.1
```

### Setup

Clone the [content repository](#content-repository) if you have access, then
install dependencies and configure your local environment:

```sh
pnpm install
cp .env.example .env     # Fill in your environment variables
```

Never commit `.env` files, credentials, or private content.

### Development

```sh
pnpm dev                 # Start dev server with draft posts visible
pnpm dev:no-drafts       # Start dev server without drafts
```

### Build

```sh
pnpm build               # Build for production
pnpm preview             # Preview the production build locally
```

### Code Quality

```sh
pnpm lint                # Run ESLint across Astro, JS, and TS files
pnpm lint:fix            # Auto-fix lint issues where possible
pnpm typecheck:functions # Type-check Netlify functions
pnpm test                # Run unit tests
pnpm format              # Verify formatting without writing changes
pnpm format:fix          # Format the project with Prettier
```

`pnpm install` runs the `prepare` script to install Husky hooks. Pre-commit
then runs `lint-staged`, so staged code is linted and formatted before each
commit.

CI runs formatting, linting, function type checks, and unit tests, followed by
preview and production build checks as applicable. Run the checks relevant to
your work. Documentation-only changes need formatting and link checks rather
than a local application build.

### Responsive and Visual Tests

For rendered UI changes, inspect the development site at
<http://localhost:8888> with Playwright before and after editing. Check desktop
and narrow-screen layouts, including light and dark themes where relevant.

All profiles use Playwright's bundled Chromium with a device scale factor of 1.
Mobile and tablet profiles enable mobile emulation and touch; desktop profiles
use mouse input.

| Project     | Viewport   |
| ----------- | ---------- |
| `mobile-s`  | 320 × 900  |
| `mobile-m`  | 375 × 900  |
| `mobile-l`  | 425 × 900  |
| `tablet`    | 768 × 1024 |
| `desktop-s` | 1024 × 900 |
| `desktop-m` | 1280 × 900 |
| `desktop-l` | 1440 × 900 |

`pnpm test:visual` runs 12 screenshot routes across these seven profiles, plus
the screenshot-free `responsive` project. That project checks layout transitions
around 640, 768/769, 960, 1024, 1100, 1216, 1280 and 1408 CSS pixels; touch
navigation, search, course signup and support amount selection; and desktop
reflow at 320 CSS pixels. Signup requests are mocked and no payments are made.
Support checks are explicitly skipped when the build has no Stripe publishable key.
These checks support, but do not establish, WCAG reflow conformance.

Run focused checks with `pnpm exec playwright test --project=responsive`.
Screenshot tests serve the existing `dist/` build on port 9000, so run
`pnpm build` after changing site code or content. Manual visual QA uses the
development server at `http://localhost:8888`.

Local baselines live under `darwin-arm64`; regenerate them with
`pnpm test:visual:update`. CI uses only `linux-x64` baselines, generated by the
manual **Update Visual Baselines** GitHub Actions workflow. Never copy baselines
between platforms. Project renames and viewport changes require reviewed new
baselines.

## Environment Variables

See [.env.example](.env.example) for the full list. Variables fall into two categories:

### Build-time (GitHub Actions secrets)

These are baked into the HTML by `astro build`. In CI they are passed via GitHub Actions secrets (GitHub → Settings → Secrets and variables → Actions). In local dev, set them in `.env`.

| Variable                        | Purpose                                                             |
| :------------------------------ | :------------------------------------------------------------------ |
| `PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key — controls whether the tip button renders    |
| `PUBLIC_POSTHOG_KEY`            | PostHog project API key                                             |
| `PUBLIC_POSTHOG_HOST`           | PostHog ingest host, e.g. `https://eu.i.posthog.com`                |
| `GH_PAT`                        | Fine-grained token to clone the private content repo at build time  |
| `SHOW_DRAFTS`                   | Set to `"true"` to include draft posts (CI sets this automatically) |

### Runtime (Netlify environment variables)

These are read by Netlify functions at request time and never embedded in the HTML. Set them in the Netlify dashboard (Site configuration → Environment variables).

| Variable            | Purpose                                                                                                                  |
| :------------------ | :----------------------------------------------------------------------------------------------------------------------- |
| `NETLIFY_PAT`       | Netlify personal access token — **do not** use `NETLIFY_ACCESS_TOKEN` (reserved by Netlify, auto-overwritten at runtime) |
| `APPROVAL_SECRET`   | HMAC signing for comment moderation links                                                                                |
| `RESEND_API_KEY`    | Email sending via Resend                                                                                                 |
| `NOTIFY_EMAIL`      | Admin notification recipient                                                                                             |
| `SITE_URL`          | Public site URL                                                                                                          |
| `STRIPE_SECRET_KEY` | Stripe secret key for the checkout function                                                                              |
| `PREVIEW_PASSCODE`  | Passcode for the `preview` alias deploy                                                                                  |

## Dev Container

The repo ships with a `.devcontainer` configuration for use with [VS Code Dev Containers](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) or [GitHub Codespaces](https://github.com/features/codespaces). Running inside the container sandboxes the environment — your host filesystem, SSH keys, and credentials are not accessible unless explicitly mounted.

### What's included

- Node.js 24 (`lts/krypton`)
- pnpm 12.11.1 (via corepack)
- Netlify CLI
- Playwright (Chromium + system dependencies)
- GitHub Copilot (VS Code extensions pre-installed)
- VS Code extensions: Astro, ESLint, Prettier, Playwright

### Required secret

Create a **fine-grained GitHub PAT** at [github.com/settings/tokens](https://github.com/settings/personal-access-tokens/new) with:

- **Repository access:** `sourcier/sourcier.uk-content` (read-only Contents)
- **Account permissions:** Copilot Requests (read-only)

Add it as a secret named `GH_PAT` in:

- **Codespaces:** [github.com/settings/codespaces](https://github.com/settings/codespaces)
- **Dev Containers (local):** VS Code user secrets via the Dev Containers extension

### Opening in a container

**VS Code:** `Cmd+Shift+P` → **Dev Containers: Reopen in Container**

**Codespaces:** Click **Code → Codespaces → Create codespace** on GitHub

> If you update the `GH_PAT` secret, use **Dev Containers: Rebuild Container** (not Restart) to inject the new value.

### Faster builds with BuildKit

The Dev Containers extension uses BuildKit for faster, layer-cached image builds if `docker buildx` is available.

**Docker Desktop** includes `buildx` out of the box — no extra steps needed.

**Podman Desktop** doesn't bundle it by default. Install it manually:

```sh
brew install docker-buildx
mkdir -p ~/.docker/cli-plugins
ln -sf $(brew --prefix)/opt/docker-buildx/bin/docker-buildx ~/.docker/cli-plugins/docker-buildx
```

This is optional — builds work without it.

### Using GitHub Copilot

The `GitHub.copilot` and `GitHub.copilot-chat` extensions are pre-installed. Copilot authenticates automatically via the `GH_PAT` secret — no separate sign-in required.

Open the Copilot Chat panel with `Ctrl+Shift+I` (or `Cmd+Shift+I` on Mac) and use agent mode (`@workspace`) for codebase-aware assistance.

### Connecting from your host terminal

The container is a standard Docker container. You can attach a shell directly from your Mac without opening VS Code:

```sh
# Find the container name
docker ps --format "table {{.Names}}\t{{.Image}}" | grep sourcier

# Open a shell at the workspace root
docker exec -it <container-name> zsh -c "cd /workspaces/sourcier.uk && zsh"
```

Add this alias to your host `.aliases` for quick access:

```zsh
alias sourcier='docker exec -it $(docker ps --filter name=sourcier --format "{{.Names}}" | head -1) zsh -c "cd /workspaces/sourcier.uk && zsh"'
```

### Dotfiles in the workspace (local only)

The workspace file (`sourcier.code-workspace`) includes a dotfiles folder entry pointing to `/workspaces/dotfiles`. The dotfiles repo (`~/workspace/dotfiles` on the host) is bind-mounted into the container at that path so the folder appears and is editable in VS Code inside the container.

VS Code will show the warning **"workspace contains an absolute folder path"** when opening in a container. This is expected and harmless — the mount ensures the path exists inside the container at the same absolute location. In Codespaces, `initializeCommand` creates an empty stub at that path so the mount does not cause a startup failure.

## Changelog

[CHANGELOG.md](CHANGELOG.md) records notable changes to the site, not every commit.
Include features, significant design changes, user-facing fixes, deprecations,
removals, and disclosed security improvements.

Exclude routine blog posts, internal refactoring, documentation-only changes,
and dependency updates without user impact. Do not publish vulnerability
details before coordinated disclosure.

Use the deployment date as a `## YYYY-MM-DD` heading, newest first. Group
same-day changes under that date and use only applicable category headings:
`Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, and `Security`.
Write concise bullets explaining what changed for users.

```markdown
## 2026-10-23

### Added

- Search results now show article thumbnails.

### Fixed

- Mobile navigation remains usable when zoomed.
```

The example is illustrative, not a record of shipped changes. In a PR, use the
expected deployment date and confirm it before merging. If deployment fails or
is delayed, correct the date after the actual deployment and ensure unshipped
changes are not left presented as deployed. The maintainer is responsible for
this reconciliation.

No version bump, git tag, or GitHub release is required.
