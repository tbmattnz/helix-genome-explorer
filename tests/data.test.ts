import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseGenome } from "../src/shared/genome";
import { checkGenes, checkGeneRegions } from "../src/shared/dataChecks";
import { buildGeneIndex, genesInWindow, searchGenes } from "../src/shared/genes";
import { buildRegions } from "../src/shared/regions";
import { checkProtein, translateCodon } from "../src/shared/protein";
import { checkVariants, crossCheckVariants } from "../src/shared/variants";
import { buildVariants, applyVariant } from "../src/shared/variantView";
import { checkTours, crossCheckTours } from "../src/shared/tours";
import { buildTours, resolveTarget } from "../src/shared/tourPlay";

const data = (name: string) => JSON.parse(readFileSync("public/data/" + name + ".json", "utf8"));
const overview = data("genome-overview"), genes = data("genes"), regions = data("gene-regions"), variants = data("variants"), tours = data("tours");
const geneIndex = buildGeneIndex(genes), regionSet = buildRegions(regions), variantSet = buildVariants(variants);

test("all published datasets pass their structural and cross-file checks", () => {
  const genome = parseGenome(overview);
  assert.equal(genome.ok, true);
  assert.deepEqual(checkGenes(genes), []);
  assert.deepEqual(checkGeneRegions(regions), []);
  assert.deepEqual(checkVariants(variants), []);
  assert.deepEqual(crossCheckVariants(variants, regions), []);
  assert.deepEqual(checkTours(tours), []);
  const tourCheck = crossCheckTours(tours, { overview, genes, regions, variants });
  assert.deepEqual(tourCheck.problems, []);
  assert.ok(tourCheck.notes.every(n => !n.includes("skipped")));
  assert.equal(geneIndex.all.length, 19398);
  assert.equal(regionSet.regions.length, 14);
  assert.equal(variantSet.variants.length, 11);
});

test("coding sequences on both strands reproduce all complete reference proteins", () => {
  const strands = new Set<string>();
  let checked = 0;
  for (const region of regionSet.regions) for (const gene of region.genes) {
    if (gene.whollyInRegion && gene.protein) {
      assert.equal(checkProtein(region, gene).status, "match", gene.name);
      strands.add(gene.strand); checked++;
    }
  }
  assert.ok(checked >= 14);
  assert.deepEqual([...strands].sort(), ["+", "-"]);
  assert.equal(translateCodon("ATG"), "M");
  assert.equal(translateCodon("TAA"), "*");
});

test("HBB reverse-strand variant changes glutamate to valine at position seven", () => {
  const region = regionSet.byId.hbb;
  const gene = region.genes.find(g => g.name === "HBB")!;
  const variant = variantSet.variants.find(v => v.id === "rs334")!;
  const reading = applyVariant(region, gene, variant);
  assert.equal(gene.protein?.[6], "E");
  assert.equal(reading.codons[6].aa, "V");
  assert.equal(reading.same, false);
});

test("gene search and half-open intervals retain expected boundaries", () => {
  assert.ok(searchGenes(geneIndex, "HBB").matches.some(g => g.name === "HBB"));
  const hbb = geneIndex.all.find(g => g.name === "HBB")!;
  assert.ok(genesInWindow(geneIndex.byChr[hbb.chr], { startBp: hbb.startBp, endBp: hbb.endBp }).includes(hbb));
  assert.ok(!genesInWindow(geneIndex.byChr[hbb.chr], { startBp: hbb.endBp, endBp: hbb.endBp + 1 }).includes(hbb));
});

test("all 14 guided steps resolve; unavailable targets explain the missing data", () => {
  const ready = (value: any) => ({ status: "ready" as const, value });
  const sources = { chromosomes: overview.chromosomes.map((c: any) => c.name), genes: ready(geneIndex), regions: ready(regionSet), variants: ready(variantSet) };
  let count = 0;
  for (const tour of buildTours(tours).tours) for (const step of tour.steps) {
    const result = resolveTarget(step.target, sources);
    assert.notEqual(result.view, "notice", tour.id + ": " + step.title);
    assert.notEqual(result.view, "wait");
    count++;
  }
  assert.equal(count, 14);
  assert.equal(resolveTarget({view:"gene", chromosome:"11", gene:"HBB"}, {...sources, genes:{status:"error",error:"genes.json missing"}}).view, "notice");
});

test("invalid variant reference letters are rejected", () => {
  const changed = structuredClone(variants);
  changed.variants[0].referenceLetters = "G";
  assert.ok(crossCheckVariants(changed, regions).length > 0);
});


test("static loader uses project-relative URLs, caches reads and retries failed loads", async () => {
  const { loadDataFile } = await import("../src/client/overviewLoader");
  const originalFetch = globalThis.fetch;
  Object.defineProperty(globalThis, "document", { value: { baseURI: "https://example.test/helix/" }, configurable: true });
  const calls: string[] = [];
  let fail = true;
  globalThis.fetch = async (url, options) => {
    calls.push(String(url));
    assert.equal(options?.credentials, "omit");
    if (fail) return new Response("missing", {status: 404});
    return Response.json({ ok: true });
  };
  try {
    await assert.rejects(loadDataFile("genes.json"), /HTTP 404/);
    fail = false;
    assert.deepEqual(await loadDataFile("genes.json"), {ok: true});
    await loadDataFile("genes.json");
    assert.deepEqual(calls, ["https://example.test/helix/data/genes.json", "https://example.test/helix/data/genes.json"]);
    await assert.rejects(loadDataFile("../private.json"), /Unknown dataset/);
    assert.equal(calls.length, 2);
  } finally {
    globalThis.fetch = originalFetch;
    Reflect.deleteProperty(globalThis, "document");
  }
});
