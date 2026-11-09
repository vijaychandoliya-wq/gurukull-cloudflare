# Fees and collections: administrator flow for review

8 November 2026. Original proposal. The first implementation slice is documented in [the implementation and test report](fee-counter-test-report-2026-11-08.md); this document also describes later capabilities that are not implemented.

## The product decision

Make the default screen a fee counter: find a student, see what is due, record the money received, and give a receipt. Put creating fees, receipt numbering and reports in their own destinations. An administrator should not need to understand the database or configure the school while a parent waits at the counter.

Daily journey: **Find student → Enter payment and review → Receipt**.

Occasional journey: **Choose fee types → Create a fee plan → Review students and amounts → Assign fees**.

First-use journey: **Confirm school and year → Set invoice and receipt numbering → Create and assign the first plan**. Existing correct settings are read and acknowledged, not entered again. A school may also create a one-off charge once numbering and prerequisites are ready.

## Evidence and limits

This is a heuristic UX review of the supplied screenshot, `FeeLedgerPage.tsx`, `fee-management.ts`, `fee-parity-management.ts`, and the legacy Laravel `FeesPage.jsx`. No administrator interviews, classroom observations, live transactions or usability trials were performed. Recommendations are hypotheses to validate with school users, not research findings from interviews.

The screenshot shows a raw `FEE_STRUCTURE_NOT_FOUND` error, zero summary values, a large empty invoice table and an invoice form blocked by missing numbering policy. The exact action/request producing that error has not been reproduced. Source inspection shows:

- The page loads seven services in one `Promise.all`; one failure can prevent all screen state from updating. Initially empty invoice state can be mistaken for a successful empty result. Summary amounts currently use a dash until loaded, but existing data may remain stale after a later failure without a freshness indicator. The screenshot alone does not establish whether its zero values are correct.
- Collection is reached from a wide invoice table rather than a student search. The student option query is limited to 100 without a visible remote search flow. This is unsuitable as the only entry point for a large school.
- Financial setup and daily operations are peers in the top tabs, although their frequency and dependencies differ.
- Forms are expanded under tables, making the action and review easy to lose below the fold. Review labels expose names such as Student Id and Fee Group Id.
- A collection request currently targets one invoice. A single payment covering several fee heads requires a backend allocation/receipt change, not merely new checkboxes.
- Current APIs support cash, UPI, bank transfer, card and cheque as recorded methods. These are manual records, not payment-provider processing. A cheque-clearing lifecycle is not represented by the current collection flow.
- The invoice list and export are school-wide, while the summary and structures use the current academic year. Year/date filters must be made consistent before comparing totals.
- The bulk assignment implementation is capped at 500 eligible students per operation and immediately writes invoices. It needs preview, exact counts and resumable results before being presented as a complete school-wide operation.
- Receipts and reversals already have an immutable ledger model. Preserve it. Correction and money refund must be distinct user tasks.
- Reminder sending is unavailable in the current backend. A previous record or manually entered payment reference is not proof of message delivery or bank settlement.

## Navigation

Page name: **Fees**. Show school name and selected academic year beside the heading. Currency is visible next to money fields. No technical unit names in the product.

| Destination | Main question it answers | Primary action |
| --- | --- | --- |
| Collect fees — default | Which student is paying, and how much is due? | Find a student / Record payment |
| Fee plans | What should we charge, when, and to whom? | Create fee plan |
| Receipts | What was recorded and where is the receipt? | Search receipt |
| Reports | What is due, collected or outstanding for this period? | View/export report |
| Fee settings — header action | Is the school ready to issue charges and receipts? | Complete the next missing setup task |

Use top tabs with deep links, real page titles and clickable parent breadcrumbs. Once a student is selected, keep a short identity strip visible throughout the task: name, admission number, class/section and year. Return to student search clears the old selection. Back to fees retains the relevant filters and tab. Warn before losing an unfinished payment; completed payments are never silently resubmitted.

## First-time setup

Display one calm setup panel instead of a red empty-table screen: **“Finish fee setup to start issuing charges.”** Show completed items and one next action.

1. **School and year:** read actual school name, currency, timezone and academic year. Explain missing or conflicting values with a link to the correct setting. Do not invent a year, class, amount or fee policy.
2. **Invoice and receipt numbers:** explain “Invoice = fee charged; receipt = money recorded.” Ask whether the school is continuing an existing numbering convention. Show sample formatting from the entered prefix, digit count and next unused number. Never silently start from 1 or reset the sequence. Explain the current backend lock after the first invoice; subsequent policy changes need a deliberate controlled workflow.
3. **First fees:** select only applicable fee types and enter an actual fee plan. Prepare a student preview before assigning it. A “ready” status is based on server verification, not merely completing the UI steps.

Numbering and school configuration are required for new financial writes. Existing financial history should still be readable if setup or an ancillary report fails. Creating reusable fee-type labels can be allowed without assigning charges.

## The everyday collection flow

### 1. Find student

Default focus goes to a single field: **“Search student, admission number or parent mobile.”** Search the server; paginate results. A class/section filter is available but not required to find a known student.

Each result shows name, admission number, class/section, year and due balance. Parent phone search must use actual parent-child links, support siblings, and require the administrator to select a specific child. Similar names show disambiguating details. Do not auto-select the first match. If payment is for a past year, the year is selected explicitly and supported by its real ledger; never reclassify it as current-year income without a defined migration policy.

### 2. View dues and enter payment

Show a compact dues table with **Fee / Period / Due date / Balance / Amount to pay**. The default list contains unpaid and partially paid charges; paid/cancelled history is available separately. Show totals beside the actions, not four school-wide dashboard cards above the task.

The administrator selects the charge(s), then sees:

- **Amount received (₹):** initially the selected balance, editable for a partial payment. Show the amount remaining immediately. No unexplained paise/minor units.
- **Payment method:** visible choices for the school's enabled methods. The administrator explicitly confirms the method. Do not infer a received payment from a selected option.
- **Date received:** school-local today, editable only within permitted periods; show a reason when backdating requires it. No future-date saves.
- **Reference:** shown when the method requires it, with a relevant label such as “UPI transaction reference.” A typed reference does not mean the payment has been verified by a bank.
- **Note:** optional for routine collections in the proposed UX; require a reason only for exceptions. The current backend requires remarks, so this change requires a contract update, not a hidden filler value.

Keep student identity and “Receiving ₹… / Remaining ₹…” adjacent to the save action. Show selected fee allocation before submission. For partial payments across multiple charges, propose oldest due first with the actual allocation visible and editable; never silently use a school policy that has not been confirmed. One payment may cover several charges for one student only after the backend can commit its allocations atomically.

**Final review:** a compact confirmation with student, method, reference, allocated fees, amount received and remaining balance. Primary label: **“Record ₹2,000 and create receipt”** (illustrative amount). Back/edit is available without losing data. A busy state prevents accidental repeat actions; server idempotency still prevents duplicates.

If submission times out, show **“We could not confirm whether this payment was recorded. Check payment status.”** Reconcile the original request before offering retry; do not ask the cashier to re-enter it as a new payment.

### 3. Receipt and next student

After confirmed server commit, show receipt number, student, date/method, fee allocations, amount received and remaining balance. Actions: **Print receipt**, **Download PDF**, **Next student**. Reprinting uses the existing receipt and never creates a second collection. Printed receipts support school branding and show whether they are a reprint or corrected document where the school policy requires it.

Only show a send action if that channel is configured, the intended recipient and consent are verified, and delivery status is tracked. Do not make sending a prerequisite for completing the fee-counter task. There is no send control in the initial release if delivery remains unavailable.

## Creating and assigning fees

Use a dedicated step form, not an open form below a table:

1. **Who pays?** Academic year, classes, sections or selected students. “All classes” must be an explicit choice; an empty class field must not accidentally mean the entire school. Fee plans cover reusable tuition, transport, examination and other actual school fee types.
2. **What and when?** Plan name, fee lines and actual amount per student, billing period/installment, and due date(s). Show one installment as the simple default; add installments intentionally. Transport, hostel and optional services use actual eligibility rather than billing every student by class alone. UI support for multiple fee lines/installments requires backend extensions.
3. **Review and assign:** show number of eligible students, already-assigned students skipped, excluded/ineligible records, amount per student, total charge and numbering readiness. Show the list behind every count. Save as draft and Assign fees are distinct actions. Highlight duplicate/overlapping periods before assignment; the same fee type may legitimately recur across distinct periods.
4. **Result:** exact created/skipped/failed counts, per-record errors and safe resume. New students added later appear as “Not yet assigned.” Never report an entire school as finished after a capped batch. Existing issued charges are not silently rewritten when a plan is edited or archived.

For a one-off charge, expose **Add charge** from the selected student's ledger: fee type, amount, due date and reason. It creates a charge first; recording received money is a separate deliberate action or a clearly reviewed compound command. The UI must not represent an invoice as money received.

## Exceptions without overwhelming the cashier

| Situation | Proposed flow |
| --- | --- |
| Partial payment | Enter less than the balance; show exact allocations and remaining due before save and on the receipt. |
| Sibling concession / scholarship | Separate Apply concession action, permitted role, explicit reason and amount, policy-aware approval where required. Do not count concessions as cash. Zero-cash concessions require a dedicated backend command. |
| Two children in one family | Offer the other linked child after receipt; keep individual student allocations and receipts initially. Combined family payments require a separate reviewed capability. |
| Amount exceeds dues | Explain the excess and stop a normal collection. Do not silently discard it or create credit. Advances/refunds need explicit school policy and a credit ledger. |
| Cheque | Distinguish received, pending clearance, cleared and bounced if offered. A pending cheque must not be labelled confirmed cash. Until that lifecycle exists, do not pretend this is supported by the new flow. |
| Wrong payment entry | Find the receipt → Correct entry → show original vs replacement, reason, authorized review and impact → retain the original, reversal and replacement. |
| Refund requested | Separate from correcting a receipt. Track a separately authorized refund and its real disbursement; a ledger reversal alone does not return money. |
| Cancel an unpaid charge | Show reason and impact; preserve its number/history. Paid/concession-bearing records follow the appropriate correction workflow. |
| Previous-system arrears | Guided migration under Fee settings with source date/reference and reconciliation. Historical money already paid is not today's collection. |
| Network failure / concurrent cashier | Preserve entered fields, refresh authoritative balance/version, explain the change and prevent duplicate commits. |

Initial permissions: school owner/authorized administrator configures plans, numbering and corrections; a proposed cashier role collects and reprints within granted scope; viewers read approved reports. New cashier/approval permissions need server support. UI visibility is not authorization. Audit actor, school, student, time and reason for financial exceptions.

## Reports a school owner can understand

Default the collection register to school-local today and show date range/year beside every total. Provide receipts by method/collector, student ledger, class-wise outstanding and overdue lists, concessions and corrections. Saved-number counts, net collections and cash-on-hand are different measures.

For one billing scope: **Closing dues = opening dues + new charges − concessions − allocated net receipts ± approved charge adjustments**. Avoid double-counting imported opening invoices. Show cancelled/reversed activity as explicit adjustments with drill-down history. Actual cash/bank reconciliation needs the school's real account/settlement model; a manual UPI entry is not proof of bank credit. Close-of-day should remain a review/export until accountable cash reconciliation and period locking exist.

## UX system and language

- Ant Design top tabs for peer destinations, Steps only for setup and fee assignment, a focused student payment page, compact confirmation Modal and Result for the saved receipt. Avoid nested drawers and full forms embedded under tables.
- Use familiar labels: Fee type, Fee plan, Charges, Record payment, Money received, Remaining balance. Keep “invoice” and “receipt” in documents and explanatory help, not raw ID column names.
- Each table shows about six useful columns initially. Extra fields are in details. Currency is in the heading/amount fields rather than a repeated INR column on every row.
- Remove the permanent instructional banner from the daily counter; keep a short inline note at the payment action that it records money received. Help should be contextual and expandable.
- In dark mode use readable text, quiet surfaces and clear focus states. Financial values are right-aligned with consistent Indian currency grouping. No color-only status. Desktop keyboard flow and a stacked mobile form must both work.
- Centralize all new strings, support the chosen portal language including after login, and test Hindi labels for expansion. User-provided student names and financial references remain unchanged.
- Empty, loading, failed and zero are different states. Failed reports show “Could not load,” never ₹0.00. Keep last refreshed time if displaying old data. Failures in Fee plans or Reminders must not erase a usable student ledger.

## Error examples

| Current symptom | Proposed message and action |
| --- | --- |
| Missing numbering | “Set invoice and receipt numbers before issuing your first charge.” → Set up numbers. |
| Missing plan | “This fee plan could not be found. It may have been archived or changed.” → Reload fee plans. Investigate the actual failing request before assigning this explanation to the screenshot. |
| No assigned charge | “No fees are assigned to this student for this year.” → Assign a fee plan / Add a charge. |
| Overpayment | “Amount received is ₹500 more than the selected balance. Reduce it or use the approved advance workflow.” |
| Missing non-cash reference | “Enter the UPI transaction reference so this entry can be reconciled.” |
| Concurrent edit | “Another payment changed this balance. Review the updated amount before saving.” |
| Failed confirmation | “Payment status is not confirmed yet. Check status before trying again.” |

Show a summary near the primary action and field-specific errors at the field. Preserve input, jump to the relevant field, and carry a support reference in expandable details.

## Build sequence after design review

1. Verify the screenshot error and fix isolated loading, true empty/failed states and year-scope consistency. Preserve existing ledger records and API contracts.
2. Ship the student-first single-invoice counter with fast remote search, explicit identity, human-readable review, confirmed receipt view/print, safe retry and partial payment. This can improve daily use before multi-invoice capability is ready.
3. Add the setup guide and reviewed fee-plan assignment with exact preview/counts, safe bulk jobs and duplicate checks.
4. Extend payment allocation to several invoices, printable combined receipts and any required approval/cashier roles. Migrate additively, test atomicity/concurrency and parent/app compatibility.
5. Add daily registers, consistent exports and isolated genuine-record reconciliation. Enable cheque lifecycle, advances, refunds or reminders only after each corresponding workflow is implemented and verified.

## Validation before calling it easy or complete

Use a clickable prototype first with 3–5 representative staff across cashier, administrator and school owner roles. Proposed tasks: first fee setup; class assignment; find a child from a shared parent number; cash full payment; UPI partial payment; two fee heads; concession-only case; reprint; correct a mistake; check today's collections and dues. Capture unaided completion, wrong-child selections, misinterpreted totals, navigation reversals and confidence. These are planned tests, not completed research.

Proposed acceptance targets: a practiced ordinary single-student collection within 45 seconds excluding payment exchange; no uncorrected wrong-student or amount errors; no unexplained technical messages; unchanged original receipt on reprint/correction; no duplicate collections after retries; all totals reconcile to the approved ledger. Finalize time targets after observing current staff and realistic data volumes.

Verify current and past years, new/inactive students, sibling mobile reuse, large rosters, class/optional service eligibility, slow requests, simultaneous cashiers, permission loss, keyboard-only operation, Hindi, mobile, light/dark, A4/receipt PDF and parent-visible balances. Use actual approved isolated records for persisted finance tests. The illustrative prototype uses only in-memory sample values and makes no financial writes.

## Decisions for owner review

Recommended starting position: student-first default; daily collection in three stages; four top tabs; numbering in setup; concessions/corrections separate; backend multi-invoice allocation in a later verified slice. Confirm school practices for monthly/term/annual installment dates, partial-payment allocation, allowed concessions and approvers, cheque acceptance, past-year collection, and receipt paper size before implementing those policy-dependent parts.

Design references: Ant Design's [form page principles](https://ant.design/docs/spec/research-form/) and [data-entry guidance](https://ant.design/docs/spec/data-entry/) support clear task segmentation, familiar labels, contextual help and review before submission. This proposal uses those principles with Gurukull's observed financial rules.
