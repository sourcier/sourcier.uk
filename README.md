# sourcier.uk

[![Netlify Status](https://api.netlify.com/api/v1/badges/11a14542-cc35-4fdf-94e4-a61350e0652b/deploy-status)](https://app.netlify.com/projects/sourcieruk/deploys)

Personal tech blog and engineering consultancy website built with [Astro](https://astro.build/) and hosted on [Netlify](https://www.netlify.com/).

Live at **[sourcier.uk](https://sourcier.uk)**

## Tech Stack

- **Framework:** Astro 6
- **Styling:** Sass + Bulma
- **Content:** Markdown with frontmatter (Astro Content Collections)
- **Hosting:** Netlify (static site + serverless functions)
- **Email:** Resend (comment notifications & newsletter)
- **Analytics:** PostHog
- **Extras:** Mermaid diagrams, Expressive Code syntax highlighting, RSS feed

## Project Structure

```
collections/posts/       # Blog posts (markdown + cover images)
src/
  components/            # Astro components
  layouts/               # Page layouts
  pages/                 # Routes (blog, tags, RSS, etc.)
  plugins/               # Remark plugins (Mermaid)
  styles/                # Global Sass styles
  utils/                 # Utilities (drafts, tags, icons)
netlify/functions/       # Serverless functions (comments, subscriptions, scheduled builds)
scripts/                 # One-off utility scripts (email templates, notifications)
```

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
- [pnpm](https://pnpm.io/)
- [Netlify CLI](https://docs.netlify.com/cli/get-started/) (`npm i -g netlify-cli`)

### Setup

```sh
pnpm install
cp .env.example .env     # Fill in your environment variables
```

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
pnpm format              # Verify formatting without writing changes
pnpm format:fix          # Format the project with Prettier
```

`pnpm install` runs the `prepare` script to install Husky hooks. Pre-commit
then runs `lint-staged`, so staged code is linted and formatted before each
commit.

## Features

- **Blog** with draft support, future-dated post scheduling, and tag filtering
- **Comment system** using Netlify Forms with email-based moderation (approve/delete)
- **Newsletter** subscriptions via Resend with welcome email templates
- **Scheduled builds** (daily at 07:45 UTC) to auto-publish future-dated posts
- **Draft previews** via the stable `preview` alias deploy on Netlify — access at
  `https://preview--sourcieruk.netlify.app` (passcode-protected via edge function).
  Refreshed on every PR build (to verify changes before merging) and on every
  push to `main`
- **RSS feed** at `/rss.xml`

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
- pnpm 10.33.2 (via corepack)
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

#### Faster builds with BuildKit

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

## License

[MIT](LICENSE)
