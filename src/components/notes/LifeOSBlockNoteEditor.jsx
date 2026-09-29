import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import React from "react";
import {
  BlockNoteSchema,
  defaultBlockSpecs,
  defaultInlineContentSpecs,
} from "@blocknote/core";
import { filterSuggestionItems } from "@blocknote/core/extensions";
import {
  useCreateBlockNote,
  createReactBlockSpec,
  createReactInlineContentSpec,
  getDefaultReactSlashMenuItems,
  SuggestionMenuController,
} from "@blocknote/react";
import { BlockNoteView } from "@blocknote/ariakit";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/core/style.css";
import "@blocknote/ariakit/style.css";
import katex from "katex";
import "katex/dist/katex.min.css";
import { Sigma } from "lucide-react";
import "./LifeOSBlockNoteEditor.css";

const LifeOSEquation = createReactBlockSpec(
  {
    type: "lifeosEquation",
    propSchema: {
      latex: { default: "E = mc^2" },
    },
    content: "none",
  },
  {
    render: (props) => {
      const latex = props.block.props.latex || "";

      let rendered = "";
      let error = "";
      try {
        rendered = latex
          ? katex.renderToString(latex, { throwOnError: false, displayMode: true, trust: false })
          : "";
      } catch (e) {
        error = e?.message || "Invalid equation";
      }

      // Use local state inside the render function for edit/preview toggle.
      // BlockNote re-creates this component, so we track editing via a
      // data attribute on the container element.
      const [isEditing, setIsEditing] = React.useState(false);
      const [draft, setDraft] = React.useState(latex);

      // Keep draft in sync when block prop changes externally
      React.useEffect(() => { setDraft(latex); }, [latex]);

      // Recompute rendered for draft
      let draftRendered = "";
      try {
        draftRendered = draft
          ? katex.renderToString(draft, { throwOnError: false, displayMode: true, trust: false })
          : "";
      } catch {
        draftRendered = "";
      }

      const commitEdit = () => {
        const trimmed = draft.trim();
        if (trimmed !== latex) {
          props.editor.updateBlock(props.block, {
            type: "lifeosEquation",
            props: { latex: trimmed || "E = mc^2" },
          });
        }
        setIsEditing(false);
      };

      if (isEditing) {
        return (
          <div className="lifeos-equation lifeos-equation-editing" contentEditable={false}>
            <div className="lifeos-equation-toolbar">
              <span><Sigma size={15} /> Equation</span>
              <code>LaTeX</code>
            </div>
            <textarea
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if ((e.key === "Enter" && (e.ctrlKey || e.metaKey)) || e.key === "Escape") {
                  e.preventDefault();
                  commitEdit();
                }
              }}
              onBlur={commitEdit}
              spellCheck={false}
              rows={2}
              placeholder="E = mc^2"
              className="lifeos-equation-input"
            />
            {draftRendered && (
              <div className="lifeos-equation-preview" dangerouslySetInnerHTML={{ __html: draftRendered }} />
            )}
          </div>
        );
      }

      return (
        <div
          className="lifeos-equation lifeos-equation-preview-only"
          contentEditable={false}
          onClick={() => { setDraft(latex); setIsEditing(true); }}
          title="Click to edit equation"
        >
          {rendered ? (
            <div className="lifeos-equation-rendered" dangerouslySetInnerHTML={{ __html: rendered }} />
          ) : (
            <span className="lifeos-equation-placeholder">Click to enter LaTeX equation…</span>
          )}
          {error && <div className="lifeos-equation-error">{error}</div>}
        </div>
      );
    },
  },
);

const LifeOSLatex = createReactInlineContentSpec(
  {
    type: "lifeosLatex",
    propSchema: {
      latex: { default: "" },
      display: { default: false },
    },
    content: "none",
  },
  {
    parse: (element) => {
      if (!(element instanceof HTMLElement)) return undefined;
      const latex = element.getAttribute("data-lifeos-latex") || element.dataset?.lifeosLatex || "";
      if (!latex) return undefined;
      return {
        latex,
        display: element.getAttribute("data-lifeos-display") === "true" || element.dataset?.lifeosDisplay === "true",
      };
    },
    render: ({ inlineContent, contentRef }) => {
      const latex = inlineContent.props.latex || "";
      const display = !!inlineContent.props.display;
      let rendered = "";
      try {
        rendered = latex
          ? katex.renderToString(latex, { throwOnError: false, displayMode: display, trust: false })
          : "";
      } catch {
        rendered = "";
      }

      return (
        <span
          ref={contentRef}
          className={display ? "lifeos-inline-math lifeos-inline-math-display" : "lifeos-inline-math"}
          data-lifeos-latex={latex}
          data-lifeos-display={display ? "true" : "false"}
          dangerouslySetInnerHTML={{ __html: rendered }}
        />
      );
    },
    toExternalHTML: ({ inlineContent }) => {
      const latex = inlineContent.props.latex || "";
      const display = !!inlineContent.props.display;
      let rendered = "";
      try {
        rendered = latex
          ? katex.renderToString(latex, { throwOnError: false, displayMode: display, trust: false })
          : "";
      } catch {
        rendered = "";
      }

      return (
        <span
          className={display ? "lifeos-inline-math lifeos-inline-math-display" : "lifeos-inline-math"}
          data-lifeos-latex={latex}
          data-lifeos-display={display ? "true" : "false"}
          dangerouslySetInnerHTML={{ __html: rendered }}
        />
      );
    },
  },
);

const schema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    lifeosEquation: LifeOSEquation(),
  },
  inlineContentSpecs: {
    ...defaultInlineContentSpecs,
    lifeosLatex: LifeOSLatex,
  },
});

function stripHtml(html) {
  if (!html) return "";
  return String(html).replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").trim();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isHtmlLike(value) {
  return /<\/?[a-z][\s\S]*>/i.test(String(value || ""));
}

function extractStandaloneLatex(raw) {
  // raw can be a BlockNote inline content array, a string, or HTML
  let text = "";
  if (Array.isArray(raw)) {
    // BlockNote inline content array — extract plain text from all text nodes
    text = raw.map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object") return item.text || item.content || "";
      return "";
    }).join("").trim();
  } else {
    text = stripHtml(String(raw ?? "")).trim();
  }
  if (!text) return null;
  const patterns = [
    /^\[\s*([\s\S]+?)\s*\]$/,
    /^\$\$\s*([\s\S]+?)\s*\$\$$/,
    /^\\\[\s*([\s\S]+?)\s*\\\]$/,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      const inner = m[1].trim();
      if (inner.length > 0) return inner;
    }
  }
  return null;
}

function renderLatexToString(latex, display = false) {
  const source = String(latex || "").trim();
  if (!source) return "";
  try {
    return katex.renderToString(source, { throwOnError: false, displayMode: display, trust: false });
  } catch {
    return escapeHtml(source);
  }
}

function latexTextToFragment(text, displayDocument = document) {
  const normalized = String(text || "").replace(/\\\$/g, "\u0000LIFEOS_DOLLAR\u0000");
  const regex = /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|\$(?!\$)([^$\n]+?)\$/g;
  let match;
  let lastIndex = 0;
  let changed = false;
  const fragment = displayDocument.createDocumentFragment();

  while ((match = regex.exec(normalized))) {
    const [full, displayDollar, displayBracket, inlineParen, inlineDollar] = match;
    const latex = String(displayDollar || displayBracket || inlineParen || inlineDollar || "").trim().replace(/\u0000LIFEOS_DOLLAR\u0000/g, "$");
    if (!latex) continue;
    if (match.index > lastIndex) {
      fragment.append(normalized.slice(lastIndex, match.index).replace(/\u0000LIFEOS_DOLLAR\u0000/g, "$"));
    }

    // Validate brace balance before rendering — skip malformed fragments
    let bd = 0, balOk = true;
    for (const ch of latex) {
      if (ch === "{") bd++;
      else if (ch === "}") { bd--; if (bd < 0) { balOk = false; break; } }
    }
    if (!balOk || bd !== 0) {
      // Unbalanced — append as plain text rather than show red KaTeX error
      fragment.append(normalized.slice(match.index, match.index + full.length).replace(/\u0000LIFEOS_DOLLAR\u0000/g, "$"));
      lastIndex = match.index + full.length;
      continue;
    }

    const span = displayDocument.createElement("span");
    const display = !!displayDollar || !!displayBracket;
    span.className = display ? "lifeos-inline-math lifeos-inline-math-display" : "lifeos-inline-math";
    span.setAttribute("data-lifeos-latex", latex);
    span.setAttribute("data-lifeos-display", display ? "true" : "false");
    span.innerHTML = renderLatexToString(latex, display);
    fragment.append(span);
    lastIndex = match.index + full.length;
    changed = true;
  }

  if (!changed) return null;

  if (lastIndex < normalized.length) {
    fragment.append(normalized.slice(lastIndex).replace(/\u0000LIFEOS_DOLLAR\u0000/g, "$"));
  }

  return fragment;
}

// Intelligently wrap bare LaTeX commands within a text string.
// Instead of wrapping the whole string, identifies math sub-expressions
// and wraps only them, leaving prose text intact.
function wrapBareMathInText(text) {
  if (!text) return text;
  // Already has explicit delimiters → no-op
  if (/\$|\\\[|\\\(/.test(text)) return text;
  // Must contain at least one LaTeX command
  if (!/\\[a-zA-Z]/.test(text)) return text;

  // Split on whitespace boundaries and identify math tokens vs prose tokens.
  // A "math segment" is a contiguous run of tokens that contain LaTeX.
  // Strategy: scan for \command patterns and expand outward to grab the
  // full math expression (including braces, ^, _, operators).
  //
  // We use a simple state machine: once we see a \command, we enter "math mode"
  // and keep accumulating until we hit a long prose word or sentence boundary.

  let result = "";
  let i = 0;
  const len = text.length;

  while (i < len) {
    // Look for the next \command
    const cmdIdx = text.indexOf("\\", i);
    if (cmdIdx === -1) {
      // No more LaTeX — append the rest as prose
      result += text.slice(i);
      break;
    }

    // Check it's actually a \command (letter follows backslash)
    if (!/[a-zA-Z]/.test(text[cmdIdx + 1] || "")) {
      // Not a command (e.g. "\\") — include and move on
      result += text.slice(i, cmdIdx + 1);
      i = cmdIdx + 1;
      continue;
    }

    // Append prose before this command
    result += text.slice(i, cmdIdx);

    // Find the end of the math expression starting at cmdIdx.
    // Walk forward collecting balanced braces + typical math chars.
    let j = cmdIdx;
    let depth = 0;
    let lastMathChar = cmdIdx;

    while (j < len) {
      const ch = text[j];
      if (ch === "{") { depth++; lastMathChar = j; j++; continue; }
      if (ch === "}") {
        if (depth > 0) depth--;
        lastMathChar = j;
        j++;
        // Don't stop immediately — more content may follow
        if (depth === 0) {
          // Peek ahead: if next non-space char is math-related, keep going
          let peek = j;
          while (peek < len && text[peek] === " ") peek++;
          const nextCh = text[peek] || "";
          if (/[_^\\({]/.test(nextCh)) continue;
          // Otherwise stop after this closing brace
          break;
        }
        continue;
      }
      if (depth > 0) { lastMathChar = j; j++; continue; }
      // At depth 0 — include math-related characters
      if (/[a-zA-Z0-9_^|.,'!*+\-=<>()\[\]\\]/.test(ch)) {
        lastMathChar = j; j++; continue;
      }
      if (ch === " ") {
        // Spaces are ok inside math if there's more math coming
        let peek = j + 1;
        while (peek < len && text[peek] === " ") peek++;
        const nextCh = text[peek] || "";
        if (/[_^\\{(0-9]/.test(nextCh) || (nextCh === "\\" && /[a-zA-Z]/.test(text[peek + 1] || ""))) {
          lastMathChar = j; j++; continue;
        }
        break;
      }
      break;
    }

    const mathExpr = text.slice(cmdIdx, lastMathChar + 1).trim();
    // Only wrap if braces are balanced — unbalanced means we got a fragment
    if (mathExpr) {
      let depth2 = 0;
      let balanced = true;
      for (const ch of mathExpr) {
        if (ch === "{") depth2++;
        else if (ch === "}") { depth2--; if (depth2 < 0) { balanced = false; break; } }
      }
      if (balanced && depth2 === 0) {
        result += `$${mathExpr}$`;
      } else {
        // Unbalanced — output as-is, don't try to render
        result += mathExpr;
      }
    }
    i = lastMathChar + 1;
  }

  return result === text ? text : result;
}

function latexifyHtml(html) {
  if (!html) return "";
  const container = document.createElement("div");
  container.innerHTML = html;

  // Re-render already-tagged lifeos math spans
  for (const element of Array.from(container.querySelectorAll("[data-lifeos-latex]"))) {
    const latex = element.getAttribute("data-lifeos-latex") || "";
    const display = element.getAttribute("data-lifeos-display") === "true";
    if (latex) element.innerHTML = renderLatexToString(latex, display);
  }

  // Convert existing KaTeX output back to our tagged spans (idempotent)
  for (const element of Array.from(container.querySelectorAll(".katex, .katex-display"))) {
    if (element.closest("[data-lifeos-latex]")) continue;
    const annotation = element.querySelector("annotation[encoding='application/x-tex']");
    const latex = annotation?.textContent?.trim();
    if (!latex) continue;
    const span = document.createElement("span");
    const display = element.classList.contains("katex-display");
    span.className = display ? "lifeos-inline-math lifeos-inline-math-display" : "lifeos-inline-math";
    span.setAttribute("data-lifeos-latex", latex);
    span.setAttribute("data-lifeos-display", display ? "true" : "false");
    span.innerHTML = renderLatexToString(latex, display);
    element.replaceWith(span);
  }

  // Walk text nodes: first try $-delimited math, then bare \commands.
  // IMPORTANT: merge adjacent sibling text nodes first so LaTeX expressions
  // that BlockNote split across multiple DOM text nodes are processed whole.
  const allElements = Array.from(container.querySelectorAll("*"));
  for (const el of allElements) {
    if (el.closest("code, pre, textarea, script, style, [data-lifeos-latex]")) continue;
    // Normalize merges adjacent text nodes in each element
    el.normalize();
  }
  container.normalize();

  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode);

  for (const node of textNodes) {
    const parent = node.parentElement;
    if (!parent) continue;
    if (parent.closest("code, pre, textarea, script, style, [data-lifeos-latex]")) continue;

    const raw = node.nodeValue || "";
    if (!raw.trim()) continue;

    // First pass: explicit $...$ / \[...\] / \(...\) delimiters
    const fragment = latexTextToFragment(raw, document);
    if (fragment) { node.replaceWith(fragment); continue; }

    // Second pass: bare LaTeX commands without delimiters
    const wrapped = wrapBareMathInText(raw);
    if (wrapped !== raw) {
      const fragment2 = latexTextToFragment(wrapped, document);
      if (fragment2) { node.replaceWith(fragment2); }
    }
  }

  return container.innerHTML;
}

function htmlContentToInline(editor, html) {
  if (!html) return "";
  const container = document.createElement("div");
  if (isHtmlLike(html)) {
    container.innerHTML = html;
  } else {
    // Plain text — set as textContent (safe, no HTML escaping issues),
    // then latexifyHtml will process both $-delimited and bare \commands.
    container.textContent = String(html);
  }
  const parsed = editor.tryParseHTMLToBlocks(latexifyHtml(container.innerHTML));
  return parsed?.[0]?.content || String(html).replace(/<[^>]+>/g, "");
}

function tableToHtml(table) {
  const rows = table?.rows || [];
  if (!rows.length) return "<table><tbody><tr><td></td></tr></tbody></table>";
  return `<table><tbody>${rows
    .map((row, r) => `<tr>${row.map((cell) => {
      const tag = r === 0 && table?.headers !== false ? "th" : "td";
      const plainText = stripHtml(String(cell ?? "")).trim();
      if (!plainText) return `<${tag}></${tag}>`;
      // Use wrapBareMathInText to surgically wrap only math sub-expressions,
      // leaving prose labels intact. Then latexifyHtml renders the $...$ parts.
      const processed = latexifyHtml(wrapBareMathInText(plainText) || escapeHtml(plainText));
      return `<${tag}>${processed}</${tag}>`;
    }).join("")}</tr>`)
    .join("")}</tbody></table>`;
}

function lifeBlocksToBlockNote(editor, blocks) {
  const convert = (block) => {
    const id = block.id;
    const children = Array.isArray(block.children) ? block.children.map(convert) : undefined;
    switch (block.type) {
      case "heading_1": return { id, type: "heading", props: { level: 1 }, content: htmlContentToInline(editor, block.content), ...(children ? { children } : {}) };
      case "heading_2": return { id, type: "heading", props: { level: 2 }, content: htmlContentToInline(editor, block.content), ...(children ? { children } : {}) };
      case "heading_3": return { id, type: "heading", props: { level: 3 }, content: htmlContentToInline(editor, block.content), ...(children ? { children } : {}) };
      case "bullet": return { id, type: "bulletListItem", content: htmlContentToInline(editor, block.content), ...(children ? { children } : {}) };
      case "numbered": return { id, type: "numberedListItem", content: htmlContentToInline(editor, block.content), ...(children ? { children } : {}) };
      case "todo": return { id, type: "checkListItem", props: { checked: !!block.checked }, content: htmlContentToInline(editor, block.content), ...(children ? { children } : {}) };
      case "quote": return { id, type: "quote", content: htmlContentToInline(editor, block.content), ...(children ? { children } : {}) };
      case "code": return { id, type: "codeBlock", content: block.content || "", ...(children ? { children } : {}) };
      case "divider": return { id, type: "divider", ...(children ? { children } : {}) };
      case "table": { const parsed = editor.tryParseHTMLToBlocks(tableToHtml(block.table))[0] || { type: "table" }; return { ...parsed, id }; }
      case "image": return block.imageUrl ? { id, type: "image", props: { url: block.imageUrl, caption: block.caption || "" } } : { id, type: "paragraph", content: "" };
      case "toggle": return { id, type: "toggleListItem", content: htmlContentToInline(editor, block.content), ...(children ? { children } : {}) };
      case "equation": {
        const latexStr = typeof block.content === "string" && block.content
          ? block.content
          : typeof block.latex === "string" && block.latex
          ? block.latex
          : "";
        return { id, type: "lifeosEquation", props: { latex: latexStr } };
      }
      case "link": return { id, type: "paragraph", content: htmlContentToInline(editor, block.content), ...(children ? { children } : {}) };
      default: {
        const latex = extractStandaloneLatex(block.content);
        if (latex) return { id, type: "lifeosEquation", props: { latex }, ...(children ? { children } : {}) };
        return { id, type: "paragraph", content: htmlContentToInline(editor, block.content), ...(children ? { children } : {}) };
      }
    }
  };
  const converted = (Array.isArray(blocks) ? blocks : []).map(convert);
  return converted.length ? converted : [{ type: "paragraph", content: "" }];
}

function blockNoteToLifeBlock(editor, block) {
  const exported = editor.blocksToFullHTML([block]);
  const holder = document.createElement("div");
  holder.innerHTML = exported;
  const contentNode = holder.querySelector("[data-content-type]") || holder.firstElementChild;
  const content = contentNode?.innerHTML || "";
  const text = contentNode?.textContent || "";
  const base = {
    id: block.id,
    content,
    ...(Array.isArray(block.children) && block.children.length
      ? { children: block.children.map((child) => blockNoteToLifeBlock(editor, child)) }
      : {}),
  };
  switch (block.type) {
    case "heading": return { ...base, type: `heading_${block.props.level || 1}` };
    case "bulletListItem": return { ...base, type: "bullet" };
    case "numberedListItem": return { ...base, type: "numbered" };
    case "checkListItem": return { ...base, type: "todo", checked: !!block.props.checked };
    case "quote": return { ...base, type: "quote" };
    case "codeBlock": return { ...base, type: "code", content: text };
    case "divider": return { id: block.id, type: "divider", content: "" };
    case "image": return { id: block.id, type: "image", imageUrl: block.props.url || "", caption: block.props.caption || "", content: "" };
    case "toggleListItem": return { ...base, type: "toggle", collapsed: false };
    case "lifeosEquation": return { id: block.id, type: "equation", content: String(block.props?.latex || "") };
    case "table": {
      const rows = Array.from(holder.querySelectorAll("tr")).map((row) =>
        Array.from(row.children).map((cell) => cell.innerHTML || cell.textContent || "")
      );
      return { id: block.id, type: "table", content: "", table: { rows, headers: !!rows.length } };
    }
    default: return { ...base, type: "paragraph" };
  }
}

function flattenChildren(block) {
  return {
    ...block,
    children: Array.isArray(block.children) ? block.children.map(flattenChildren) : [],
  };
}

const LifeOSBlockNoteEditor = forwardRef(function LifeOSBlockNoteEditor({ blocks, onChange, assignmentId }, ref) {
  const hydratedFor = useRef(null);
  const editor = useCreateBlockNote({
    schema,
    initialContent: [{ type: "paragraph", content: "" }],
    defaultStyles: true,
  });

  const slashItems = useMemo(() => {
    return async (query) => {
      const defaults = getDefaultReactSlashMenuItems(editor);
      const filteredDefaults = defaults.filter((item) => {
        const title = (item.title || "").toLowerCase();
        const group = (item.group || "").toLowerCase();
        const subtext = (item.subtext || "").toLowerCase();

        return !(
          group.includes("media") ||
          group.includes("embed") ||
          title.includes("image") ||
          title.includes("video") ||
          title.includes("audio") ||
          title.includes("file") ||
          title.includes("embed") ||
          title.includes("url") ||
          subtext.includes("image") ||
          subtext.includes("video") ||
          subtext.includes("audio") ||
          subtext.includes("file") ||
          subtext.includes("embed") ||
          subtext.includes("url")
        );
      });
      const custom = [
        {
          title: "Equation",
          subtext: "Insert a LaTeX equation",
          aliases: ["equation", "math", "latex"],
          group: "NeoCoach",
          onItemClick: () => {
            const cursor = editor.getTextCursorPosition();
            editor.insertBlocks([{ type: "lifeosEquation", props: { latex: "E = mc^2" } }], cursor.block, "after");
          },
        },
      ];
      return filterSuggestionItems([...filteredDefaults, ...custom], query);
    };
  }, [editor]);

  useImperativeHandle(ref, () => ({
    editor,
    insertMarkdown(text) {
      const markdown = String(text || "").trim();
      if (!markdown) return;
      const blocksToInsert = editor.tryParseMarkdownToBlocks(markdown);
      if (!blocksToInsert.length) return;
      const finalBlocks = blocksToInsert.flatMap((b) => {
        const standaloneLatex = extractStandaloneLatex(b.content);
        if (standaloneLatex && ["paragraph", "bulletListItem", "numberedListItem", "checkListItem", "quote", "toggleListItem", "heading"].includes(b.type)) {
          return [{ type: "lifeosEquation", props: { latex: standaloneLatex } }];
        }

        if (b.type === "codeBlock" || b.type === "lifeosEquation" || b.type === "divider" || b.type === "image") {
          return [b];
        }

        const html = editor.blocksToFullHTML([b]);
        const parsed = editor.tryParseHTMLToBlocks(latexifyHtml(html));
        return parsed.length ? parsed : [b];
      });
      const cursor = editor.getTextCursorPosition();
      editor.insertBlocks(finalBlocks, cursor.block, "after");
    },
    focus() {
      editor.focus();
    },
  }), [editor]);

  useEffect(() => {
    if (!assignmentId || hydratedFor.current === assignmentId) return;
    hydratedFor.current = assignmentId;
    const next = lifeBlocksToBlockNote(editor, blocks);
    editor.replaceBlocks(editor.document, next);
  }, [assignmentId, editor]);

  return (
    <div className="lifeos-blocknote-shell">
      <BlockNoteView
        editor={editor}
        theme="dark"
        formattingToolbar
        linkToolbar
        slashMenu={false}
        sideMenu
        tableHandles
        filePanel
        emojiPicker
        onChange={(changedEditor) => {
          const next = changedEditor.document.map((block) => flattenChildren(blockNoteToLifeBlock(changedEditor, block)));
          onChange(next);
        }}
      >
        <SuggestionMenuController triggerCharacter="/" getItems={slashItems} />
      </BlockNoteView>
    </div>
  );
});

export default LifeOSBlockNoteEditor;
