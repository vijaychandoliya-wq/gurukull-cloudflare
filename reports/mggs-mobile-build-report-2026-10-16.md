# MGGS mobile build and account report

Checked: 16 October 2026  
School: MGGS (code 117)  
API: `https://mggs.gurukull.in`  
Worker release: `2026-10-16-generated-password-whatsapp-1`

## Mobile builds

| App | Package ID | Version | Debug | Release |
| --- | --- | --- | --- | --- |
| Dronacharya Teacher | `com.gurukullteacherant` | 1.1 (version code 2) | Built | Built and signed |
| Eklavya Parent | `com.eklavyaparentant` | 1.1 (version code 2) | Built | Built and signed |

Both package IDs are different, so both apps can be installed on the same Android phone.

Updated Play Store submission artifacts are version 1.2 (version code 3):

- `Gurukull-Teacher-MGGS-v1.2-playstore.aab` and `Gurukull-Teacher-MGGS-v1.2-release.apk`
- `Eklavya-Parent-MGGS-v1.2-playstore.aab` and `Eklavya-Parent-MGGS-v1.2-release.apk`

The AAB files are the Google Play upload format. The APK files are for direct installation and testing.

## Checks

- Teacher Jest: 3 suites, 57 tests passed.
- Parent Jest: 3 suites, 8 tests passed.
- Teacher lint: passed.
- Parent lint: passed with two existing inline-style warnings and no errors.
- Teacher Gradle debug/release: passed with Java 21.
- Parent Gradle debug/release: passed with Java 21.
- Emulator: fresh debug and release installs completed for both package IDs.
- Emulator release smoke test: both apps launched; teacher and parent login fields were visible.
- Emulator update test: both version 1.2 APKs installed over the prior release; both launched with version code 3.
- Live MGGS health: passed.
- Live school discovery for code 117: passed (`MGGS`, active, configured).
- Invalid-login contract: passed with HTTP 401; no real account was changed.

## Teacher and parent login inventory

There are 17 teacher accounts and 125 parent accounts. Teacher and parent login IDs are their registered mobile numbers. A sanitized inventory with names, roles, mobile login IDs, and password status is in:

`mggs-teacher-parent-login-inventory-2026-10-16.csv`

The inventory intentionally contains no plaintext passwords, access keys, tokens, or password hashes. Passwords are generated per account from the administrator's Roles & account access screen and shown once for private handoff. WhatsApp delivery remains unavailable until a WhatsApp Business Cloud API sender, phone-number ID, token, and approved template are configured.

