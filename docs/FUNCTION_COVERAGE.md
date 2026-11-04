# Power Fx Playground — function coverage matrix (v0.7.0)

> **No claim of 100% Power Fx / Power Automate coverage.** A function being parsable, selectable, or present in a test suite does not establish parity with a Microsoft Power Apps tenant, with delegation, or with platform-specific side effects.

## Execution profiles

| Profile | Runs where | Scope | Status |
| --- | --- | --- | --- |
| Canvas local compatibility | GitHub Pages and Node | Selected Power Fx expressions over finite mock JSON | Tested subset |
| Canvas official interpreter | Optional .NET host, locally installed | `Microsoft.PowerFx.Interpreter` and its provided functions | Opt-in; not available on public Pages |
| Cloud flow local WDL | GitHub Pages and Node | Selected Workflow Definition Language expressions with mock action outputs | Tested subset |
| Live Power Apps / cloud flows | Microsoft tenant | Connectors, actions, controls, environment variables, remote delegable queries | **Not executed** |

## Verified advanced Canvas features

| Feature | Examples | Coverage status | Key constraints |
| --- | --- | --- | --- |
| `With` | Inline records, nested scopes, shadowing, error handling, `With(Match(...))` | Local evaluator + regression tests | Scope approximation; real connector actions excluded |
| `Trace` | Severity and custom record, sequence chaining, scoped tracing | **Simulated** event returned in `traces` | Real Canvas behavior formula only; no Live Monitor / App Insights transmission |
| `IsMatch` | Email, ticket validation, case insensitive, contains, begins/ends | Local regex compatibility | Constants only, bounded pattern and input size; not full .NET regex parity |
| `Match` / `MatchAll` | Named groups, numbered groups, offsets, multiple matches, missing matches | Local regex compatibility | Unsupported regex features rejected; results capped |
| `Filter` / `CountIf` / `LookUp` | Multi predicates, nested scopes, alias `As`, reductions | Local mock array simulation | No remote delegation, live connector semantics, or real data sources |
| `AddColumns` / `Distinct` | Computed columns, uniqueness | Local table simulation | Client-only in-memory JSON; no mutation or remote data updates |
| `Search` / `ShowColumns` / `DropColumns` | Text search, privacy projections | Local table simulation | Selected column expressions only |
| `Sequence` / `Index` / `IsEmpty` | Number series, table row lookup, empty result | Local table simulation | Sequence limited to 1,000 entries |
| `ForAll` | Row projection, regex extraction | Local table simulation | No concurrency/side effects/connector calls |
| `GroupBy` / `Ungroup` | Region-by-status nested records, aggregate regional revenue, filtered group export | Bounded local table simulation | Input order preserved within each group; global interleaving may change when ungrouped |
| `RenameColumns` | CRM/API schema remapping, multiple column renames, collision checks | Bounded local table simulation | Uses mock JSON schema; column identifiers and legacy string names supported |
| `SortByColumns` | Multiple sort keys, stable ties, custom ordinal lists | Bounded local table simulation | No connector delegation or culture-aware production collation parity |
| `Sort` / aggregation | Row aliases, nested `Sum` and `With` | Local table simulation | No delegation or locale-specific collation guarantees |
| Chaining `;` | `Trace(...); If(...)` | Local subset | Does not model all locale-dependent behavior grammar |

Each function advertised by the interactive local function catalog is covered by a successful sample or standalone `tests/function-catalog-coverage.test.js` test. This is **catalog coverage**, not exhaustive coverage of every Power Fx function or every argument/edge case.

## Important differences

- **Power Fx vs WDL:** Power Automate cloud-flow expressions use Workflow Definition Language. A `concat()` in WDL is *not* necessarily equivalent to a `Concatenate()` or `&` formula in Canvas.
- **Trace:** The playground can emit a JSON event with `message`, `severity` and `customRecord`. It cannot access Live Monitor, Test Studio or Application Insights. Real Power Apps only supports Trace in behavior formulas.
- **Regex:** Microsoft Power Fx uses a restricted regex vocabulary, with distinctions between different hosts and compatibility switches. The playground uses a bounded, intentionally narrower JavaScript-based implementation and does not execute unsupported features; verify edge cases with official tooling.
- **Scope detection:** Free variables inside unaliased row formulas are ambiguous. Prefer aliases (`Filter(Orders As o, o.Total > Threshold)`) so the playground can distinguish table columns from external inputs.
- **Delegation:** No local JSON evaluator can establish whether a formula delegates to SQL, SharePoint or Dataverse. This requires connector-aware analysis and, for some checks, tenant configuration.

## Prioritized uncovered families

1. **Higher-order table operations:** `GroupBy`, `Ungroup`, `SortByColumns`, and `RenameColumns` now have bounded local mocks; next: `Patch` (pure preview vs real mutation), `AsType`, `IsType`, `Choices` and `ForAll` limits.
2. **Error semantics:** `Error`, `IsError`, `AllErrors`, `FirstError`, richer `IfError`, error records and native SDK checks.
3. **Dates/time zones:** `Date`, `DateAdd`, `DateDiff`, `DateValue`, `Time`, `TimeZoneOffset`, ISO conversion and daylight-saving tests.
4. **Text and modern data:** `ParseJSON`, typed conversions, `JSON`, string interpolation, `GUID`, `EncodeUrl`, `Char`, `UniChar`, `Find`, `Extract` and text splitting rules.
5. **Color/media/control functions:** `ColorValue`, `RGBA`, `Image`, `PDF`, `Self`, `Parent`, controls and canvas layout dependencies.
6. **Behavior and state:** `Collect`, `ClearCollect`, `Patch`, `Set`, `UpdateContext`, `Notify`, `Navigate`, `Launch`, `Concurrent`, `SaveData`, `LoadData`, `RemoveIf`; these need sandboxed **state semantics**, and some require a real app/tenant.
7. **External integration:** Power Platform connectors, environment variables, AI functions, Dataverse-specific functions, SQL delegation. These cannot be made genuinely executable in a static playground without explicit integrations.
8. **Localization and parsing:** decimal separators, record separators, full Power Fx syntax forms, `As` scope warnings and a versioned parser compatibility profile.

## Test strategy

- `tests/scenarios.test.js`: Every scenario must parse, resolve its supplied mock context and match its expected output.
- `tests/advanced-powerfx.test.js`: Advanced function tests, nesting, aliases, scoped behavior, unsupported patterns, security boundaries, error cases.
- `tests/function-catalog-coverage.test.js`: Every function advertised as runnable must be exercised by a sample or dedicated case; missing coverage fails CI.
- `tests/browser-bootstrap.test.js`: Bundled browser entry must initialize and render the actual library count.
- `npm test`: All tests plus compiled browser bundle freshness check.

## Microsoft documentation

- [Power Fx formula reference (Canvas)](https://learn.microsoft.com/en-us/power-platform/power-fx/formula-reference-canvas-apps)
- [With](https://learn.microsoft.com/en-us/power-platform/power-fx/reference/function-with)
- [Trace](https://learn.microsoft.com/en-us/power-platform/power-fx/reference/function-trace)
- [IsMatch, Match, MatchAll](https://learn.microsoft.com/en-us/power-platform/power-fx/reference/function-ismatch)
- [Regex in Power Fx](https://learn.microsoft.com/en-us/power-platform/power-fx/regular-expressions)
- [Filter, Search, LookUp](https://learn.microsoft.com/en-us/power-platform/power-fx/reference/function-filter-lookup)
- [Workflow Definition Language function reference](https://learn.microsoft.com/en-us/azure/logic-apps/expression-functions-reference)

## v0.7 table-shaping implementation notes

- Schema names may use modern identifiers (`Region`, `Rows`) or quoted legacy names (`"Region"`). The analyzer does not ask for these as free inputs.
- `GroupBy`/`Ungroup` work only over supplied, bounded JSON arrays. Group membership and order are predictable locally, but there is no remote delegation.
- `SortByColumns` evaluates string/number ordering in JavaScript, optionally with `SortOrder` or custom order arrays. It is **not** a guarantee that SQL/Dataverse/SharePoint will sort identically.
- Use **Library QA** for deterministic regression tests of the bundled synthetic scenarios. Green checks do not prove live Microsoft tenant parity.
- `tests/table-shaping.test.js` covers grouping, scope, immutability, column aliases, schemas, limits, stable sorting and key-order-independent JSON assertions.

Microsoft sources: [GroupBy and Ungroup](https://learn.microsoft.com/en-us/power-platform/power-fx/reference/function-groupby), [Sort and SortByColumns](https://learn.microsoft.com/en-us/power-platform/power-fx/reference/function-sort), [table shaping](https://learn.microsoft.com/en-us/power-platform/power-fx/reference/function-table-shaping).
