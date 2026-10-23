# sourcier.uk

[![Netlify Status](https://api.netlify.com/api/v1/badges/11a14542-cc35-4fdf-94e4-a61350e0652b/deploy-status)](https://app.netlify.com/projects/sourcieruk/deploys)

Personal tech blog and engineering consultancy website built with [Astro](https://astro.build/) and hosted on [Netlify](https://www.netlify.com/).

Live at **[sourcier.uk](https://sourcier.uk)**

## Features

- **Blog** with draft support, future-dated post scheduling, and tag filtering
- **Comment system** using Netlify Forms with email-based moderation
- **Newsletter** subscriptions via Resend with welcome email templates
- **Scheduled builds** to publish future-dated posts
- **Draft previews** via a passcode-protected Netlify preview deployment
- **RSS feed** at [sourcier.uk/rss.xml](https://sourcier.uk/rss.xml)

## Tech Stack

- **Framework:** Astro
- **Styling:** Native CSS, with purpose-focused global stylesheets and scoped
  component styles
- **Content:** Markdown with frontmatter, using Astro Content Collections
- **Hosting:** Netlify, with static pages and serverless functions
- **Email:** Resend
- **Analytics:** PostHog
- **Extras:** Mermaid diagrams, Expressive Code syntax highlighting, RSS feed

## Documentation

- [Contributing](CONTRIBUTING.md): development setup, architecture, workflows,
  testing, environment configuration, and reporting bugs.
- [Changelog](CHANGELOG.md): notable site changes grouped by deployment date.
- [Security policy](SECURITY.md): report vulnerabilities privately.

## License

[MIT](LICENSE)
