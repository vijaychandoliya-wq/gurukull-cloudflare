# Cloudflare Builds

The production Worker is connected to `vijaychandoliya-wq/gurukull-cloudflare`.

- Production branch: `main`
- Build command: `npm ci && npm --prefix apps/portal/source ci`
- Deploy command: `npx wrangler deploy`
- Preview builds: enabled

The Worker configuration builds the self-contained portal and publishes its
`apps/portal/source/dist` assets alongside the API.
