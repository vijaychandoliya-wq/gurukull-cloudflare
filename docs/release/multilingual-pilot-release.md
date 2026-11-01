# Multilingual pilot release runbook

## Scope delivered in this change

- The API stores a language preference per `(school_id, user_id)` and enforces
  tenant relationships in D1. It provides a school administrator endpoint for
  reviewed-language settings and a member endpoint for an account preference.
- The web portal has a language selector on sign-in and in the authenticated
  header. Profile is the explicit cross-device save point. Its RTL direction is
  applied through Ant Design and the document root.
- Dronacharya and Eklavya have an on-device selector at sign-in and a profile
  save action that synchronises the signed-in account with the same API.
- The complete scheduled-language registry is present, but only English,
  Hindi, Tamil and Urdu are selectable. Other language tags are intentionally
  marked planned until reviewed copy and accessibility QA exist.

## Staging release order

1. Confirm the checked-out commit, Cloudflare account and staging resource IDs.
   Never point this migration at production by default.
2. Run `npm test`, `npm --workspace=workers/api run typecheck`, and
   `npm run build --prefix apps/portal/source` in the Cloudflare workspace.
   Run TypeScript and Jest checks in both mobile repositories.
3. Apply `0030_locale_preferences.sql` to the **staging** D1 database. It is
   additive and creates no school, account, student, teacher, parent, fee or
   other business data.
4. Deploy the Worker and portal to staging with a traceable source SHA.
5. With a real staging administrator and a real staging member, verify:
   - sign-in remains functional with `en`;
   - a profile language change persists after sign-out/sign-in;
   - a member cannot read or write another school's preference;
   - an administrator can only enable reviewed pilot locales;
   - Urdu switches the web page direction without overlapping header controls;
   - unavailable registry languages cannot be selected or saved.
6. Build separate Dronacharya and Eklavya Android release candidates. Install
   them together on one device, verify the package IDs remain distinct, and
   repeat the member preference test for each app.

## Production gates

- Pull-request review, required CI, dependency/security checks, and the
  configured SonarQube quality gate must pass.
- The D1 migration must have succeeded in staging and its tenant-isolation
  checks must be recorded.
- Product/linguistic approval is required for the four pilot packs. Do not
  advertise the other registry languages as translated.
- The Android release candidate needs a new Play version code and a signed AAB
  for each app. Upload first to internal testing; production rollout remains a
  separate explicit approval.
- Back up/export the D1 schema metadata and record the Worker release SHA
  before a production migration or deployment.

## Rollback

- Web/API: roll back the Worker/portal release to the preceding known SHA.
  The new tables are additive, so the preceding application release continues
  to run without deleting account preferences.
- Mobile: halt the staged Play rollout and promote the preceding signed build;
  do not reuse a Play version code.
- Data: do not delete preference rows as a rollback shortcut. If the pilot is
  withdrawn, disable non-English school settings through the administrator API
  and retain the audit trail.

## Not in this pilot

- No automatic or machine-generated translations.
- No conversion of dates, money, marks, identifiers, or school data formats.
- No runtime translation vendor, analytics event content, or production
  deployment from a developer workstation.
