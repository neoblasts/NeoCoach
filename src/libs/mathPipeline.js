/**
 * LifeOS Math Rendering Pipeline — authoritative, single source of truth.
 *
 * STRATEGY: Left-to-right placeholder tokenizer.
 * ─────────────────────────────────────────────
 * 1. Walk the string left-to-right.
 * 2. When a math delimiter is found, extract the full region, clean it,
 *    store it in a slot, and replace it with a placeholder \x00Mn\x00.
 * 3. No region is ever double-processed because placeholders are opaque.
 * 4. After the walk, restore placeholders with proper $$ / $ formatting.
 *
 * This eliminates every class of regex-order bug:
 *  - No "already inside $$?" check
 *  - No lazy-quantifier backtracking past env boundaries
 *  - No double-application of cleanMathContent
 *  - No inline $ consuming $$
 */

/* ─────────────────────────────────────────────────────────────────────────────
 * SECTION 1 — CONSTANTS
 * ───────────────────────────────────────────────────────────────────────────── */

// Environments KaTeX renders natively (inside $$)
const KATEX_ENVS = new Set([
  "aligned", "gathered", "split",
  "matrix", "pmatrix", "bmatrix", "Bmatrix", "vmatrix", "Vmatrix",
  "cases", "array", "CD",
]);

// AI model alias → KaTeX target
const ENV_ALIASES = {
  "align": "aligned",
  "align*": "aligned",
  "equation": "aligned",
  "equation*": "aligned",
  "gather": "gathered",
  "gather*": "gathered",
  "multline": "aligned",
  "multline*": "aligned",
  "eqnarray": "aligned",
  "eqnarray*": "aligned",
};

// All envs we will auto-detect (aliases expanded + native)
const ALL_ENV_NAMES = new Set([...KATEX_ENVS, ...Object.keys(ENV_ALIASES)]);

/* ─────────────────────────────────────────────────────────────────────────────
 * SECTION 2 — MATH CONTENT CLEANER
 * Applied INSIDE math regions only. Conservative — never corrupts valid LaTeX.
 * ───────────────────────────────────────────────────────────────────────────── */

function cleanMathContent(src) {
  if (!src) return "";
  let s = String(src).trim();

  // Rewrite aliased env names to KaTeX equivalents
  for (const [from, to] of Object.entries(ENV_ALIASES)) {
    // escape the * in names like align*
    const ef = from.replace("*", "\\*");
    s = s.replace(new RegExp(`\\\\begin\\{${ef}\\}`, "g"), `\\begin{${to}}`);
    s = s.replace(new RegExp(`\\\\end\\{${ef}\\}`, "g"), `\\end{${to}}`);
  }

  // Fix \sqrt without braces: \sqrt2 → \sqrt{2}
  s = s.replace(/\\sqrt([a-zA-Z0-9])(?![a-zA-Z0-9{])/g, "\\sqrt{$1}");

  // Fix unescaped % in math
  s = s.replace(/(?<!\\)%/g, "\\%");

  // Fix stray | that ends up as "= |" before \frac/\sqrt (model artifact)
  s = s.replace(/([=+\-])\s*\|\s*(\\(?:frac|sqrt|left|big|lim))/g, "$1 $2");

  // Balance braces (add missing closing braces only; never remove)
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    const prev = s[i - 1];
    if (ch === "{" && prev !== "\\") depth++;
    else if (ch === "}" && prev !== "\\") depth = Math.max(0, depth - 1);
  }
  if (depth > 0) s += "}".repeat(depth);

  return s;
}

/* ─────────────────────────────────────────────────────────────────────────────
 * SECTION 3 — LEFT-TO-RIGHT TOKENIZER HELPERS
 * ───────────────────────────────────────────────────────────────────────────── */

function findMatchingClose(text, start, openSeq, closeSeq) {
  const idx = text.indexOf(closeSeq, start + openSeq.length);
  return idx === -1 ? -1 : idx;
}

/**
 * Find the end of a \begin{env}...\end{env} block starting at `beginIdx`.
 * Returns the index AFTER \end{envName}, or -1 if not found.
 */
function findEnvEnd(text, beginIdx) {
  // Extract env name from \begin{...}
  const braceOpen = text.indexOf("{", beginIdx + 6); // \begin{
  if (braceOpen === -1) return -1;
  const braceClose = text.indexOf("}", braceOpen + 1);
  if (braceClose === -1) return -1;
  const envName = text.slice(braceOpen + 1, braceClose);
  if (!ALL_ENV_NAMES.has(envName)) return -1;

  const closeTag = `\\end{${envName}}`;
  const closeIdx = text.indexOf(closeTag, braceClose + 1);
  if (closeIdx === -1) return -1;

  return { envName, contentStart: braceClose + 1, closeTagStart: closeIdx, end: closeIdx + closeTag.length };
}

/* ─────────────────────────────────────────────────────────────────────────────
 * SECTION 4 — MAIN NORMALIZER
 * ───────────────────────────────────────────────────────────────────────────── */

export function normalizeLatex(rawText) {
  if (!rawText) return "";

  // Pre-processing
  let text = String(rawText)
    .replace(/\r\n/g, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    // Normalize Unicode dashes/minus to ASCII hyphen-minus
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2212]/g, "-");

  // Protect LaTeX dimension line-breaks \\[4pt] from being parsed as \[...\]
  const linebreakSlots = [];
  text = text.replace(/\\\\(\[\s*[\d.]+(?:pt|px|em|ex|cm|mm|in)\s*\])/gi, (match, dim) => {
    const id = `\x00LB${linebreakSlots.length}\x00`;
    linebreakSlots.push(`\\\\${dim}`);
    return id;
  });

  // ── Left-to-right pass ────────────────────────────────────────────────────
  // We walk character by character. At each position we check for delimiters
  // in priority order and extract math/code regions into slots.

  const slots = []; // { type: 'display'|'inline'|'code', content: string }
  let out = "";
  let i = 0;
  const n = text.length;

  while (i < n) {
    const ch = text[i];
    const ch2 = text[i + 1];

    // ── Triple-backtick code fence ─────────────────────────────────────────
    if (ch === "`" && ch2 === "`" && text[i + 2] === "`") {
      const closeIdx = text.indexOf("```", i + 3);
      if (closeIdx !== -1) {
        const id = `\x00S${slots.length}\x00`;
        slots.push({ type: "code", content: text.slice(i, closeIdx + 3) });
        out += id;
        i = closeIdx + 3;
        continue;
      }
    }

    // ── Single-backtick inline code ────────────────────────────────────────
    if (ch === "`" && ch2 !== "`") {
      const closeIdx = text.indexOf("`", i + 1);
      if (closeIdx !== -1) {
        const id = `\x00S${slots.length}\x00`;
        slots.push({ type: "code", content: text.slice(i, closeIdx + 1) });
        out += id;
        i = closeIdx + 1;
        continue;
      }
    }

    // ── $$ display math ────────────────────────────────────────────────────
    if (ch === "$" && ch2 === "$") {
      const closeIdx = text.indexOf("$$", i + 2);
      if (closeIdx !== -1) {
        const mathContent = text.slice(i + 2, closeIdx);
        const id = `\x00S${slots.length}\x00`;
        slots.push({ type: "display", content: mathContent });
        out += id;
        i = closeIdx + 2;
        continue;
      }
    }

    // ── \[ ... \] display math ─────────────────────────────────────────────
    if (ch === "\\" && ch2 === "[") {
      const closeIdx = text.indexOf("\\]", i + 2);
      if (closeIdx !== -1) {
        const mathContent = text.slice(i + 2, closeIdx);
        const id = `\x00S${slots.length}\x00`;
        slots.push({ type: "display", content: mathContent });
        out += id;
        i = closeIdx + 2;
        continue;
      }
    }

    // ── \begin{env} ... \end{env} ─────────────────────────────────────────
    if (ch === "\\" && text.slice(i, i + 7) === "\\begin{") {
      const found = findEnvEnd(text, i);
      if (found) {
        const fullBlock = text.slice(i, found.end);
        const id = `\x00S${slots.length}\x00`;
        slots.push({ type: "display", content: fullBlock });
        out += id;
        i = found.end;
        continue;
      }
    }

    // ── \( ... \) inline math ──────────────────────────────────────────────
    if (ch === "\\" && ch2 === "(") {
      const closeIdx = text.indexOf("\\)", i + 2);
      if (closeIdx !== -1) {
        const mathContent = text.slice(i + 2, closeIdx);
        const id = `\x00S${slots.length}\x00`;
        slots.push({ type: "inline", content: mathContent });
        out += id;
        i = closeIdx + 2;
        continue;
      }
    }

    // ── $ inline math ──────────────────────────────────────────────────────
    // Only treat as math if not preceded by $ and not followed by $
    // and the content doesn't look like a price ($10, $100).
    if (ch === "$" && ch2 !== "$" && (i === 0 || text[i - 1] !== "$")) {
      // Find closing $
      let j = i + 1;
      let found = false;
      // Closing $ must not be preceded by space and content must not be empty
      while (j < n && text[j] !== "\n") {
        if (text[j] === "$" && text[j - 1] !== " " && j > i + 1) {
          const mathContent = text.slice(i + 1, j);
          // Skip if it looks like a dollar price: $12, $100, etc.
          if (!/^\d+$/.test(mathContent.trim())) {
            const id = `\x00S${slots.length}\x00`;
            slots.push({ type: "inline", content: mathContent });
            out += id;
            i = j + 1;
            found = true;
          }
          break;
        }
        j++;
      }
      if (found) continue;
    }

    // ── Plain text character ───────────────────────────────────────────────
    out += ch;
    i++;
  }

  // ── Restore placeholders ──────────────────────────────────────────────────
  // Replace \x00Sn\x00 with properly formatted math
  text = out.replace(/\x00S(\d+)\x00/g, (_, idx) => {
    const slot = slots[parseInt(idx, 10)];
    if (!slot) return "";
    if (slot.type === "code") return slot.content;
    if (slot.type === "display") {
      const cleaned = cleanMathContent(slot.content);
      return `\n$$\n${cleaned}\n$$\n`;
    }
    if (slot.type === "inline") {
      const cleaned = cleanMathContent(slot.content);
      // If the cleaned content spans multiple lines → promote to display math
      if (cleaned.includes("\n") || cleaned.includes("\\begin{")) {
        return `\n$$\n${cleaned}\n$$\n`;
      }
      return `$${cleaned}$`;
    }
    return "";
  });

  // Restore LB placeholders
  text = text.replace(/\x00LB(\d+)\x00/g, (_, idx) => linebreakSlots[parseInt(idx, 10)] || "");

  // Collapse 3+ blank lines to 2
  text = text.replace(/\n{3,}/g, "\n\n");

  return text;
}

/* ─────────────────────────────────────────────────────────────────────────────
 * SECTION 5 — STREAMING SAFETY
 * ───────────────────────────────────────────────────────────────────────────── */

/**
 * Returns true if the text has an unclosed math block (during streaming).
 * Code regions are excluded from the check.
 */
export function hasOpenMathBlock(text) {
  if (!text) return false;

  // Remove code regions so their content doesn't trigger false positives
  const clean = text
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`\n]+`/g, "");

  // Count $$ — odd count means an open display block
  const ddCount = (clean.match(/\$\$/g) || []).length;
  if (ddCount % 2 !== 0) return true;

  // Count \[ and \]
  const openBracket = (clean.match(/\\\[/g) || []).length;
  const closeBracket = (clean.match(/\\\]/g) || []).length;
  if (openBracket !== closeBracket) return true;

  // Count \( and \)
  const openParen = (clean.match(/\\\(/g) || []).length;
  const closeParen = (clean.match(/\\\)/g) || []).length;
  if (openParen !== closeParen) return true;

  // Count \begin{env} vs \end{env}
  for (const env of ALL_ENV_NAMES) {
    const ef = env.replace("*", "\\*");
    const opens = (clean.match(new RegExp(`\\\\begin\\{${ef}\\}`, "g")) || []).length;
    const closes = (clean.match(new RegExp(`\\\\end\\{${ef}\\}`, "g")) || []).length;
    if (opens !== closes) return true;
  }

  return false;
}

/**
 * Returns a version of streaming text that is safe to render.
 * If an unclosed math block is detected, the text is truncated just before
 * the last open delimiter so KaTeX never sees partial LaTeX.
 */
export function getStreamSafeText(text) {
  if (!text || !hasOpenMathBlock(text)) return text || "";

  const clean = text
    .replace(/```[\s\S]*?```/g, "§")
    .replace(/`[^`\n]+`/g, "§");

  let lastOpenPos = -1;

  // Last unmatched $$
  let ddCount = 0;
  let lastDDPos = -1;
  let searchFrom = 0;
  while (true) {
    const idx = clean.indexOf("$$", searchFrom);
    if (idx === -1) break;
    ddCount++;
    if (ddCount % 2 === 1) lastDDPos = idx;
    searchFrom = idx + 2;
  }
  if (ddCount % 2 !== 0) lastOpenPos = Math.max(lastOpenPos, lastDDPos);

  // Last unmatched \[
  const openBrackets = [...clean.matchAll(/\\\[/g)].map((m) => m.index);
  const closeBrackets = [...clean.matchAll(/\\\]/g)].map((m) => m.index);
  if (openBrackets.length > closeBrackets.length) {
    lastOpenPos = Math.max(lastOpenPos, openBrackets[closeBrackets.length] ?? -1);
  }

  // Last unmatched \(
  const openParens = [...clean.matchAll(/\\\(/g)].map((m) => m.index);
  const closeParens = [...clean.matchAll(/\\\)/g)].map((m) => m.index);
  if (openParens.length > closeParens.length) {
    lastOpenPos = Math.max(lastOpenPos, openParens[closeParens.length] ?? -1);
  }

  // Last unmatched \begin{env}
  for (const env of ALL_ENV_NAMES) {
    const ef = env.replace("*", "\\*");
    const opens = [...clean.matchAll(new RegExp(`\\\\begin\\{${ef}\\}`, "g"))].map((m) => m.index);
    const closes = [...clean.matchAll(new RegExp(`\\\\end\\{${ef}\\}`, "g"))].map((m) => m.index);
    if (opens.length > closes.length) {
      lastOpenPos = Math.max(lastOpenPos, opens[closes.length] ?? -1);
    }
  }

  if (lastOpenPos <= 0) return text;
  return text.slice(0, lastOpenPos).trimEnd();
}
