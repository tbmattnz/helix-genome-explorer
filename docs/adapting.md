# Adapt HELIX

## Add a teaching tour

Edit `public/data/tours.json`. Each tour has a unique id, title, summary and steps. A step has title, text, optional question and target. For example:

```json
{
  "id": "my-hbb-lesson",
  "title": "How a gene becomes a protein",
  "summary": "A short lesson using the existing HBB region.",
  "steps": [
    {
      "title": "Find HBB",
      "text": "Locate HBB on chromosome 11.",
      "question": "How does the size of this gene compare with the chromosome?",
      "target": {"view": "gene", "chromosome": "11", "gene": "HBB"}
    },
    {
      "title": "Read the coding sequence",
      "text": "Follow groups of three letters in the gene's direction.",
      "target": {"view": "region", "region": "hbb", "gene": "HBB", "jump": "codingStart"}
    }
  ]
}
```

Append the object to `tours`, update `totals.tours` and `totals.steps`, then run the validators. The release-snapshot assertions in `tests/data.test.ts` pin current counts; update them deliberately when extending the dataset. The cross-file validators must still pass. Review the teaching text separately.

Supported targets: map, chromosome, gene, region and variant. Variant targets include region, variant id and optional `showVariantVersion`. `src/shared/tours.ts` validates the schema and `tourPlay.ts` resolves targets.

## Extend the data

Use the existing files' `meta` descriptions as the format contract. Preserve source, version, terms and transformations. Keep zero-based, half-open coordinates consistent across all files. A new region needs reference letters, gene/exon/coding intervals and reference proteins; a variant must match those reference letters. Update hashes with `node scripts/manifest.mjs`.

Run `npm test` and check the changed browser journey before distributing. Keep teaching claims and dataset coverage explicit. Replacing data with a different assembly requires coordinated updates; changing one file alone is insufficient.

## Reuse the calculations

The modules in `src/shared/` have no React or Teacher's Buddy dependency. Import gene search/indexing, interval helpers, protein translation or tour resolution into another TypeScript application. Their tests illustrate inputs and expected boundaries.

For another frontend, replace the React views while retaining the JSON formats and helpers. For another host, deploy `dist/`; there are no server routes to reproduce.

## Publish a version

Build with the checked lockfile, run the tests, and serve the output locally before release. The public demo is the static contents of `dist/` published on the `gh-pages` branch. The default branch holds source; its tag identifies each source release. Include `.nojekyll` in the Pages output, and keep `CITATION.cff`, the demo version link and release notes aligned with the tag. No provider secrets or API keys belong in the source or output.
