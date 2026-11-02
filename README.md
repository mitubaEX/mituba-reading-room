# Reading Room

Cloudflare Workers + Assets + D1 RSS/Atom reader. Public landing at https://reader.mitubaex.com; subscriptions, articles, reading state and presets require a secret sync key. No email/password provider is used.

Create a workspace, save its key somewhere private, and paste the same key on another device. Possession grants full access. Losing every copy means losing access; rotate a leaked key to disconnect previous copies. Keys are stored in browser localStorage and transmitted only in Authorization headers. The server stores only their SHA-256 hash. Backups never contain keys.

Features: feed discovery, RSS/Atom, read/unread, saved articles, manual refresh, safe thumbnail proxy with bounded OG fallback, folder-aware repeatable OPML import, JSON full-state export/restore. Restore previews counts and requires merge/replace confirmation; merge retains existing reading state. JSON restore is atomic and changes internal record IDs. External article links remain stable.

## Development

Requires Node 24 for SQLite-backed tests; application build supports Node >=22.13.

```sh
npm ci
node --experimental-strip-types --test tests/*.test.ts
npx tsc --noEmit
npm run build
npx wrangler d1 migrations apply mituba-reading-room --local
npx wrangler dev --config dist/server/wrangler.json --local --port 5190 --var APP_ORIGIN:http://127.0.0.1:5190
```

Use only local test data. Never commit private backups, feed presets, database files, tokens or sync keys. Existing Sites deployment and data are separate and unchanged. See [deployment notes](docs/CLOUDFLARE-MIGRATION.md) before remote schema operations.

## Limits and security

500 feeds, 10 presets; JSON restore up to 1.8 MB and 5,000 articles. Exports contain all stored articles, so a large export may exceed the restore limit. OPML imports process 10 feeds per request without fetching them. Refresh handles one feed and at most 200 entries. Image repair handles 10 feed images and at most 2 OG pages with cooldowns. No periodic crawling.

Requests use per-workspace/IP/global budgets and a fenced write lease. The free deployment is intended for light use, not unbounded public signup. CSP, same-origin mutation checks, query ownership, private image authorization, public-only fetch validation, redirect checks, timeouts, size limits and XML entity rejection are enforced. No private cookies are forwarded to feed sites. Browser storage can be cleared or stolen by malicious same-origin code: retain a private key copy and periodic backups. Backups contain personal reading data and should be kept private.
