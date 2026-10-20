# Gurukull module test matrix

The test suite uses scalar validation, deterministic calculations, authentication boundaries, and unauthenticated route guards. It does not insert fictional school, student, teacher, parent, or staff records. End-to-end persistence and login acceptance still require an authorized real account and its configured Cloudflare bindings.

Run from this directory:

```sh
npm test -- --run
```

| Module | Test evidence |
| --- | --- |
| academic-management | `academic-management.spec.ts`, `school-workflows.spec.ts` |
| academic-work | `school-workflows.spec.ts` |
| admin | `index.spec.ts`, `management.spec.ts`, `module-coverage.spec.ts` |
| admin-access | `index.spec.ts`, `module-coverage.spec.ts` |
| attendance | `operations-management.spec.ts`, `index.spec.ts` |
| auth | `index.spec.ts` |
| certificate-management | `module-coverage.spec.ts` |
| context | `index.spec.ts` authentication/tenant boundary checks |
| discipline-management | `discipline-management.spec.ts`, `module-coverage.spec.ts` |
| enrollment | `admin-enrollment.spec.ts`, `student-lifecycle.spec.ts` |
| exam-management | `exam-management.spec.ts`, `module-coverage.spec.ts` |
| fee-management | `fees-and-idcards.spec.ts`, `module-coverage.spec.ts` |
| hmac-key | `admin-access.spec.ts`, `module-coverage.spec.ts` |
| idcard-management | `fees-and-idcards.spec.ts`, `index.spec.ts` route guards |
| inventory-management | `operations-management.spec.ts`, `module-coverage.spec.ts` |
| leave-management | `operations-management.spec.ts`, `module-coverage.spec.ts` |
| library-management | `library-management.spec.ts`, `module-coverage.spec.ts` |
| live-class-management | `quiz-payroll-live.spec.ts`, `module-coverage.spec.ts` |
| management-common | `management.spec.ts`, `module-coverage.spec.ts` |
| member-access | `admin-access.spec.ts`, `module-coverage.spec.ts` |
| member-workspace | `index.spec.ts` route/auth boundaries |
| notice-management | `school-workflows.spec.ts`, `index.spec.ts` route guards |
| parent-management | `school-workflows.spec.ts`, `index.spec.ts` route guards |
| payroll-calculation | `quiz-payroll-live.spec.ts`, `module-coverage.spec.ts` |
| payroll-management | `quiz-payroll-live.spec.ts`, `index.spec.ts` route guards |
| people-management | `admin-enrollment.spec.ts`, `module-coverage.spec.ts` |
| portal-attendance | `operations-management.spec.ts`, `index.spec.ts` route guards |
| profile-management | `module-coverage.spec.ts` |
| quiz-management | `quiz-payroll-live.spec.ts`, `module-coverage.spec.ts` |
| reception-management | `module-coverage.spec.ts` |
| school-management | `school-workflows.spec.ts`, `module-coverage.spec.ts` |
| security | `index.spec.ts`, `admin-access.spec.ts` |
| student-lifecycle | `student-lifecycle.spec.ts` |
| student-workspace | `index.spec.ts` route/auth boundaries |
| sync | `index.spec.ts` bootstrap/cursor boundaries |
| transport-management | `transport-management.spec.ts`, `module-coverage.spec.ts` |
| workflow-common | `school-workflows.spec.ts`, `module-coverage.spec.ts` |

The matrix records that every source module has test evidence. It is not a claim that every branch is covered or that a real school acceptance test has been completed.
