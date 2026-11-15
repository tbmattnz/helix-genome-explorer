export const MAX_BYTES = 25 * 1024 * 1024;
export const STORAGE_LIMIT_BYTES = 1024 * 1024 * 1024;
export const OVERVIEW_NAME = "genome-overview.json";

export function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function nameError(name: string): string | null {
  if (!/\.json$/i.test(name)) return `${name} is not a .json file.`;
  if (name.length > 200 || /[\/\\\u0000-\u001f]/.test(name)) return `${name} has a name HELIX cannot store. Rename it and try again.`;
  return null;
}

export function sizeError(name: string, bytes: number): string | null {
  if (bytes === 0) return `${name} is empty.`;
  if (bytes > MAX_BYTES) {
    const shown = formatSize(bytes);
    const size = shown === "25.0 MB" ? `${shown} (${bytes.toLocaleString("en")} bytes)` : shown;
    return `${name} is ${size}. The largest file HELIX can take is 25 MB.`;
  }
  return null;
}

/** Self-contained JSON scanner: index of the first syntax error, or -1. Also embedded in the upload Worker. */
export function findJsonErrorPos(s: string): number {
  let i = 0;
  const n = s.length;
  const ws = () => { while (i < n && (s[i] === " " || s[i] === "\n" || s[i] === "\r" || s[i] === "\t")) i++; };
  const fail = () => { throw i; };
  const lit = (w: string) => { for (let k = 0; k < w.length; k++) { if (s[i] !== w[k]) fail(); i++; } };
  const str = () => {
    i++;
    while (i < n && s[i] !== '"') {
      if (s[i] === "\\") { i++; if (i >= n) fail(); if (s[i] === "u") { for (let k = 0; k < 4; k++) { i++; if (!/[0-9a-fA-F]/.test(s[i] ?? "")) fail(); } } else if (!'"\\/bfnrt'.includes(s[i])) fail(); }
      else if (s.charCodeAt(i) < 32) fail();
      i++;
    }
    if (i >= n) fail();
    i++;
  };
  const num = () => {
    if (s[i] === "-") i++;
    if (s[i] === "0") i++; else if (/[1-9]/.test(s[i] ?? "")) { while (/[0-9]/.test(s[i] ?? "")) i++; } else fail();
    if (s[i] === ".") { i++; if (!/[0-9]/.test(s[i] ?? "")) fail(); while (/[0-9]/.test(s[i] ?? "")) i++; }
    if (s[i] === "e" || s[i] === "E") { i++; if (s[i] === "+" || s[i] === "-") i++; if (!/[0-9]/.test(s[i] ?? "")) fail(); while (/[0-9]/.test(s[i] ?? "")) i++; }
  };
  const val = (): void => {
    ws();
    const ch = s[i];
    if (ch === "{") {
      i++; ws();
      if (s[i] === "}") { i++; return; }
      for (;;) { ws(); if (s[i] !== '"') fail(); str(); ws(); if (s[i] !== ":") fail(); i++; val(); ws(); if (s[i] === ",") { i++; continue; } if (s[i] === "}") { i++; return; } fail(); }
    } else if (ch === "[") {
      i++; ws();
      if (s[i] === "]") { i++; return; }
      for (;;) { val(); ws(); if (s[i] === ",") { i++; continue; } if (s[i] === "]") { i++; return; } fail(); }
    } else if (ch === '"') str();
    else if (ch === "t") lit("true");
    else if (ch === "f") lit("false");
    else if (ch === "n") lit("null");
    else if (ch === "-" || /[0-9]/.test(ch ?? "")) num();
    else fail();
  };
  try { val(); ws(); if (i < n) fail(); return -1; } catch (e) { return typeof e === "number" ? e : -1; }
}

export function lineCol(text: string, pos: number): { line: number; column: number } {
  let line = 1, start = 0, k = text.indexOf("\n");
  while (k !== -1 && k < pos) { line++; start = k + 1; k = text.indexOf("\n", k + 1); }
  return { line, column: pos - start + 1 };
}

/** Turn a JSON.parse error into a line and column. */
export function locateJsonError(text: string, message: string): { line: number; column: number } | null {
  const lc = /line (\d+) column (\d+)/i.exec(message);
  if (lc) return { line: Number(lc[1]), column: Number(lc[2]) };
  let pos: number | null = null;
  const p = /position (\d+)/i.exec(message);
  if (p) pos = Number(p[1]);
  else if (/end of (JSON|data|input)/i.test(message)) pos = text.length;
  if (pos === null) {
    const found = findJsonErrorPos(text);
    return found >= 0 ? lineCol(text, found) : null;
  }
  let line = 1;
  let lineStart = 0;
  let i = text.indexOf("\n");
  while (i !== -1 && i < pos) {
    line++;
    lineStart = i + 1;
    i = text.indexOf("\n", i + 1);
  }
  return { line, column: pos - lineStart + 1 };
}

export function describeJsonError(message: string): string {
  if (/end of (JSON|data|input)/i.test(message)) return "Unexpected end of input";
  if (/Unexpected (non-whitespace )?(token|character|number|string)/i.test(message)) return "Unexpected token";
  const m = /^(.*?)(?: in JSON| at position|\s*\(line|$)/.exec(message);
  return (m?.[1] || "Parse error").trim();
}

export function jsonErrorMessage(name: string, text: string, message: string): string {
  const loc = locateJsonError(text, message);
  const what = describeJsonError(message);
  return loc
    ? `${name} is not valid JSON. ${what} at line ${loc.line}, column ${loc.column}.`
    : `${name} is not valid JSON. ${what}.`;
}

/** Full check of JSON text. Returns an error message or null. */
export function checkJsonText(name: string, text: string): string | null {
  if (!text.trim()) return `${name} is empty.`;
  try {
    JSON.parse(text);
    return null;
  } catch (e) {
    return jsonErrorMessage(name, text, e instanceof Error ? e.message : String(e));
  }
}
