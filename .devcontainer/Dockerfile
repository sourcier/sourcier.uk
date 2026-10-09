FROM mcr.microsoft.com/devcontainers/javascript-node:24

ARG DOTFILES_REPO=https://github.com/sourcier/dotfiles.git
ARG DOTFILES_REF=main

# Copy package.json so we can read the Playwright version dynamically
COPY package.json /tmp/package.json

# Install Playwright system dependencies and rsync (used by bootstrap.sh).
# Version is read from package.json so it stays in sync automatically when @playwright/test is upgraded
RUN apt-get update && apt-get install -y --no-install-recommends rsync chromium \
 && PW_VERSION=$(node -e "console.log(require('/tmp/package.json').devDependencies['@playwright/test'].replace(/[\\^~]/, ''))") \
 && npx -y "playwright@${PW_VERSION}" install-deps chromium \
 && rm -rf /var/lib/apt/lists/* /tmp/package.json

# Set zsh as the default shell for the node user
RUN chsh -s /bin/zsh node

# Symlink /Users/node → /home/node so macOS-style absolute paths in dotfiles
# (e.g. /Users/node/.oh-my-zsh) resolve correctly inside the Linux container.
RUN mkdir -p /Users && ln -s /home/node /Users/node

# Install Oh My Zsh plugins and Powerlevel10k theme into the image.
# These are subsequently overlaid by the dotfiles bootstrap below, which rsyncs
# the repo's .oh-my-zsh/custom into place. They're cloned here first so they
# exist as a fallback and to avoid re-downloading on every bootstrap run.
RUN git clone --depth=1 https://github.com/zsh-users/zsh-autosuggestions /home/node/.oh-my-zsh/custom/plugins/zsh-autosuggestions \
 && git clone --depth=1 https://github.com/zsh-users/zsh-syntax-highlighting /home/node/.oh-my-zsh/custom/plugins/zsh-syntax-highlighting \
 && git clone --depth=1 https://github.com/romkatv/powerlevel10k /home/node/.oh-my-zsh/custom/themes/powerlevel10k \
 && chown -R node:node /home/node/.oh-my-zsh/custom

# Enable corepack and install pnpm (placed after git clones so a pnpm-only bump
# doesn't invalidate the clone cache layers above)
RUN corepack enable && corepack prepare pnpm@12.11.1 --activate

# Configure pnpm store outside the workspace so Vite doesn't watch it.
# Without this, the store inside the project burns through all inotify
# watchers and Vite crashes with ENOSPC.
USER node
RUN pnpm config set store-dir /home/node/.pnpm-store --global

# Clone the dotfiles repo and run bootstrap.sh to rsync all dotfiles into $HOME.
# SKIP_VERIFY=1 skips the verify_shell_startup step (runs zsh -lic which is slow
# and pointless in a headless Docker build context).
# The git config override fixes the macOS-absolute excludesFile path baked into .gitconfig.
RUN TMP=$(mktemp -d) \
 && git clone --depth=1 --branch "${DOTFILES_REF}" "${DOTFILES_REPO}" "${TMP}" \
 && cd "${TMP}" && SKIP_VERIFY=1 ./bootstrap.sh \
 && git config --global core.excludesFile ~/.gitignore \
 && rm -rf "${TMP}"

# Pre-create the Playwright, Deno, and pnpm-store directories as the node user
# so the named Docker volumes are initialised with the right ownership. Without
# this the volumes are created root-owned and onCreateCommand fails with EACCES.
RUN mkdir -p /home/node/.cache/ms-playwright /home/node/.deno/bin /home/node/.pnpm-store
USER root
