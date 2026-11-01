# Single production release authority

GitHub's protected `Cloudflare production deploy` workflow is the production release path. It only runs on main, requires the exact commit's local SonarQube status, rechecks tests/audits, verifies D1 migration metadata, captures a recovery bookmark, deploys API/assets and push jobs, and verifies source SHA at /health.

The checked-in build guard also refuses `WORKERS_CI=1`, preventing that path from racing the protected release even while dashboard settings are reconciled. Disable automatic production deployment in the Cloudflare Builds dashboard to avoid racing two authorities. Dashboard reconciliation must be verified separately; this document does not change dashboard settings.

A clean manual build uses `npm ci && npm --prefix apps/portal/source ci`. Wrangler's checked-in [build] command then builds the portal before packaging. Use `npx wrangler deploy --config workers/api/wrangler.toml --env production --var SOURCE_SHA:<reviewed-commit>` only within the verified release procedure. Default configuration is not a substitute for the production environment.

Staging has separate D1/KV/R2 resources, no email binding, and outbound email explicitly disabled. No production secrets or school-data snapshots should be copied into it casually.
