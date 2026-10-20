# Gurukull migration scope: School web portal

Applies when working on the Cloudflare Free migration. Read the governing [root AGENTS.md](</Volumes/Cricial 500/education-platforms/AGENTS.md>) first. The latest migration target is Workers Free, Rajesh school and no dummy data; older $5 estimates are reference material, not authorization for paid usage.

Read these implementation guides before editing this project:

- [01-api](</Volumes/Cricial 500/education-platforms/cloudflare-migration-plan/agent-guides/01-api/AGENTS.md>)
- [03-rajesh-school](</Volumes/Cricial 500/education-platforms/cloudflare-migration-plan/agent-guides/03-rajesh-school/AGENTS.md>)
- [04-web](</Volumes/Cricial 500/education-platforms/cloudflare-migration-plan/agent-guides/04-web/AGENTS.md>)
- [08-validation-cutover](</Volumes/Cricial 500/education-platforms/cloudflare-migration-plan/agent-guides/08-validation-cutover/AGENTS.md>)

Inspect src/services/api.ts, src/context/AuthContext.tsx and all required pages. Use genuine API-bound data and server permissions. Remove production demo roles/school choices only where present; do not invent statistics or records.

Do not deploy, seed, create Rajesh or send Firebase/email notifications merely because this instruction file exists. The current requested deliverable is the instruction package. Future implementation follows its actual user authorization, preserving user changes and recording real evidence.

Missing genuine administrator details, school configuration, provider access or device/data tests must be reported explicitly. No dummy records, simulated successful delivery, insecure auth shortcut or hidden paid upgrade.
