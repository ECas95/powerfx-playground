# Interactive Learning Lab (v0.8.0)

Standalone **Power Fx Playground → Learning Lab**: a companion to the existing expression workbench, available at `learn.html`. The entire feature lives in `ECas95/powerfx-playground`; it does not import code from or modify Canvas App Visualizer.

## How it works

- **Challenge** asks you to solve a real-world problem in 3–4 connected expression steps. Each step receives the lesson's synthetic JSON inputs. The successful output of prior steps is injected into the next step as `Step1`, `Step2`, and so on for Canvas formulas; for WDL, a mock Compose action output named `Step1` is exposed as `outputs('Step1')`.
- **Two-dataset grading** evaluates your formula against the reference formula on the primary and alternate datasets. The preceding *learner* formulas are used to build the stage inputs in each dataset. A single hard-coded result will normally fail. Semantic equivalence is measured as structural JSON equality, not a textual formula match.
- **Walkthrough** reveals all reference formulas, describes why each one works, and runs every stage on a selected synthetic fixture. Each stage displays its value (and any simulated `Trace` events). It can be used independently of Challenge progress.
- **Progress** is saved locally in browser `localStorage` under a versioned key. You can reset one lesson or export your own formulas and completion record as JSON. No account, Microsoft tenant or network connector is needed.
- **Levels**: Foundation → Intermediate → Advanced → Expert → Boss. Search and platform filters narrow the library, and deep links (`learn.html#correlated-orders`) open a specific lesson.

## Curriculum

| Level | Case | Topics |
|---|---|---|
| Foundation | Prioritize a service queue | Multiple filters and stable sorting |
| Intermediate | Replenishment shortlist | Conditional row calculation and sorting |
| Intermediate | Sales-ready lead handoff | Multiple `Filter` predicates, `AddColumns`, `ShowColumns` |
| Intermediate | Expense approval flow | WDL `outputs`, `variables`, `greater`, `if`, `concat` |
| Advanced | Risky privileged accounts | Mixed OR/AND, null checks, computed scores |
| Advanced | Weighted pipeline forecast | `With`, aggregation, business target comparisons |
| Advanced | Imported contact validation | `IsMatch`, regex literals, validation chain |
| Advanced | Trace an escalation decision | Scoped calculations, `Trace` diagnostic payload |
| Advanced | Webhook gating | WDL safe access, status/identifier validation |
| Expert | Overdue exposure by customer | `As` aliases and correlated nested `CountIf`/`Sum` |
| Expert | Regional revenue leaderboard | `GroupBy`, `AddColumns`, `DropColumns`, `SortByColumns` |
| Boss | Correlated revenue exceptions | Nested join/aggregation, threshold, final DTO projection |

12 cases, 43 steps, at least two synthetic datasets per step. Each reference solution runs in the existing bounded local evaluator and is checked in `tests/learning.test.js`.

## Execution model and limitations

The static Pages site uses the bundled local evaluator in `core/evaluator.js`; the Node server serves the same modules through read-only `GET /core/evaluator.js` and `GET /core/parser.js`. Both paths provide the same **local compatibility subset**. This curriculum **does not** assert feature parity with Microsoft Power Fx or the Power Automate runtime.

- The `StepN` and `outputs('StepN')` values are **learning fixtures** and do not create actual Canvas variables or cloud-flow actions. In production, wire them to real variables, Compose actions or other inputs as appropriate.
- Trace tests compare **simulated diagnostic events**. Nothing is sent to Power Apps Live Monitor or Application Insights; real `Trace()` is only valid in behavior expressions.
- **Delegation warnings:** complex `Filter`, nested correlated queries, regex and table shaping may not delegate on Dataverse/SharePoint/SQL. The local evaluator always works on the provided small arrays and cannot reproduce data-source-specific delegation restrictions, licensing or permissions.
- Regex and Canvas/flow evaluation support only the implemented subsets; complex functions may behave differently in a genuine Microsoft environment. Consult the official references below before using examples in production.
- All mock data is fictional. The public site does not need user authentication, but you should still avoid pasting credentials, real customer records or production secrets into any browser tool.
- The solution source is shipped to the client; this is an **educational practice app**, not an exam with a secret answer server. Two datasets discourage trivial hardcoding but are not secure anti-cheat protection.

Official documentation: [Filter and LookUp](https://learn.microsoft.com/en-us/power-platform/power-fx/reference/function-filter-lookup) · [Power Fx table shaping](https://learn.microsoft.com/en-us/power-platform/power-fx/reference/function-table-shaping) · [WDL expressions](https://learn.microsoft.com/en-us/azure/logic-apps/expression-functions-reference).

## Extending the curriculum

Add a lesson in `public/lessons.js` with `id`, `title`, `level`, `platform`, `category`, `goal`, `skills`, `inputs`, `variants`, and 3+ `steps`. Every step requires `title`, `instruction`, `hint`, `why`, and an executable `solution`. Stage outputs are automatically made available to the next step. Use at least two datasets with **meaningfully different expected outputs**. Write a test for the lesson's critical edge case; `tests/learning.test.js` validates both fixtures and every step. New functions must first be supported and tested in the local evaluator.

The UI uses semantic, keyboard-accessible controls with contrast-aware Fluent-inspired styling. Screen-reader live regions announce grading results; the separate walkthrough preserves challenge answers.

## Proposed next iterations

1. **Adaptive coaching:** progressive hints, explainable error comparisons and tailored follow-up exercises after a failed stage.
2. **Delegation clinic:** distinguish locally executable logic from server-side delegable queries using source-specific reference guidance. Never imply offline warnings are runtime validation.
3. **Deterministic challenge generator:** seeded mock arrays with boundary-value variation, nulls, missing keys and larger mixed datasets to test formula robustness.
4. **Shareable challenge packs:** validated JSON import/export schema, curriculum authoring API, and community-contributed lessons reviewed in CI.
5. **Accessibility and languages:** Spanish/English toggle, further keyboard navigation improvements and stronger assistive-technology testing.
6. **Optional verified runtime comparisons:** safely compare local output with the official Power Fx interpreter for supported pure formulas (no connector writes), explicitly separate WDL.
