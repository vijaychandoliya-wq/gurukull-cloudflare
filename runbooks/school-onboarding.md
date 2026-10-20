# Genuine school reservation and activation

Updated 8 October 2026. Rajesh school remains `configuration_needed`. No administrator, academic year, class, student, fee structure, address or contact is invented.

Public discovery now reads the registry database. A reserved school cannot authenticate, download a fabricated empty ERP or perform mutations. The proposed Rajesh hostname is registry metadata; it is not proof of live DNS, hosting or activation.

The platform reservation API requires a valid current D1 session, `superadmin` type, an active `platform_operators` grant, an idempotency key and explicitly validated name/code/slug/timezone/currency. It commits the school reservation and operation together. It does not create a dummy administrator, provision infrastructure or activate the school.

Activation needs the real administrator identity/contact, verified domain, confirmed school settings and credential-enrollment delivery process. Source user roles must be mapped explicitly. The old direct SQL example with an invented name/email and a 20,000-iteration PBKDF2 hash is withdrawn.

The current verifier preserves supported imported bcrypt hashes at their existing cost (minimum cost 10) and handles legacy `$2y$` format. Unsupported algorithms or costs require an explicit secure migration; there is no weaker fallback. Deployed Workers Free password-verification CPU must pass before credential login is enabled. A JWT signature benchmark cannot authorize activation.

Administrator enrollment, password recovery, real settings verification and activation as one audited lifecycle operation remain incomplete. Do not manually flip `schools.status` to `active` to bypass these requirements. Once implemented, validate the administrator's actual portal permissions, error/empty states and genuine school setup before declaring the school ready.
