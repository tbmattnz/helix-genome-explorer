# HELIX

[Live demo](https://tbmattnz.github.io/helix-genome-explorer/) · [Version 0.1.0](https://github.com/tbmattnz/helix-genome-explorer/releases/tag/v0.1.0)

A classroom genome explorer from Teacher's Buddy. Move from a human chromosome to a gene, its DNA letters, the protein it encodes and selected variants. Use the guided tours as starting points for classroom discussion.

HELIX is a standalone static application. No Teacher's Buddy account, server, database, AI service or API key is required. It is an educational reference explorer, not a clinical interpretation tool. Example regions, variant summaries and tours remain draft teaching material for educator review.

## Run and build

Node.js 22.12 or later is required.

```sh
npm ci --ignore-scripts
npm test
npm run dev
npm run build
npm run preview
```

Open the local URL printed by Vite. Publish the contents of `dist/` to any static host. Relative asset and data paths support deployment under a project subdirectory. Install scripts are unnecessary when the package manager installs the matching optional esbuild and Tailwind platform binaries.

## Explore

- Select a chromosome; use the zoom controls or keyboard arrows to navigate.
- Search for a gene such as HBB.
- Open a chosen gene region and jump to its coding start to see DNA and amino acids.
- Select a variant and toggle its version to compare the resulting protein.
- Start a guided tour or enable Class display for larger projected text.
- Open Sources for provenance and reference-genome limitations.

The snapshot includes 24 nuclear chromosomes, 19,398 protein-coding gene records, 14 chosen regions, 11 variants and 3 tours. It is a selected, versioned reference dataset, not a live genome database. X/Y shared genes occur on both chromosomes; mitochondrial DNA and non-coding genes are outside this map.

## Reuse and adapt

The React views in `src/client/map/` can be adapted independently. Framework-independent helpers in `src/shared/` cover coordinates, gene search, sequence translation, variant comparisons and tour targets.

An educator can change the text, questions and sequence in `public/data/tours.json` without changing the UI. A developer can replace or extend compatible JSON datasets and reuse the explorer. See [the adaptation guide](docs/adapting.md) and [data provenance](DATA_SOURCES.md).

All application data loads from same-origin static files. There is no sign-in, user-data collection, analytics, upload or remote model call. Static hosting providers may maintain ordinary access logs.

## Licensing and attribution

Original HELIX code, documentation and authored teaching text are MIT licensed; see [LICENSE](LICENSE). Upstream scientific data retain their own terms, detailed in [DATA_SOURCES.md](DATA_SOURCES.md). MIT does not relicense those data. Third-party software notices are in `public/THIRD_PARTY_NOTICES.txt`.

Developed by Matt Abraham / Teacher's Buddy. Cite the exact version using `CITATION.cff`. This initial public extraction demonstrates reuse of public scientific data; it does not claim external adoption or validated classroom outcomes.

## Validation and limitations

`npm test` checks dataset structure, cross-file references, gene-coordinate boundaries, complete DNA-to-protein translations on both strands, a known HBB variant and all guided-tour targets. Teaching summaries still need subject-specialist review. Variant frequencies reflect gnomAD's sample, not a representative population estimate or an individual's risk.

The original data-generation scripts and exact upstream retrieval timestamps were not available in the exported app. Embedded source versions and transformation notes are retained; checksums identify this release's snapshots. Do not describe the datasets as freshly regenerated from upstream.
