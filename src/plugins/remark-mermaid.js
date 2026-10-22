// Converts ```mermaid blocks to a pre-built container with loading skeleton at build time.
// The skeleton is visible the instant the HTML arrives, before any JS runs.
// The client-side script finds these containers via [data-mermaid] and renders them.
const SKELETON =
  `<div class="skeleton" aria-hidden="true">` +
  `<div class="row">` +
  `<div class="node" data-kind="wide"></div>` +
  `</div>` +
  `<div class="connector"></div>` +
  `<div class="row">` +
  `<div class="node"></div>` +
  `<div class="node"></div>` +
  `</div>` +
  `<div class="connector"></div>` +
  `<div class="row">` +
  `<div class="node" data-kind="narrow"></div>` +
  `<div class="node" data-kind="narrow"></div>` +
  `<div class="node" data-kind="narrow"></div>` +
  `</div>` +
  `</div>`;

function escapeAttr(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function remarkMermaid() {
  return (tree) => {
    function walk(node, parent, index) {
      if (node.type === "code" && node.lang === "mermaid" && parent) {
        const titleMatch = node.meta?.match(/title="([^"]+)"/);
        const title = titleMatch?.[1] ?? null;
        parent.children[index] = {
          type: "html",
          value:
            `<div class="mermaid-diagram" data-loading data-mermaid="${escapeAttr(node.value)}"` +
            (title ? ` data-title="${escapeAttr(title)}"` : "") +
            `>${SKELETON}</div>`,
        };
        return;
      }
      if (node.children) {
        node.children.forEach((child, i) => walk(child, node, i));
      }
    }
    walk(tree, null, null);
  };
}
