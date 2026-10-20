# MGGS school 117 provisioning report

Checked 15 October 2026 against `https://mggs.gurukull.in`.

## Saved records

- School: MGGS, code `117`
- Timezone: `Asia/Kolkata`
- Currency: `INR`
- Address: `Raigar mohalla, Chandlai, Rajasthan 303903`
- Academic year: `2026-27`, `2026-04-01` through `2027-03-31`, current
- Class: `Class 1` (code `1`)
- Section: `A`
- Teacher: Shalu Verma, `shaluverma17100@gmail.com`, mobile `8529988808`, employee ID `MGGS-T-001`, full time, joining date `2026-06-15`
- Student: Tanay Chandoliya, admission number `MGGS-2026-001`, roll number `1`, Class 1-A, enrollment date `2026-05-31`
- Parent: Vijay Chandoliya, mobile `9887403108`, father of Tanay Chandoliya, civil engineer, annual income ₹1,200,000

## Live verification

- Administrator access-key login: passed
- Dashboard read: passed; counts are 1 student, 1 teacher, 1 class, 1 section, 1 academic year
- School setup read: passed
- Teacher detail read: passed
- Student detail read: passed
- Parent detail and child link read: passed
- Teacher portal login: passed with Shalu's generated access key; `/api/teacher/myinfo` returned the real profile and teacher role
- Parent portal login: passed with Vijay's generated access key; `/api/v2/my-children` returned Tanay, Class 1-A, and admission number `MGGS-2026-001`
- Student access-key issuance: blocked because the student has no email or mobile, matching the agreed student-contact rule

Both school tenants now report `active` from public discovery. Activation is scoped to the explicitly configured school codes `108,117`; the shared worker does not receive a global activation bypass.

Worker release `2026-10-15-school-activation-scope-1` passed TypeScript checking and the full Cloudflare test suite (18 files, 169 tests). A deployed isolated bcrypt probe passed, password login was enabled, and generated teacher/parent passwords were each verified. Their old access keys were revoked. The administrator remains on the owner-issued access key because the password endpoint intentionally excludes administrator accounts. Both school health endpoints returned 200. Android emulator retesting remains a separate device check; the live teacher and parent API sessions now pass.

The generated teacher and parent access keys are kept in the private administrator-access directory and were displayed once to the owner. They are not stored in this report.
