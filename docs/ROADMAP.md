# Power Fx Playground — Product Roadmap

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
