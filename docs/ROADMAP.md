# Power Fx Playground — Product Roadmap

## Shipped in v0.8.0

- Learning Lab: 12 multi-step hands-on cases (43 steps), five levels, two independent modes (Challenge / Walkthrough), two-dataset grading, progress in browser storage, and export.
- Connected step outputs with Canvas variables and mock WDL Compose outputs, Trace event assertions, case links and mobile responsive guidance.
- See [Learning Lab design and next iterations](LEARNING_LAB.md).

## Shipped in v0.7.0

- Bounded `GroupBy`, `Ungroup`, `SortByColumns` and `RenameColumns` using mock Canvas JSON data.
- 99 regression-tested scenarios, including nested aggregation and advanced grouping.
- Library QA: run bundled examples from the portal and export a structured pass/fail JSON report.
- Key-order-independent record assertions, safer field validation and cached sort keys.

## Next recommended milestones

1. **Diagnostics before execution:** parser errors with code frames, function signature checking, scope-resolution hints and warnings for nondelegable operations. Keep warnings visibly distinct from verified Microsoft runtime behavior.
2. **Data-aware input builder:** array/record schema viewer, bulk JSON editor and optional *synthetic* data generator. No production data or tenant credentials by default.
3. **Formula test artifacts:** multiple saved named suites, JSON import/export, diff of expected vs actual values, snapshot/version compare, and shareable files without uploading test content.
4. **Expanded expression coverage:** `DateAdd`/`DateDiff`, `ParseJSON`/`JSON`, `GroupBy` edge semantics, WDL date expressions, error propagation, regex variants and function-by-function differential tests.
5. **Optional official runtime:** isolated, authenticated .NET Power Fx interpreter for supported pure expressions; verify output parity and clearly label unsupported Canvas behaviors.
6. **Developer automation:** CI-ready CLI with a signed/versioned test-case schema and a GitHub Action for validating formula fixtures. Never execute connector mutations by default.

## Acceptance requirements for new functions

- Reference published Power Fx/WDL syntax and host limitations.
- Positive, negative, boundary and composition tests.
- Runnable example with synthetic inputs and expected output.
- Correct dependency analysis and browser cold-boot verification.
- No hidden side effects; explicit mock/local labels.

## Implemented in v0.9

- [x] Rule-based formula tutor with progressive, context-specific hints and related lessons.
- [x] Conservative delegation guidance for Dataverse, SharePoint, and SQL; official Microsoft Learn links.
- [x] Deterministic synthetic dataset mutation (duplicates, nulls, numeric boundaries); separately graded stress checks.
- [x] Offline community challenge packs with strict schema/reference execution validation and CLI CI checks.
- [x] Spanish/English lesson briefs, instructions, explanations, hints and skill progress.

Future: integrate the real Power Fx interpreter into the hosted experience where feasible, expand delegation rule metadata by column types, add signed community pack releases and advanced randomized property tests.
