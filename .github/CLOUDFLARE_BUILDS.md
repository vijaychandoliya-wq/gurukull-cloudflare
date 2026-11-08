# Single production release authority

GitHub's protected `Cloudflare production deploy` workflow is the production release path. It only runs on main, requires the exact commit's local SonarQube status, rechecks tests/audits, verifies D1 migration metadata, captures a recovery bookmark, deploys API/assets and push jobs, and verifies source SHA at /health.

The checked-in build guard also refuses `WORKERS_CI=1`, preventing that path from racing the protected release even while dashboard settings are reconciled. Disable automatic production deployment in the Cloudflare Builds dashboard to avoid racing two authorities. Dashboard reconciliation must be verified separately; this document does not change dashboard settings.

A clean manual build uses `npm ci && npm --prefix apps/portal/source ci`. Wrangler's checked-in [build] command then builds the portal before packaging. Use `npx wrangler deploy --config workers/api/wrangler.toml --env production --var SOURCE_SHA:<reviewed-commit>` only within the verified release procedure. Default configuration is not a substitute for the production environment.

Staging has separate D1/KV/R2 resources, no email binding, and outbound email explicitly disabled. No production secrets or school-data snapshots should be copied into it casually.

## Diagnosing the 8 November build failure

The log's `npm ci` commands install dependencies successfully; they do not compile or test the portal. Its following bare `npx wrangler preview` fails because the selected configuration has no previews block. This automatic dashboard job is not the protected GitHub production workflow.

For the existing single-authority setup, disconnect/disable the Worker's automatic Git Builds trigger in Cloudflare Settings → Builds. Retain the repository and GitHub Actions integration, the Worker, domain routes and database. Do not replace the failing command with an unguarded production deploy or add an empty previews block just to clear this error. The existing portal build guard will intentionally reject `WORKERS_CI=1`.

If previews are introduced later, use an explicit configuration path, preview-only D1/KV/R2 resources and separate secrets, and separately verify migrations, tenant discovery and authenticated workflows. An empty previews block is not a working ERP environment.

Observed access limitation on 8 November: Wrangler can identify the account, but the available OAuth credentials receive HTTP 403 from the Builds API. Builds configuration requires a user-scoped token with Workers Builds Configuration Edit (Workers CI Write), or access through the signed-in dashboard. Browser automation is currently disabled in Work settings. No trigger was changed and no deployment was performed during this diagnosis.
