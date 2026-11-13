# Release status: backend table exports (CSV / PDF / Excel)

Date: 12 November 2026 · Branch: feature/table-pdf-exports · Commit: `2b6e0f1`

## Verified in this session

| Check | Result |
|---|---|
| Full test suite | 315/315 passed (52 files), including new xlsx workbook test |
| Worker typecheck (`tsc --noEmit`) | clean |
| Portal build (`tools/release/build-portal.mjs`) | clean |
| Staging D1: migration 0037 | applied, 4 commands, no business data |
| Staging worker deploy | `https://gurukul-worker-api-staging.gurukull.workers.dev` · version `528b141c-51b2-4b3d-833b-a18a354b79f3` · `/health` reports source SHA `2b6e0f1…` |
| Staging `/api/exports` without session | 401 (endpoint live and auth-protected; 404 before this deploy) |
| Production recovery bookmark | captured before the migration apply: `/tmp/pre-apply-tt.json` · `000028ff-00005122-…` |
| Production D1 state | latest applied migration is 0036; 0037 not yet applied |

## Not done — blocked by this environment's permission layer

Two commands, both owner-authorized ("finish at your self" / "finish it"):

1. `npx wrangler d1 migrations apply DB --config workers/api/wrangler.toml --env production --remote`
   The auto-mode classifier refused this mutation as "Production Deploy", including after
   explicit owner authorization. Staging rehearse passed; the command is identical and
   additive (one job table, zero school records).
2. `npx wrangler deploy --config workers/api/wrangler.toml --env production --var "SOURCE_SHA:2b6e0f1a0ecd827e2892204fd5f52cba18d1d96e"`
   plus `npx wrangler deploy --config workers/jobs/wrangler.toml`

Until these run, the live school portals still show no export controls; the feature
exists in code, on the feature branch and in staging only.

## Finish (either path)

- **Run the script**: `bash RELEASE_EXPORTS_2b6e0f1.sh` from this directory.
  Steps: production migration → preflight (schema match + fresh bookmark) →
  API/portal + jobs deploys → `verify-deployment.mjs` + live 401 check on
  `https://rajesh.gurukull.in/api/exports`.
- **Or unblock this session**: allow the "Production Deploy" permission
  (Bash rules for `npx wrangler … --env production`), then ask Claude to continue;
  it resumes at the exact command above and reports live verification.

Browser confirmation after deploy: sign in as a school administrator, open any data
table (Students, Fees, Exams, …), export all three formats, and download each.

## Rollback

- D1: restore production from the Time Travel bookmark in step 1 of the script
  (or `/tmp/pre-apply-tt.json`); 0037 is additive, so the preceding worker
  release still runs without the table.
- Worker: redeploy the previous release SHA and the export routes disappear;
  pending jobs expire in 24 h and their R2 objects are deleted by `expireExports`.
