# Power Fx Playground & Expression Tester

A standalone, open-source web portal for testing **Power Apps Canvas Power Fx** formulas and **Power Automate cloud-flow WDL** expressions against controlled mock data. Its repository and deployment are entirely independent from Canvas App Visualizer.

> **Accuracy notice:** Power Automate cloud-flow expressions are **Workflow Definition Language (WDL)**, not Canvas Power Fx. The Node evaluator is a deliberately limited compatibility layer. When the optional .NET service is enabled, Canvas formulas are evaluated by Microsoft's actual `Microsoft.PowerFx.Interpreter`, pinned to version 1.8.1. The local subset is not a fidelity guarantee for the live Power Platform runtime.

![Node](https://img.shields.io/badge/Node.js-20%2B-blue) ![.NET](https://img.shields.io/badge/.NET-8%20optional-purple) ![License](https://img.shields.io/badge/License-MIT-green)

## New in v0.7.0 — Compatibility Lab

- **99 executable scenarios** (69 Canvas Power Fx and 30 Power Automate WDL), including 18 new realistic table-shaping cases.
- **`GroupBy`, `Ungroup`, `RenameColumns`, and `SortByColumns`** are now supported in the **bounded local Canvas evaluator**, with single/multi-column grouping, stable multi-column sorting, custom business priority ordering, and scoped grouping/aggregation examples.
- The new **Library QA** tab runs every bundled scenario or a selected subset with its own synthetic JSON inputs and expected result; it shows progress, failures, and downloadable JSON reports. It always selects the local evaluator, even with an optional native backend configured.
- Assertions now compare JSON records **structurally**, ignoring object property insertion order while preserving array ordering; invalid, missing and dangerous schema column names are rejected.
- Sorting caches column values once per row. Nothing communicates with a Power Platform tenant; delegation, network connectors and side effects are **not** validated.

See [Function Coverage](docs/FUNCTION_COVERAGE.md) and [Roadmap](docs/ROADMAP.md). These features represent a compatibility subset, not parity with Microsoft Power Fx.

## Advanced Power Fx coverage (v0.6.0)

The next milestone introduces **81 runnable mock scenarios** (Canvas + cloud-flow WDL), 43 advanced semantics tests, and a catalog coverage test ensuring **every runnable function listed in the interactive reference has an exercised path**. This is **not full Power Fx language or runtime coverage**.

- Added `With` record scopes, nested scopes and alias `As`, including `With(Match(...))`.
- Added `Trace(message, TraceSeverity, CustomRecord)` simulation and a dedicated trace-event panel. **No** telemetry is sent to Live Monitor or Application Insights; in real Canvas apps, `Trace` is behavior-only.
- Added `IsMatch`, `Match`, `MatchAll`, named regex captures, match options and stringent local input/pattern bounds; JS compatibility is intentionally narrower than Microsoft Power Fx regex.
- Added multi-predicate `Filter`, nested correlated `CountIf`, table `AddColumns`, `Distinct`, `Search`, `ShowColumns`, `DropColumns`, `Sequence`, `Index`, and `IsEmpty`.
- Enabled local function catalog and editor completion, JSON tree output, CSV export with spreadsheet-formula escaping and batch regression suites.
- Added regression coverage for formula error paths and unsupported regex syntax.

**[Full compatibility matrix and prioritized gaps](docs/FUNCTION_COVERAGE.md)** · [Microsoft Power Fx function reference](https://learn.microsoft.com/en-us/power-platform/power-fx/formula-reference-canvas-apps).

## Workbench UI (v0.6.0)

The UI now follows the same **Fluent-inspired developer workbench** visual language as [Canvas App Visualizer](https://github.com/ECas95/canvas-app-visualizer), while remaining an independent repository and deployment.

- Three-pane layout: searchable scenario explorer, syntax-highlighted formula editor and result inspector, context input/test/help inspector.
- Canvas Power Fx and cloud-flow WDL mode switcher (no false interchangeability claims).
- Dynamic JSON inputs, expected-output assertions, JSON/record-table results, run history, import/export.
- Responsive layouts; keyboard shortcuts: `Ctrl/Cmd+Enter` to run, `/` to search examples, `Tab` for editor indentation.
- Local-first, safe expression evaluation — no real connectors or Microsoft tenant actions.

## New in v0.4.1 — large JSON inputs and realistic scenario library

- **Resize JSON input fields vertically:** drag the bottom-right handle. Fields now start between 160 and 360 pixels tall based on their JSON contents, without a fixed maximum.
- **Expand** beside any input opens a large editor with syntax-friendly monospaced formatting, JSON validation, and **Format JSON / Apply changes**. Use **Ctrl+Enter** to apply; **Esc** closes without applying. The expected-output JSON has the same expanded editor.
- **81 executable scenarios** across Power Apps Canvas Power Fx and Power Automate cloud-flow WDL, grouped by business use case and searchable by title, formula or description; complexity filter: Basic / Intermediate / Advanced.
- Scenarios include sales/CRM qualification, risk thresholds, backlog SLAs, inventory replenishment, invoice collections, shopping carts, multi-level approvals, retries, HTTP responses, JSON parsing and workflow outputs. All use synthetic records, not live connector data.
- Every scenario has a tested **expected JSON output**. `tests/scenarios.test.js` checks parsing, required mock inputs and output assertions. The currently supported syntax is limited to the local evaluator subset; **these fixtures are not a claim of parity with Microsoft Power Fx or WDL**.
- Switching examples or importing saved JSON now resets obsolete field DOM before rendering new mock values, preventing the previous scenario's inputs from leaking into the new scenario.

## Quick start (no dependencies)

```bash
node --version   # Node 20+
npm start
```

Open **http://localhost:4173**. The portal immediately works with local Canvas/WDL subsets, no Azure, connectors, tenant credentials, subscription, or npm install needed.

### Enable the official Power Fx SDK for Canvas formulas

Install the **.NET 8 SDK**, then open two terminals:

```bash
# Terminal A — host the official Power Fx engine on localhost
dotnet run --project native/PowerFx.Api

# Terminal B — serve the browser UI and proxy Canvas evaluation
# PowerShell:
$env:POWERFX_NATIVE_URL="http://127.0.0.1:5196"
npm start
```

For bash/Linux/macOS:

```bash
POWERFX_NATIVE_URL=http://127.0.0.1:5196 npm start
```

The Node application proxies Canvas evaluations to the native .NET service. **WDL continues to use the local bounded evaluator.** The dotnet service is optional and was included as a source integration; check its build status in GitHub Actions before deploying because native compilation cannot be validated in this distribution environment.

## Core features (v0.6)

- Responsive browser expression editor for Canvas and cloud flows.
- Auto-detect top-level variables, `variables('name')`, `outputs('step')`, `body('step')`, `items('loop')`, `parameters('name')`, `triggerBody()`, etc.
- Editable mock inputs supplied as JSON, including records, tables, strings, numbers, arrays, booleans and nulls.
- Structured result, type, execution time, and table preview for arrays of records.
- Optional JSON expected-value assertion (pass/fail).
- 81 runnable examples; expression history stored **only in the browser's localStorage**; import/export scenarios as JSON.
- Keyboard shortcut **Ctrl+Enter** to execute.
- Unit test suite (`npm test`), GitHub Actions Node test + .NET build.
- Node host uses no third-party runtime packages. No `eval`, `new Function`, arbitrary JS or network connector execution in the evaluation layer.

### Implemented local Canvas subset

`With`, `Trace` (simulated), `IsMatch`, `Match`, `MatchAll`, `StartsWith`, `EndsWith`, `AddColumns`, `Distinct`, `Search`, `ShowColumns`, `DropColumns`, `Sequence`, `Index`, `IsEmpty`, `If`, `IfError`, `Switch`, `Blank`, `IsBlank`, `IsBlankOrError`, `Coalesce`, `Filter`, `LookUp`, `CountIf`, `ForAll`, `Sum`, `Average`, `Min`, `Max`, `CountRows`, `First`, `Last`, `FirstN`, `LastN`, `Sort`, `Table`, `Len`, `Left`, `Right`, `Mid`, `Trim`, `Lower`, `Upper`, `Value`, `Text`, `Substitute`, `Concatenate`, `Round`, plus selected operators, record/table literals, and dot notation. **Not all Canvas semantics are replicated**, especially connectors, scoping, delegation, side effects, locale-specific decimals, and identifiers inferred within row scopes.

### Implemented local flow subset

`concat`, `if`, `equals`, `and`, `or`, `not`, `greater`, `less`, `add`, `sub`, `mul`, `div`, `mod`, `pow`, `coalesce`, `empty`, `int`, `float`, `bool`, `string`, `json`, `contains`, `createArray`, `first`, `last`, `length`, `substring`, `split`, `join`, `replace`, `toLower`, `toUpper`, `variables`, `parameters`, `outputs`, `body`, `actions`, `items`, `triggerBody`, `triggerOutputs`, `item`, and selected other functions. The official cloud flow runtime is **not embedded**. No side effects or real action execution.

## GitHub Pages: independent web portal (free, static mode)

The project includes `.github/workflows/pages.yml`. Once the repository owner enables **Settings → Pages → Build and deployment → Source: GitHub Actions**, the workflow publishes the `dist/` bundle on `https://ECas95.github.io/powerfx-playground/`. This URL is a **planned destination, not proof that GitHub Pages has already been enabled**.

```bash
npm test
npm run build:pages
```

The static portal evaluates expressions **in the browser** with the bounded Canvas/WDL subsets; it never calls tenant resources and **does not** run the official Microsoft interpreter. For the official SDK, run the optional .NET backend behind Node on your own host. Both deployment modes are isolated from Canvas App Visualizer.

Scenario JSON can be imported or exported and expected-value assertions can be checked. Do not paste production credentials, tokens, or confidential records into public playgrounds or browser storage.

## API

`POST /api/analyze`

```json
{
  "platform": "flow",
  "formula": "@concat('Hi ', variables('firstName'))"
}
```

```json
{"valid": true, "inputs": [{"key": "variables:firstName", "kind": "variables"}]}
```

`POST /api/evaluate`

```json
{
  "platform": "canvas",
  "formula": "If(Amount > 1000, \"High\", \"Low\")",
  "inputs": {"Amount": 1234},
  "expected": "High",
  "locale": "en-US"
}
```

```json
{
  "success": true,
  "platform": "canvas",
  "engine": "local",
  "value": "High",
  "valueType": "Text",
  "elapsedMs": 0.5,
  "assertion": {"passed": true, "expected": "High"}
}
```

`GET /api/status` reports which evaluators are running.

### Why WDL mock inputs have names like `variables:customerName`

They are **sandbox-only namespaces** for external runtime references. For example, `@variables('x')` reads a JSON input named `variables:x`. `@outputs('Compose')?['body']` reads the value of `outputs:Compose`, then `body`. Nothing is fetched from Azure.

## Architecture

```text
Browser UI (public/)
   | POST /api/analyze        → Parser + dependency discovery
   | POST /api/evaluate       → Platform router (src/server.js)
                                  ├─ Canvas local: bounded JS subset
                                  ├─ Canvas native (optional): .NET Power Fx RecalcEngine
                                  └─ Flow: bounded JS WDL subset

Canvas App Visualizer (separate repository; no changes)
                                  ⇢ future opt-in import/export of scenarios
```

## Roadmap

1. AST-driven input type inference; Power Fx name resolution for row scopes and controls.
2. Power Fx SDK compile diagnostics, errors with spans, IntelliSense via Language Server Protocol.
3. Authored test-case suites (`.powerfx-tests.json`) with batch runner / CI results.
4. Real reference/locale rules, richer Power Fx functions, and WDL specification coverage + differential tests.
5. Safe importing of Canvas YAML / `msapp` formulas (read-only) from Visualizer, not shared state.
6. Mock connector schemas, Dataverse records / delegated operations, mock control property values.
7. Diff viewer comparing two expressions, visual trace and debugging variable inspector.
8. Versioned community function catalog and examples with contributions.

## Security and privacy

No tenant authentication or connector access; use mock data only. The browser stores a **local history** of formulas and input values until cleared; avoid putting real credentials/PII in tests. Never expose the .NET native engine to the public internet without authentication, execution quotas, and isolated sandboxing. API expression lengths capped at 12,000 characters, simple row/depth limits, but this is a **development tool, not a hardened public multitenant execution service**.

## Publishing a new GitHub repo

The GitHub connector used to build this package cannot create a new repository. Create an empty `powerfx-playground` repository in your own GitHub account (do not create README/LICENSE files), then from the extracted project root:

```bash
git init
git add .
git commit -m "feat: initial Power Fx Playground portal and expression test engines"
git branch -M main
git remote add origin https://github.com/YOUR_USER/powerfx-playground.git
git push -u origin main
```

Then optionally configure GitHub Pages/static deployment **only for the UI if an API host is provided**. Because the editor uses `/api/*`, GitHub Pages alone cannot run the application; deploy the Node service to a Node-compatible host, or adapt the frontend to a static browser-based evaluator in a later release.

## Upstream references

- [Microsoft Power Fx language](https://github.com/microsoft/Power-Fx)
- [Microsoft Power Fx host samples](https://github.com/microsoft/power-fx-host-samples)
- [Power Automate / Logic Apps expression reference](https://learn.microsoft.com/en-us/azure/logic-apps/expression-functions-reference)
- [Power Fx locale rules](https://learn.microsoft.com/en-us/power-platform/power-fx/global)

This is a community project and is not affiliated with or endorsed by Microsoft.

## Browser startup reliability (v0.4.1)

The 81 scenarios are now compiled with the workbench into a single browser script (`public/workbench.js`) via `npm run build:client`, eliminating a separate ES-module load before scenario rendering. The app renders the scenario explorer before asynchronous checks; the boot guard reports failures instead of leaving a silent empty panel. The previous missing DOM helper was fixed. The regression test uses an isolated DOM simulation to confirm all scenario buttons render at boot.

When editing `public/app.js` or `public/scenarios.js`, regenerate the browser bundle (`npm run build:client`). The `npm test` command verifies bundle freshness.
