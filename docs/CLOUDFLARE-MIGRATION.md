# Independent Cloudflare deployment

The active implementation uses capability sync keys. Earlier Access/Clerk proposals are abandoned; retained access verifier tests are historical and not the production authentication path.

Dedicated Worker `mituba-reading-room` serves static assets and authenticated APIs, with D1 binding `DB` and exact `APP_ORIGIN=https://reader.mitubaex.com`. The custom domain is configured in Cloudflare. workers.dev and preview URLs are disabled. No OAuth provider, Access policy or application secret is required. D1 account/database identifiers in wrangler.jsonc are resource identifiers, not credentials. Change them for another deployment.

Build with `npm run build`; deploy the generated `dist/server/wrangler.json` using an authorized Wrangler session. Do not alter other Workers or root/mail DNS. This project is configured for Free use; stop rather than upgrade when limits become insufficient. Startup measurements do not establish per-request CPU compliance; sustained-load and worst-case CPU measurements remain outstanding.

## Schema caution

Production was initialized using the D1 dashboard with the final schema, not Wrangler's migration runner. It does not yet have a Wrangler migration history table. Do NOT blindly apply migrations to production: baseline the existing schema and reconcile migration history first. Local empty databases can apply the SQL files in order. Raw migrations 0004-0006 are not represented in Drizzle generation snapshots; reconcile those before using db:generate. The legacy auth_identities table is unused by sync authentication.

## Backups and migration

The old owner-private Sites deployment is preserved. `scripts/export-sites-backup.ts` converts a private paginated Sites snapshot to the versioned reader backup, checking that rows have one owner and removing ownership/auth fields. Supply input/output paths outside the repository. No personal subscription list is shipped as a default preset.

Use the application's JSON file preview and explicit merge/replace action to restore into the workspace whose key is present on that device. The transaction inserts validated data, switches namespace and removes the old namespace atomically. A failed transaction keeps the prior state. Exports read all three data tables in a single batch for a coherent snapshot; rate-limit cooldowns are not personal reading state and are not exported. Keep a separate backup before replacement.

The migration file has been prepared privately. Automated browser upload was blocked by the extension's local-file permission; production owner-data restoration is not verified. Manual file selection is sufficient and requires no extension setting change.

## Verified checks

Local tests cover keys/hash storage, workspace isolation, rotation and stale-write rejection, full backup roundtrip/merge/rollback, read-state retention, OPML, SSRF/XML and images. Local HTTP checks cover missing credentials and wrong mutation origin. Real KAI-YOU images rendered at desktop and 390px widths; saved state persisted after reload. Production TLS/landing, unauthenticated API rejection and creation/reload of a new workspace were checked. Production restore and cross-device use with the owner's real dataset remain pending. No payment, Clerk account, Access policy or new API credential was created.
