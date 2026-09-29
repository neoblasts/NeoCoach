/**
 * Utility to extract clean plain text from files (.txt, .md, .pdf, .json, .csv)
 */

export async function parsePdfArrayBuffer(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  let rawStr = "";
  const CHUNK_SIZE = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    rawStr += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK_SIZE));
  }

  const textBlocks = [];
  
  // 1. Extract Tj blocks: (string) Tj or (string) TJ
  const tjRegex = /\(([^()]*)\)\s*T[jJ]/g;
  let match;
  while ((match = tjRegex.exec(rawStr)) !== null) {
    if (match[1] && match[1].trim().length > 1) {
      textBlocks.push(match[1]);
    }
  }

  // 2. Extract TJ array blocks: [(str1) -12 (str2)] TJ
  const tjArrayRegex = /\[\s*((?:\((?:[^()]*)\)\s*|-?\d+\s*)+)\]\s*TJ/g;
  while ((match = tjArrayRegex.exec(rawStr)) !== null) {
    const inner = match[1];
    const strMatches = inner.match(/\(([^()]*)\)/g);
    if (strMatches) {
      const combined = strMatches.map(s => s.slice(1, -1)).join("");
      if (combined.trim().length > 1) textBlocks.push(combined);
    }
  }

  // Fallback: If uncompressed text streams yielded text
  if (textBlocks.length >= 3) {
    const rawText = textBlocks.join(" ");
    return rawText.replace(/\\([()])/g, "$1").replace(/\s+/g, " ").trim();
  }

  // 3. Robust Stream Fallback: Filter out PDF operators and metadata
  const printableLines = rawStr
    .replace(/[^\x20-\x7E\n\r\t]/g, " ")
    .split(/[\n\r]+/)
    .map((l) => l.trim())
    .filter(
      (l) =>
        l.length > 15 &&
        !/^(%\w+|\d+\s+\d+\s+obj|endobj|stream|endstream|xref|trailer|startxref|\/Font|\/Type|\/Filter|\/Length)/i.test(l) &&
        !/^(<<|>>|\/Page|\/Catalog|\/MediaBox)/.test(l)
    );

  const fallbackText = printableLines.join("\n").replace(/\s+/g, " ").trim();
  return fallbackText || "Extracted PDF content stream";
}

export async function extractTextFromFile(file) {
  if (!file) throw new Error("No file selected.");

  const name = file.name || "Uploaded file";
  const ext = name.split(".").pop()?.toLowerCase() || "";

  if (ext === "pdf") {
    const arrayBuffer = await file.arrayBuffer();
    const text = await parsePdfArrayBuffer(arrayBuffer);
    if (!text || text.length < 10) {
      throw new Error(`Could not extract text from PDF "${name}". Ensure it is a text-based PDF.`);
    }
    return { name, text, length: text.length, type: "pdf" };
  }

  // Text-based files (.txt, .md, .json, .csv, .js, .py, .html, etc.)
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = String(e.target?.result || "").trim();
      if (!text) {
        reject(new Error(`File "${name}" appears to be empty.`));
        return;
      }
      resolve({ name, text, length: text.length, type: ext || "text" });
    };
    reader.onerror = () => reject(new Error(`Failed to read file "${name}".`));
    reader.readAsText(file);
  });
}
