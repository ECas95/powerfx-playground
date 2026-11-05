# Community Challenge Packs — Contribution Guide

Contribute practical, reproducible exercises rather than isolated snippets. Packs are JSON-only and always evaluated using the local Power Fx/WDL compatibility subset.

## Quick start

1. Download the template from the Learning Lab's **Packs** tab, or copy [`public/packs/starter-pack.json`](../public/packs/starter-pack.json).
2. Change `id`, `title`, `author`, lesson descriptions, fixtures, step solutions and hints.
3. Keep at least two distinct datasets (base inputs and one variant) to prevent hardcoded outputs from passing accidentally.
4. Run `npm run test:packs && npm test`.
5. Open a pull request containing only JSON pack files and optionally documentation. Never include credentials, customer exports, secrets or real contact details.

## Schema

Root:
```json
{
  "schema": "powerfx-community-pack/1",
  "id": "unique-pack-slug",
  "title": "A useful learning collection",
  "author": "A contributor",
  "lessons": [ { "...": "lesson fields below" } ]
}
```

Each lesson requires `id`, `level` (`Foundation`, `Intermediate`, `Advanced`, `Expert`, `Boss`), `platform` (`canvas` or `flow`), `category`, `title`, `subtitle`, `goal`, `estimatedMinutes`, `skills`, `inputs`, `variants` and `steps`.

Each step requires `title`, `instruction`, `hint`, `why`, and a runnable `solution`. Later steps may reference `Step1`, `Step2`, etc., using the existing curriculum conventions.

## Limits and quality

- ≤85 KB per pack; 1–8 lessons; 2–8 steps per lesson; 1–4 alternate datasets.
- Fixtures and formulas must stay within local evaluator limitations and execute successfully on **all** datasets.
- No dangerous property keys such as `__proto__`, `constructor`, or `prototype`.
- No arbitrary JavaScript or network calls; import is offline and JSON only.
- Use generic, synthetic business data. Avoid personal data and secrets.
- A passing grade is **semantic output equality** on test datasets, not exact formula text equality.
- Treat edge cases seriously: blank values, ties, duplicate records, thresholds and alternate branches where suitable.

## Example

See [starter-pack.json](../public/packs/starter-pack.json) for a two-step Canvas case that filters high-priority open orders and computes total exposure.

## Testing

```bash
npm run test:packs
npm test
npm run build:pages
```

`test:packs` verifies schema validity and executes each reference formula on every dataset. PRs that fail validation should not be merged.

GitHub Pages does not write imported packs back to GitHub. Submit contributions through normal GitHub pull requests.
