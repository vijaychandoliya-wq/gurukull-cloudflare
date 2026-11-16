# Release status: backend table exports (CSV / PDF / Excel)

Date: 12 November 2026 · Branch: feature/table-pdf-exports · Commit: `2b6e0f1`

## DONE — all steps executed and verified

| Step | Result |
|---|---|
| Code + 315 tests + build | passed, committed as `2b6e0f1` |
| Staging D1: migration 0037 | applied (rehearsal), 4 commands, no business data |
| Staging worker | `/health` reports `2b6e0f1…`; `/api/exports` = 401 |
| Recovery bookmark | captured **before** the apply: `/tmp/pre-apply-tt.json` · `000028ff-00005122-…` |
| Migration 0037 applied to the live D1 | done — 4 commands, 2.45 ms |
| API/portal worker deployed | version `7628a3d8-c6a2-4671-88f0-f4e980f21a06` |
| Jobs dispatcher deployed | version `2d063f8d-6d67-48cf-9061-9d3c8dea9d21` |
| Live `/health` | reports source SHA `2b6e0f1a0ecd827e2892204fd5f52cba18d1d96e` |
| Live `/api/exports` without session | 401 on `rajesh.gurukull.in` and `app.gurukull.in` |
| `verify-deployment.mjs` | `{"event":"deployment_verified","sourceSha":"2b6e0f1…"}` |

Export jobs are driven by the API worker's own `*/5` cron (`processExportJob`
and `expireExports` are registered in its scheduled handler); the jobs worker
covers the email outbox only. No school or business records were created or
changed by this release; migration 0037 is additive (one job table).

## Remaining owner confirmation (browser)

Sign in as a school administrator, open any data table (Students, Fees,
Exams, …), export all three formats (PDF / CSV / Excel) and download each.
Downloads appear under "My exports" in the same toolbar row and expire after
24 h with their private storage objects.

## Rollback (if needed)

- D1: restore the Time Travel bookmark from step 4 above; 0037 is additive,
  so the preceding worker release still runs without the table.
- Worker: redeploy the previous release SHA; pending export jobs expire in
  24 h and `expireExports` removes their private objects.
