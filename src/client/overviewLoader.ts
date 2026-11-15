const names = new Set(["genome-overview.json", "genes.json", "gene-regions.json", "variants.json", "tours.json"]);
const cache = new Map<string, Promise<unknown>>();

/** Versioned, same-origin JSON. No account, service API or credentials. */
export function loadDataFile(name = "genome-overview.json"): Promise<unknown> {
  if (!names.has(name)) return Promise.reject(new Error("Unknown dataset."));
  const existing = cache.get(name);
  if (existing) return existing;
  const pending = fetch(new URL("data/" + name, document.baseURI), { credentials: "omit" })
    .then(async response => {
      if (!response.ok) throw new Error(name + " could not be loaded (HTTP " + response.status + ").");
      try { return await response.json(); }
      catch { throw new Error(name + " is not valid JSON."); }
    })
    .catch(error => { cache.delete(name); throw error; });
  cache.set(name, pending);
  return pending;
}
