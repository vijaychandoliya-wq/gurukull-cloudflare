# Common multi-school mobile build report

Checked: 16 October 2026

## Scope

The teacher and parent binaries are common multi-school apps. They do not
select MGGS, Rajesh, or any other school by default and do not derive a DNS
hostname from a school code. A user enters the school code at sign-in; every
request goes to the shared Worker and includes `x-school-code`.

Shared API verified live:

`https://gurukul-worker-api.gurukull.workers.dev`

The Worker returned a healthy response, resolved discovery for both configured
schools `108` (Rajesh school) and `117` (MGGS) with the tenant header, and
rejected a request without a tenant with `SCHOOL_CODE_REQUIRED`.

## Source changes

- Teacher API and parent API now use the shared Worker endpoint.
- `setSchoolCode` stores the normalized tenant code and resets the API origin
  to the shared Worker; it never guesses `https://<code>.gurukull.in`.
- Both login screens require a school code and show a generic example.
- Parent media paths use the selected shared origin.
- Parent protected-request handling recognizes `/api/parent/login` as public.
- Both Android applications were incremented to version name `1.3`, version
  code `4` for Play Console updates.

## Validation

- Teacher Jest: 3 suites, 58 tests passed.
- Parent Jest: 3 suites, 9 tests passed.
- Teacher ESLint: passed with no warnings.
- Parent ESLint: passed with two existing inline-style warnings in
  `src/components/ui.tsx` and no errors.
- Teacher and parent release Gradle builds: successful.
- APK signatures: v2 signature verified for both APKs.
- APKs installed and launched on `emulator-5554`; both first-run screens show
  an empty school-code field and the generic `117 or RAJESH` example.
- The release bundles contain the shared Worker hostname and no MGGS/Rajesh
  API hostname.

## Deliverables

Teacher:

- `gurukull-teacher-ant/dist/Gurukull-Teacher-Common-v1.3-release.apk`
- `gurukull-teacher-ant/dist/Gurukull-Teacher-Common-v1.3-playstore.aab`

Parent:

- `Eklavya-ant/dist/Eklavya-Parent-Common-v1.3-release.apk`
- `Eklavya-ant/dist/Eklavya-Parent-Common-v1.3-playstore.aab`

These keep the existing package IDs, so they are version updates to the two
existing Play Console apps. Upload the AAB files; use the APK files for direct
emulator/device installation only.
