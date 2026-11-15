export type SourceEntry = { name: string; provider: string; usedFor: string; file: string; url: string; terms: string };

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** Read meta.sources and meta.notes. Missing or wrong fields are named, never thrown. */
export function readSources(meta: Record<string, unknown>) {
  const problems: string[] = [];
  const sources: SourceEntry[] = [];
  if (meta.sources === undefined) problems.push("genome-overview.json has no meta.sources");
  else if (!Array.isArray(meta.sources)) problems.push("genome-overview.json has meta.sources, but it is not a list");
  else meta.sources.forEach((s, i) => {
    if (!s || typeof s !== "object") { problems.push(`meta.sources[${i}] is not an object`); return; }
    const o = s as Record<string, unknown>;
    const e = { name: str(o.name), provider: str(o.provider), usedFor: str(o.usedFor), file: str(o.file), url: str(o.url), terms: str(o.terms) };
    if (!e.name) problems.push(`meta.sources[${i}] has no name`);
    if (e.url && !/^https:\/\//.test(e.url)) e.url = "";
    sources.push({ ...e, name: e.name || `Source ${i + 1}` });
  });
  let notes: string[] = [];
  if (meta.notes === undefined) problems.push("genome-overview.json has no meta.notes");
  else if (!Array.isArray(meta.notes)) problems.push("genome-overview.json has meta.notes, but it is not a list");
  else notes = meta.notes.map(str).filter(Boolean);
  return { sources, notes, problems };
}
