#!/usr/bin/env bash
# Release script: backend table exports (CSV / PDF / Excel) for commit 2b6e0f1
# Run from the repository root of this worktree. Uses the already-authorized
# Wrangler OAuth identity; the production account is fixed below.
#
# Completed so far (2026-11-12):
#   [x] code + 315 tests + build, committed as 2b6e0f1
#   [x] staging D1: 0037 applied
#   [x] staging worker: deployed, /health reports 2b6e0f1, /api/exports = 401
#   [x] production recovery bookmark captured: /tmp/pre-apply-tt.json
# Remaining: production migration + worker deploys (owner-authorized).
set -euo pipefail
cd "$(dirname "$0")"

SHA="2b6e0f1a0ecd827e2892204fd5f52cba18d1d96e"
export CLOUDFLARE_ACCOUNT_ID="e640cac6d5f89a87e7c952f4b3669af0"

echo "== 1/4 Apply migration 0037 (additive export-jobs table) to production D1 =="
npx wrangler d1 migrations apply DB --config workers/api/wrangler.toml --env production --remote

echo "== 2/4 Production preflight: schema match + recovery bookmark =="
node tools/release/preflight.mjs production

echo "== 3/4 Deploy API + portal assets, then the jobs dispatcher =="
npx wrangler deploy --config workers/api/wrangler.toml --env production --var "SOURCE_SHA:$SHA"
npx wrangler deploy --config workers/jobs/wrangler.toml

echo "== 4/4 Verify deployed source SHA and the live export endpoint =="
node tools/release/verify-deployment.mjs https://gurukul-worker-api.gurukull.workers.dev "$SHA"
curl -s -o /dev/null -w "live /api/exports without session: %{http_code} (expect 401)\n" \
  "https://rajesh.gurukull.in/api/exports"

echo
echo "Done. Browser check: sign in to the school portal, open any data table"
echo "(Students, Fees, Exams, ...), confirm the export row offers PDF / CSV /"
echo "Excel, generate one of each, and download them."
