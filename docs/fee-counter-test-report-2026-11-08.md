# Fee counter implementation and test report

8 November 2026. Branch: `feature/student-fee-counter`. Status: implementation for review; not deployed.

## Implemented scope

This implements the first three build stages of the [reviewed flow](fee-collection-ux-review-2026-11-08.md): an initial counter for one charge per payment, separate setup, and reviewed assignment. It does not certify the whole future finance roadmap.

- Four top tabs: Collect fees, Fee plans, Receipts and Reports. Fee settings opens separately. Each view loads independently; a failed plan/report request does not clear the counter.
- Search current-year students on the server by name, admission number or linked parent mobile, with pagination and explicit student selection. Literal searches support long Unicode names without D1's LIKE pattern length restriction. Parent joins remain school scoped.
- Select an outstanding charge, enter full or partial money received, choose a method/date, provide a non-cash reference, review the exact amount and remaining balance, then deliberately record the collection. Paid/cancelled charges are available under All charges.
- Routine notes are optional; concessions with a payment require a reason. Amounts remain integer currency units internally and appear in the school's major currency in the UI. New counter payments exclude cheque because clearing is a separate capability.
- A single in-flight payment is locked to its original body/idempotency key. Timeout recovery can query the command result or repeat that same command. Recovery is retained in sessionStorage for that browser tab, school and administrator; it contains no password, bearer token or student name. It is not recovery after closing the tab or clearing storage.
- Display/reopen an existing server receipt and prepare a separate A4 print document, without the portal's ID-card print styles or navigation. The current balance is labelled as current, rather than falsely represented as the historical balance at issue. Browser Print / save PDF remains one action, rather than a separate generated-PDF service.
- Settings guide the administrator through actual school/year, numbering and plans. Existing invoice numbering locks are respected. Opening balances are clearly separated from new cash collections.
- Create a fee plan in steps, with explicit class/section or all-classes selection, then separately review the eligible roster before assignment. A batch is at most 500 students; the remaining count is disclosed. Count, version and the exact next batch are guarded inside the D1 transaction. Unconfirmed assignment retries preserve the reviewed body and key. Imported opening balances cannot be assigned to a whole class.
- Preserve unpaid-charge cancellation, immutable reversal/replacement corrections, and current-year summary/major-currency CSV export. Fixed an existing replacement-receipt INSERT/SELECT column mismatch. No schema migration or changes to supported parent-app response contracts.

All reads and mutations still require existing authenticated school permissions. New features use the shared API and tenant-bound D1 database; no per-school code copy or setup records are created.

## Verification performed

| Check | Result | Evidence |
| --- | --- | --- |
| Full existing and new automated suite | Passed: 322 tests, 54 files | `npm test -- --coverage` |
| Worker/workspace types | Passed | `npx tsc --noEmit` |
| Import-tool types | Passed | `npx tsc -p tools/import/tsconfig.json --noEmit` |
| Portal TypeScript and production build | Passed | `npm --prefix apps/portal/source run build` |
| Theme structure/tokens | Passed | `node tools/verify-portal-theme.mjs` |
| Built asset origins | Passed | `node tools/verify-portal-build.mjs` |
| Production dependency audits | Passed: zero reported vulnerabilities | Root and portal `npm audit --omit=dev --audit-level=high` |
| Production Worker packaging | Passed; no upload | Wrangler deploy with production config and `--dry-run` |
| Whitespace check | Passed | `git diff --check` |
| Browser access | Blocked | CUA returned: “Local browser use is disabled in Work settings” |
| Real school collections and reconciliation | Not run | No school money or ledger rows were created for testing |
| Real browser PDF/physical receipt output | Not run | DOM print-document assertions are not physical print acceptance |
| Exact-commit SonarQube/release approval | Not run for this branch | Required before production promotion; not bypassed |
| Production domains | Not updated by this task | Branch remains separate from main |

The default repository coverage manifest selects older files explicitly and currently excludes the new fee modules. Its 86.88% line figure is **not fee-module coverage**, and the passing suite is not proof of a complete real-data finance journey. Tests use unpersisted mocked responses or an empty migrated in-memory schema. The bundle-size warning and existing wildcard asset-route warning remain; neither was suppressed.

## New automated cases

| ID | Scenario and observed expectation | Test |
| --- | --- | --- |
| FC-01 | Tenant/year search and invoice SQL execute against the full empty migrated schema; receipt replacement SQL prepares | `workers/api/test/fee-counter.spec.ts` |
| FC-02 | Search wildcard characters remain literal and parent joins use the student's school | Same |
| FC-03 | Setup access permits only exact read routes, not forged mutations/subpaths | Same |
| FC-04 | Anonymous student search, command lookup and assignment preview return 401 | Same |
| FC-05 | Human CSV values use major currency and spreadsheet formulas are neutralized | Same |
| FC-06 | Assignment review requires version, count and exact batch together | Same |
| FC-07 | Optional routine note accepted; concession reason and non-cash reference required | Same |
| FC-08 | Counter loads independently; a failed plan request shows an understandable error | `FeeLedgerPage.test.tsx` |
| FC-09 | Partial payment shows remaining balance; API write occurs only after confirmation | `fees/FeeCounter.test.tsx` |
| FC-10 | Timeout retries preserve the exact original key/body | Same |
| FC-11 | Reopening restores an unconfirmed command and status recovery opens its receipt without another POST | Same |
| FC-12 | Overpayment is stopped before confirmation or a write | Same |
| FC-13 | UPI requires a real reference and does not submit a missing one | Same |
| FC-14 | Review discloses 700 eligible / 500 per batch and requires confirmation | `fees/FeeWorkspaces.test.tsx` |
| FC-15 | Opening-balance plan assignment is disabled | Same |
| FC-16 | Unconfirmed bulk retry retains the exact reviewed batch/key | Same |
| FC-17 | Existing locked numbering displays its actual next number without reset fields | Same |
| FC-18 | Report failure displays unavailable data rather than zero money | Same |
| FC-19 | Existing receipt reopens without a collection POST | Same |
| FC-20 | Print document contains the receipt, escapes school-entered content, excludes portal navigation and cleans up afterprint | Same |

## Review and release checks still needed

1. Enable browser use in Work settings, then verify the actual authenticated Fees UI in light/dark, narrow/mobile widths and keyboard navigation. Check field errors, modals, tab deep links and receipt Print / save PDF. No screenshots of the new implementation have been claimed.
2. Use approved genuine isolated school records for full/partial cash and UPI collections, simultaneous cashiers, stale-balance rejection, same-key replay, rollover/revocation, correction and exact ledger/number reconciliation. Do not invent a payment merely to pass a test.
3. Validate a genuine class assignment across the 500 boundary, roster changes between preview/commit, retries and opening-balance exclusion in the Workers/D1 runtime. Empty-schema SQL and mocked UI results do not prove these writes.
4. Complete fee-specific coverage and exact-SHA SonarQube/CI review before merging/promoting. Run the existing protected production release path and verify domains after any authorized deployment.

## Remaining later capabilities

Combined payments/receipts across several invoices, concession-only commands, selected-student/optional-service eligibility, multiple fee lines/installments, past-year collection selection, standalone downloadable PDF generation, dedicated cashier/approval roles, daily/method/collector/class reports, bank/day-close reconciliation, cheque clearance, advances, refunds and reminder delivery remain later stages. They require actual school policy and backend lifecycle work, and are not shown as supported controls here. Core labels use the existing localization lookup with additional Hindi copy; all new explanatory text has not been translated into every supported language.

## Follow-up — 9 November 2026

The mobile header was released independently in main commit `ab8008d`; its four school/app domains were checked again and return that SHA. Browser control still reports disabled in Work settings.

The fee draft is rebased by merge on the released main. Its CSV protection now scans leading control bytes by numeric character code rather than a regex control-character range flagged by SonarQube rule S6324. The focused fee suite passes 8 tests, including a new case covering NUL, unit separator, tab, carriage return, Unicode whitespace and ordinary quoted text. Worker TypeScript and whitespace checks pass. This update does not establish a new successful SonarQube gate or full financial acceptance; the fee draft is still not deployed. The previous exact-commit gate measured new-code coverage at 53.2% versus a required 80%.
