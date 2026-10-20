# Gurukull verification report

Checked: 15 October 2026, Asia/Kolkata

## 15 October release checks

- Password generation: implemented for teacher, parent, student, and staff accounts. It requires `AUTH_CPU_VERIFIED=true`, generates a 20-character cryptographically random password, stores only bcrypt, returns it once, and revokes older access keys/sessions. The production flag remains `false` until the secure bcrypt CPU gate is approved; access keys remain available.
- School 117: remote D1 migration `0023_mggs_school_reservation.sql` applied. `mggs.gurukull.in` resolves to code `117`, name `MGGS`, status `configuration_needed`, and **0 users**.
- Worker release: `2026-10-15-password-expo-mggs-1`; both school hosts returned healthy.
- Expo client: TypeScript check and Android export passed. Arm64 release APK built successfully; package `in.gurukull.lite`, version `1.0.0`, 25 MB.

## Passing checks

- Cloudflare API: **169 tests passed**, 18 test files (`npm test -- --run`).
- Cloudflare API coverage: **32.93% statements, 31.97% branches, 31.78% functions, 53.77% lines**. The LCOV report is `coverage/lcov.info`.
- Cloudflare worker typecheck: passed (`workers/api`, `tsc --noEmit`).
- Cloudflare workspace build: passed, including Next.js marketing, the Vite portal build, import tools, and worker packages.
- Cloudflare workspace lint: passed.
- Teacher app Jest: **55 tests passed**.
- Student app Jest: **3 tests passed**.
- Teacher app ESLint: passed.
- Student app ESLint: passed with two existing inline-style warnings in `src/components/ui.tsx`.
- Dronacharya Android Gradle test task: passed (`BUILD SUCCESSFUL`).

## Test coverage added

`workers/api/test/module-coverage.spec.ts` adds boundary cases for school setup, people/profile, certificates, inventory, leave, library, reception, transport, fees, exams, quizzes, payroll, live classes, owner/member access keys, and module route authorization. `MODULE_TEST_MATRIX.md` maps every API source module to test evidence.

## Blocked checks

- SonarQube/SonarCloud: `sonar-project.properties` is prepared and `sonar-scanner` 8.1.0.6389 is installed, but no server URL or token is configured. `http://127.0.0.1:9000` is not running, so there is no Sonar quality gate or issue count to report.
- Teacher Android Gradle: blocked during React Native settings plugin resolution (`com.facebook.react.settings`, version `25.0.3`).
- Student Android Gradle: blocked by the same React Native settings plugin resolution error.
- Legacy Eklavya Android Gradle: blocked by Gradle 8.9/JDK 25 incompatibility (`Unsupported class file major version 69`).

These Android failures are environment/build-tool failures, not passing application tests. No physical-device or APK installation test was performed.
