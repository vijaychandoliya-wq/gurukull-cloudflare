# Local validation and deployment gates

Updated 8 October 2026. Production cutover remains blocked. See `../../cloudflare-migration-plan/execution/STATUS.md` for actual evidence and missing prerequisites. A successful bundle is not a deployment or a working ERP.

Use Node >=22.12 (Node 24.19 was used for verification). Install the pinned lockfile with `npm ci` from the Cloudflare workspace. Root tooling is Wrangler 4.148.0 and Vitest 5.0.3; Sharp 0.35.5 overrides the vulnerable emulator transitive patch. Do not force-install older tooling to fit the host's Node 20.11.

From the workspace:

```sh
npm test
npm exec tsc -- --noEmit
```

From `workers/api`, these commands operate locally:

```sh
npm exec wrangler -- d1 migrations apply DB --local --persist-to /private/tmp/gurukul-repair-worker-state
npm exec wrangler -- deploy --dry-run --env staging --outdir /private/tmp/gurukul-api-repair-bundle
```

All three migrations are required. Do not seed business fixtures. The initial migration contains only the requested Rajesh reservation; its status stays `configuration_needed` and its default values are not confirmation of real school settings.

Local preview requires `ENVIRONMENT=local` so localhost is an allowed shared host. A real randomly generated `JWT_SECRET` must have at least 32 bytes. Do not commit secrets or reuse a public test boundary key. Credential login also requires measured deployed-Free CPU evidence before setting `AUTH_CPU_VERIFIED=true`; unit JWT timings do not meet that gate.

The default configuration references the verified existing `gurukull` account and `gurukul-d1-prod` D1 database. List metadata reports zero tables unreliably; the 9 October schema query confirms original tables exist but new migration-0003 tables are absent. The default/deployed API lacks JWT secret and R2 bindings; deployed jobs lacks FCM credentials. Staging/production environment IDs still contain placeholders, and the jobs Worker lacks equivalent environment separation. Do not apply local test assumptions to those remote resources.

Before any remote migration/deploy, resolve those bindings, verify Workers/R2 Free entitlement and account-wide capacity, ensure API and jobs use the same intended database, and complete domain/device/recovery gates. Account subscriptions returned 403 under the current OAuth scopes; the zone's Free Website plan does not prove the Workers/R2 billing state. Keep remote deployment commands out of routine local scripts until these gates are satisfied.

The Vite portal builds, but required administrative APIs remain incomplete. Its production default uses the current origin; an explicitly configured production API URL must use HTTPS. Serving the SPA, API-first routing, deep links and CSP still need a complete Workers Static Assets configuration and browser validation.

The existing Next.js application contains dynamic API routes. Uploading raw `.next` to Pages does not provide their server runtime. Remove that old deployment procedure. A compatible Workers adapter migration/spike must preserve contact handlers, images, SEO and approved integrations before marketing hosting is ready. No adapter or Pages upload has been performed during this repair.

## Deployment completed 9 October 2026

The user explicitly authorized a test URL and deployment. Current deployed evidence supersedes the earlier remote-readiness notes above: see `../../cloudflare-migration-plan/execution/DEPLOYMENT_TEST_REPORT_2026-10-09.md`. Default verified account/resource configuration was used; no explicit production environment placeholders or DNS routes were deployed. All three D1 migrations are applied; repaired API/Static Assets and jobs are live. JWT secret and R2_MEDIA binding exist. Do not remove login/quota gates or infer full ERP acceptance.

The portal workspace build now builds the actual Vite dist consumed by Worker assets; it no longer recursively copies stale Pages assets into a nested dist directory. Existing unused generated artifacts are retained rather than deleted.
