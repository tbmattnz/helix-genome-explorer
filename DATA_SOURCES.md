# Data provenance and reuse

Terms checked against provider sources on 16 November 2026. The five JSON files retain their original `meta.sources`, coordinate descriptions and transformation notes. Original upstream download dates and generator scripts were not included in the app export. `data-manifest.json` records SHA-256 hashes of the distributed snapshots.

| Source | Used for | Terms and evidence |
|---|---|---|
| GRCh38/hg38, Genome Reference Consortium via UCSC | Chromosome lengths and DNA sequences for selected regions | UCSC permits public and commercial reuse of table and file data, subject to source-specific exceptions. The hg38 assembly README lists no additional reuse restriction. [UCSC data terms](https://genome.ucsc.edu/license/), [hg38 README](https://hgdownload.soe.ucsc.edu/goldenPath/hg38/bigZips/README.txt). No liftOver chains or restricted clinical tracks are included. |
| UCSC hg38 cytoBand | Chromosome bands and centromere locations | Same UCSC data-use terms. [Source directory](https://hgdownload.soe.ucsc.edu/goldenPath/hg38/database/). |
| GENCODE release 46 / Ensembl 112 | Gene coordinates, coding parts, proteins and density counts | Provider policy permits use without restrictions; this is not labelled MIT or CC0 here. [Release 46](https://www.gencodegenes.org/human/release_46.html), [official UCSC GENCODE policy](https://github.com/ucscGenomeBrowser/kent/blob/master/src/hg/makeDb/trackDb/wgEncodeGencodeCredits1.shared.html). Inputs: basic annotation GTF and protein translations FASTA. |
| HGNC | Approved full gene names | CC0. Attribution recommended. [HGNC licence](https://www.genenames.org/about/license/). Input: hgnc_complete_set.txt; exact retrieval date unavailable. |
| gnomAD v4, API dataset gnomad_r4 | Eleven variants' positions, alleles and aggregate counts | Primary exome/genome data are CC0. [Official terms](https://gnomad.broadinstitute.org/policies), [policy source](https://github.com/broadinstitute/gnomad-browser/blob/main/browser/about/policies/terms.md). Restricted annotations such as SpliceAI are not included. Respect the provider's no-reidentification policy. Effects are calculated locally from the reference sequence and coding intervals. |

Please acknowledge Genome Reference Consortium, UCSC Genome Browser, GENCODE, HGNC and gnomAD when reusing this work. This tool includes data from gnomAD v4; no finer release is inferred from the export. These organisations do not endorse HELIX.

## Transformations and conventions

- All genomic intervals are zero-based, start-inclusive and end-exclusive. Length is end minus start.
- Gene density places full-extent gene midpoints into 1,000,000-base bins. Search records describe the canonical transcript, so some bin assignments differ.
- The map contains chromosomes 1–22, X and Y. Shared X/Y genes are listed twice; readthrough records and mitochondrial genes are excluded.
- Region DNA is on the forward strand. Negative-strand coding sequence is reverse-complemented before translation; coding includes the stop signal.
- Variant reference letters are checked against the region; protein effects are derived from those letters. No clinical significance database is imported.
- Tours are authored teaching examples built around this snapshot. They must be rechecked if the data change.

## What the MIT licence covers

Teacher's Buddy's original application code, authored descriptions, tour text and documentation are MIT licensed. Upstream scientific records and third-party packages retain the terms above and their software notices. This separation avoids implying that publishing a derived JSON file changes its sources' licensing.
