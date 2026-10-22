import { faChevronDown } from "@fortawesome/free-solid-svg-icons";

// WeakSet is sufficient here — we only need a boolean flag per block instance.
const collapsibleBlocks = new WeakSet();

function findElement(node, tagName, className) {
  if (node?.type !== "element") return null;
  if (node.tagName === tagName) {
    const classes = node.properties?.className ?? [];
    if (!className || classes.includes(className)) return node;
  }
  for (const child of node.children ?? []) {
    const found = findElement(child, tagName, className);
    if (found) return found;
  }
  return null;
}

function buildChevronHast() {
  const [width, height, , , pathData] = faChevronDown.icon;
  const paths = Array.isArray(pathData) ? pathData : [pathData];
  return {
    type: "element",
    tagName: "svg",
    properties: {
      xmlns: "http://www.w3.org/2000/svg",
      viewBox: `0 0 ${width} ${height}`,
      ariaHidden: "true",
      className: ["ec-collapse-icon"],
    },
    children: paths.map((d) => ({
      type: "element",
      tagName: "path",
      properties: { fill: "currentColor", d },
      children: [],
    })),
  };
}

export function pluginCollapsibleCodeBlocks() {
  return {
    name: "CollapsibleCodeBlocks",
    hooks: {
      preprocessMetadata: ({ codeBlock }) => {
        if (/\bcollapsible\b/.test(codeBlock.meta)) {
          collapsibleBlocks.add(codeBlock);
          codeBlock.meta = codeBlock.meta.replace(/\bcollapsible\b/, "").trim();
        }
      },
      postprocessRenderedBlock: ({ codeBlock, renderData }) => {
        if (!collapsibleBlocks.has(codeBlock)) return;

        const { blockAst } = renderData;

        // Mark the figure so CSS and JS can target it
        blockAst.properties = blockAst.properties ?? {};
        const existing = blockAst.properties.className ?? [];
        blockAst.properties.className = Array.isArray(existing)
          ? [...existing, "ec-collapsible"]
          : ["ec-collapsible"];

        // Inject the toggle button as the last child of the frame header
        const header = findElement(blockAst, "figcaption", "header");
        if (!header) return;

        header.children.push({
          type: "element",
          tagName: "button",
          properties: {
            type: "button",
            className: ["ec-collapse-toggle"],
            ariaLabel: "Toggle code block",
            ariaExpanded: "false",
          },
          children: [buildChevronHast()],
        });
      },
    },
    baseStyles: `
      .ec-collapsible {
        .header {
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .ec-collapse-toggle {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-left: auto;
          padding: 0 0.5rem;
          min-width: 1.75rem;
          height: 1.75rem;
          border: 0;
          background: transparent;
          cursor: pointer;
          color: inherit;
          opacity: 0.7;
          transition: opacity 0.15s ease;
          flex-shrink: 0;

          &:hover {
            opacity: 1;
          }

          .ec-collapse-icon {
            width: 0.875rem;
            height: 0.875rem;
            transition: transform 0.2s ease;
            flex-shrink: 0;
          }

        }

        &:has([aria-expanded="false"]) {
          border-left: 3px solid var(--accent-primary, #e8006a);

          .ec-collapse-toggle .ec-collapse-icon {
            transform: rotate(-90deg);
          }

          pre,
          .copy {
            display: none;
          }
        }
      }
    `,
    jsModules: [
      `
        for (const block of document.querySelectorAll('.ec-collapsible')) {
          const header = block.querySelector('figcaption.header');
          const btn = block.querySelector('.ec-collapse-toggle');

          if (!header || !btn) continue;

          const toggle = () => {
            const isNowExpanded = btn.getAttribute('aria-expanded') !== 'true';
            btn.setAttribute('aria-expanded', String(isNowExpanded));
          };

          // Header click covers the whole bar; skip if a button was clicked
          // (each button handles its own click separately)
          header.addEventListener('click', (e) => {
            if (e.target.closest('button')) return;
            toggle();
          });

          btn.addEventListener('click', toggle);
        }
      `,
    ],
  };
}
