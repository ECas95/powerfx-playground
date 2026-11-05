# Power Fx Playground v0.9 — Learning Extensions

The Learning Lab supports five optional, browser-local learning tools. All data is synthetic by default; no Power Apps tenant credentials, connectors or telemetry are accessed.

## 1. Formula Coach

**Tutor** explains failure classes using deterministic rules: syntax and missing references, literal-only solutions, nested record scope (`As`, `CountIf`, `With`), regex, and mismatched results. Click **Reveal next hint** to expose up to three graduated hints. The coach suggests related lessons by shared skills.

This is a rule-based coach, **not a generative AI model**. Hints are educational and may be incomplete. They do not expose a hidden correct formula in Challenge mode.

## 2. Delegation Clinic

Choose **Dataverse**, **SharePoint** or **SQL Server**, paste a Canvas formula, and run a conservative static check. The report distinguishes:
- **Risk:** documented nondelegable family or connector-specific limitation (for example `GroupBy`, `Ungroup`, SharePoint `Search`, SQL `IsBlank` on columns).
- **Review:** uncertainty about the query, field types, membership tests, `CountIf` features or other connector-specific behavior.
- **Candidate:** no known risk pattern in a `Filter`/`LookUp` query. **Not** a guarantee of delegation.

The demo illustrates how a matching record beyond the first 500 could be missed in a locally processed query. It is not a live query or a prediction of an app's configured limits.

Always verify in **Power Apps Studio** and **Live Monitor**, with the actual connector, column schema and tenant configuration.

Microsoft references:
- [Delegation overview](https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/delegation-overview)
- [Dataverse delegation](https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/connections/connection-common-data-service)
- [SharePoint delegation](https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/connections/connection-sharepoint-online)
- [SQL Server delegation](https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/connections/connection-azure-sqldatabase)

## 3. Stress Dataset Generator

Generates reproducible synthetic fixtures using a numeric seed and:
- Duplicate rows;
- Null text fields;
- Numeric boundary values and reordered records.

The **Check my formula** action evaluates the current step against the generated data using the same reference formula as the curriculum. The extra stress result does **not** unlock a step and **does not penalize** the learner when the reference cannot evaluate a synthetic edge case. Original datasets are never mutated.

## 4. Community Challenge Packs

Import offline JSON packs in the **Packs** tab, or download a template. Each pack supports multiple levels, multi-step exercises, explanatory walkthroughs, base inputs and alternate datasets.

**Security and quality:** a pack is data, not JavaScript. The portal uses a restricted local evaluator, rejects unsafe prototype keys, enforces strict JSON size/depth/field limits, and executes every reference step across datasets before accepting the pack. The import cap is 85 KB, 1–8 lessons, and 2–8 steps per lesson. Packs remain in this browser session; learner-written formulas are still stored locally via existing progress behavior.

Contribute packs through a pull request under `public/packs/`. CI validates the examples:
```bash
npm run test:packs
npm test
```
See [Community Pack Guide](COMMUNITY_PACKS.md).

## 5. English / Spanish learning

Use the Language selector to switch the Learning Lab between English and Spanish. All 12 built-in lesson briefs and 43 step instructions, hint guidance and explanations have Spanish equivalents. Power Fx and WDL function names and literal business data are not translated. Imported community packs remain in their authored language.

Your language preference and completed-step progress are saved in browser-local storage. This **is not a Microsoft certification**.

## How to run locally

```bash
npm test
npm start
```
Open `http://localhost:4173/learn.html`. For static deployments, `npm run build:pages` copies all required modules and community pack examples into `dist/`.

## Current limitations

- The Coach is rule based, not an external AI or formal static analyzer.
- Delegation checks are conservative heuristics, not actual connector execution.
- Stress data is synthetic, not a complete property-based testing engine.
- The local evaluator supports a subset of Power Fx/WDL; some tenant-dependent behavior cannot be simulated.
- Community packs are validated on import but **not** sandboxed as unrestricted code; all formula evaluation occurs in the existing restricted parser/interpreter.
