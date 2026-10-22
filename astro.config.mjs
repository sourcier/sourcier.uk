// @ts-check
import { defineConfig } from "astro/config";
import emoji from "remark-emoji";
import expressiveCode from "astro-expressive-code";
import { pluginLineNumbers } from "@expressive-code/plugin-line-numbers";
import { pluginColorChips } from "expressive-code-color-chips";
import { remarkMermaid } from "./src/plugins/remark-mermaid.js";
import { rehypeZoomableImages } from "./src/plugins/rehype-zoomable-images.js";
import { rehypeWrapTables } from "./src/plugins/rehype-wrap-tables.js";
import { expressiveCodeCopyIcon } from "./src/utils/expressive-code-copy-icon.js";
import { pluginCollapsibleCodeBlocks } from "./src/plugins/expressive-code-collapsible.js";

export default defineConfig({
  site: "https://sourcier.uk",
  server: { host: true },
  vite: {
    build: {
      // Latest stable major + two previous releases, reviewed 2026-10-23; see README.
      cssTarget: ["chrome154", "edge154", "firefox156", "safari18", "ios18"],
      cssMinify: "lightningcss",
    },
  },
  integrations: [
    expressiveCode({
      themes: ["one-light", "one-dark-pro"],
      plugins: [
        pluginLineNumbers(),
        pluginCollapsibleCodeBlocks(),
        pluginColorChips(),
      ],
      defaultProps: {
        showLineNumbers: true,
        wrap: true,
        overridesByLang: {
          "bash,sh,zsh": { preserveIndent: false },
        },
      },
      styleOverrides: {
        borderRadius: "6px",
        borderColor: "var(--color-border)",
        borderWidth: "1px",
        codePaddingInline: "1.5rem",
        frames: {
          copyIcon: expressiveCodeCopyIcon,
          frameBoxShadowCssValue: "none",
          inlineButtonBackground: "#e8006a",
          inlineButtonBackgroundHoverOrFocusOpacity: "0.15",
        },
      },
      useDarkModeMediaQuery: false,
      themeCssSelector: (theme) =>
        theme.type === "dark"
          ? '[data-theme="dark"]'
          : ':root:not([data-theme="dark"])',
    }),
  ],
  markdown: {
    remarkPlugins: [
      remarkMermaid,
      [emoji, { emoticon: true, accessible: true }],
    ],
    rehypePlugins: [rehypeZoomableImages, rehypeWrapTables],
    syntaxHighlight: false,
  },
});
