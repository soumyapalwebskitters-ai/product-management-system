# Access model

The seller signs in once to use both staff tabs. Anonymous visitors and legacy buyer accounts receive only the public catalog, offers, gallery, and seller contact profile. Private buyer/order records, buying prices and stock records are never included in those responses. All state and gallery mutations require a seller session on the server. Local dev and preview use the same API handler; there is no automatic seller login.

# Rollout

1. Back up the existing database.
2. Apply `migrations/0018_auth_rate_limits.sql` before deploying this version. For the configured D1 database, use `npx wrangler d1 execute market --remote --file migrations/0018_auth_rate_limits.sql`. This statement is idempotent. Do not blindly apply all pending migrations: this checkout also contains an unrelated purchase-history deletion migration.
3. Build and deploy using the existing deployment process. `public/_headers` is copied into the static build.
4. Sign in with the existing seller password. Existing credentials are not overwritten. If the old default password was ever used and has not been changed, immediately replace it in Settings using the current and new password fields. Password changes invalidate old sessions and issue a fresh session to the current browser.
5. Verify anonymous reads contain no private data, anonymous writes return 401, and signed-in staff can save and manage gallery images.

For a NEW database only: configure a strong `SELLER_SETUP_TOKEN` server secret, then submit an HTTPS JSON POST to `/api/auth/setup` with `email` and a unique `password`, and the matching `X-Setup-Token` header. Remove the setup secret after provisioning. Existing sellers do not need this secret. Never put it in a client/VITE variable or commit it. Local development can receive the same variable through its environment. Authentication attempts are limited persistently to ten per IP per ten-minute bucket; production uses Cloudflare's client IP header.

# Verification

`npm run test:security` checks authorization, data redaction, authenticated writes, gallery mutations, setup protection, password/session rotation, logout, request validation, throttling, and image proxy restrictions using an isolated in-memory database. It does not change local or remote shop records. `npm run build` checks the client and Worker types and production assets.
