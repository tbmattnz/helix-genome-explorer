export type OverviewResult = { ok: true; title: string; count: number } | { ok: false; problems: string[] };

/** Check the fields the start screen needs. Never throws. */
export function readOverview(data: unknown, N = "genome-overview.json"): OverviewResult {
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    return { ok: false, problems: [`${N} must contain a JSON object at the top level.`] };
  }
  const d = data as Record<string, unknown>;
  const problems: string[] = [];
  let title = "";
  if (!("meta" in d) || d.meta === undefined) problems.push(`${N} has no meta.title`);
  else if (d.meta === null || typeof d.meta !== "object" || Array.isArray(d.meta)) problems.push(`${N} has a meta field that is not an object, so it has no meta.title`);
  else {
    const t = (d.meta as Record<string, unknown>).title;
    if (t === undefined) problems.push(`${N} has no meta.title`);
    else if (typeof t !== "string") problems.push(`${N} has a meta.title that is not text`);
    else if (!t.trim()) problems.push(`${N} has an empty meta.title`);
    else title = t.trim();
  }
  let count = 0;
  if (!("chromosomes" in d) || d.chromosomes === undefined) problems.push(`${N} has no chromosomes list`);
  else if (!Array.isArray(d.chromosomes)) problems.push(`${N} has chromosomes, but it is not a list`);
  else count = d.chromosomes.length;
  return problems.length ? { ok: false, problems } : { ok: true, title, count };
}
