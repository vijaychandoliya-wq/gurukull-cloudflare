# Single production release authority

Updates pushed to `main` or `development` run workspace CI. A successful push CI run on `main` automatically starts the protected production workflow. Development and pull requests never deploy to production. The production environment approval and exact-commit SonarQube approval remain required; a missing local analysis is a release blocker, not a passing result. Manual production runs remain available. The deployment checks out and verifies the SHA tested by the triggering CI run, and refuses to deploy it if main has since moved.

GitHub's protected `Cloudflare production deploy` workflow is the production release path. It only runs on main, requires the exact commit's local SonarQube status, rechecks tests/audits, verifies D1 migration metadata, captures a recovery bookmark, deploys API/assets and push jobs, and verifies source SHA at /health.

The checked-in build guard also refuses `WORKERS_CI=1`, preventing that path from racing the protected release even while dashboard settings are reconciled. Disable automatic production deployment in the Cloudflare Builds dashboard to avoid racing two authorities. Dashboard reconciliation must be verified separately; this document does not change dashboard settings.

A clean manual build uses `npm ci && npm --prefix apps/portal/source ci`. Wrangler's checked-in [build] command then builds the portal before packaging. Use `npx wrangler deploy --config workers/api/wrangler.toml --env production --var SOURCE_SHA:<reviewed-commit>` only within the verified release procedure. Default configuration is not a substitute for the production environment.

Staging has separate D1/KV/R2 resources, no email binding, and outbound email explicitly disabled. No production secrets or school-data snapshots should be copied into it casually.
