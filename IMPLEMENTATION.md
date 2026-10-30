# Reading Room

Private Sites RSS/Atom reader. This checkout is independent of AquaLine.

## Implemented
- Sites-managed ChatGPT sign-in and owner-private deployment policy; authenticated API, user-ID-scoped reads and writes, same-origin write checks, no-store responses.
- Sites-managed D1 persistent feeds, articles, read status and saved status. Browser focus reloads current server state. No localStorage records.
- RSS 2.0 / Atom / RSS RDF parsing, HTML alternate-link discovery, manual refresh, timestamps and per-feed failure reporting.
- Text-only safe summaries, original article links, title search, unread/all/saved views, per-feed filtering, bulk-read of currently displayed snapshot.
- Stable feed+GUID/ID (URL fallback) keys preserve state on refresh; unique subscription IDs. Article updates use optimistic version checks (409 on stale writes). Bulk updates only affect matching snapshot versions.
- Public HTTP(S) only, credentials and unusual ports rejected, IP literals and private host suffixes rejected, A/AAAA checked through fixed Cloudflare DoH endpoint against non-public ranges on every redirect. Redirects manual/max 5, request deadline 12s, response cap 2MB, DTD/entities rejected, XML parser does not fetch external resources. No user cookies or authorization forwarded.

## Constraints
- Hosted owner-only boundary is supplied by Sites dispatch; do not deploy this Worker directly to an unprotected origin. D1 is server-side; local preview and production data are separate.
- DNS preflight and hostname fetch are separate operations; no application-layer DNS pinning is possible with standard Worker fetch. Platform public-egress isolation remains part of SSRF protection. Do not reuse this fetcher in a privileged local network service without DNS pinning.
- Up to 500 feeds, 300 entries per feed fetch, newest 2000 stored articles returned to UI. Older records remain in D1; pagination/retention are future work.
- Deduplication is within a feed by stable entry key, not across unrelated feeds. A publisher changing its GUID may create another item.
- No scheduling, no non-RSS scraping, no full-article extraction, no feed deletion/editing, no OPML export, no push/email subscriptions.
- Access by a second real ChatGPT account requires that account for an end-to-end denial test; local anonymous and forged-header denial plus hosted policy inspection do not impersonate another account.

## Validation
`node --experimental-strip-types --test tests/feed.test.ts`, `npx tsc --noEmit`, Sites build helper.
The real-feed test reads `/tmp/reading-room-kaiyou.xml`; capture it with a bounded HTTPS download from `https://kai-you.net/contents/feed.rss` before running.
`tests/integration.mjs` uses the dedicated local preview at 127.0.0.1:5189 and its documented mock sign-in. Register KAI-YOU in local preview first. It tests persistence, saved state, stale-version conflict, refresh and registration deduplication, SSRF/failed feeds, bulk read, and CSRF. It mutates local test data only.
`tests/ownership.mjs` checks forged unauthenticated headers are rejected by local dispatch.
Real KAI-YOU fetch on 2026-10-30: 20 entries; newest published 2026-10-29T13:21:00Z. Responsive UI checked at 390px (no horizontal overflow); save/read controls exercised, reload retained state.

## Thumbnail/UI update (2026-10-30)
- Main screen is now a compact article list; feed registration/status/account controls live in a collapsed management section. Read/saved filters, search, feed filter and bulk actions remain available.
- Feed image priority: media thumbnail/content (including groups), image enclosures (RSS/Atom), webfeeds cover, then summary/content img sources. KAI-YOU currently supplies valid images for all 20 items; its first WebP was fetched and verified (124384 bytes).
- Missing-image fallback reads only public article HTML metadata (Open Graph/Twitter). It runs in a separate authenticated request after the list loads: max 3 pages per owner per 10 minutes, concurrency 2, timeout 5s/page, max 2MB/page. Failure/no-image results are cached in D1 for 24h; successful image URLs are retained across feed refreshes. It does not scrape arbitrary page images or run scripts. Remaining candidates wait for later visits/refreshes, not a background scheduler.
- Browser requests same-origin authenticated image URLs only. Server checks record ownership before retrieving/caching the image; original cookies, auth and referrer are not forwarded. DNS/redirect policy matches feed retrieval. Raster signatures only (JPEG/PNG/GIF/WebP), 2MB cap, 7s timeout, SVG/HTML denied. Image response cache: success 24h at edge / 1h private browser; failure 5m at edge. Edge cache is best-effort and may be evicted. Authorization always precedes cache lookup. No public proxy accepting arbitrary URLs.
- Lazy loading and fixed dimensions reserve image space. Missing/broken images remove the thumbnail and leave a normal text entry; no large placeholder. Links use noopener/noreferrer and no-referrer. No third-party browser image requests.
- Schema changes only add nullable image/image_checked columns and an owner-level rate-limit table. Existing articles/read/saved states are preserved.
- Tests: 7 Node tests including fixture OG success/none/403, feed priority, positive/negative cache, request cap and state preservation; typecheck; integration regression; authenticated image 200 vs anonymous 401; real KAI-YOU image fetch; browser desktop + 390px mixed image/none/broken display (first image loaded, second/third have no img nodes). Existing 20 articles and saved state survived migrations.
- Limitations: binary image caching is platform best-effort; AVIF/SVG are not accepted. Existing feed image that fails to load currently falls back to text; OG discovery is for entries with no accepted feed URL. DNS preflight/pinning and real hosted sign-in verification limits above still apply.

## Existing-article image repair (2026-10-30)
Confirmed code gap: pre-thumbnail articles had NULL images until manual feed refresh; automatic enrichment only attempted 3 OG pages and did not first re-read the original feed. Added automatic feed-first backfill on the existing asynchronous enrichment call (max 2 feeds / 10 minutes, concurrent 2). It updates only existing missing image fields and preserves read/saved/version. Then the bounded OG fallback runs for remaining missing entries. Cache lookup failures now fall through to origin fetch rather than failing the image endpoint; image responses expose hit/miss diagnostics.
Reproduction: cleared only image columns on 20 existing local KAI-YOU records, invoked enrich, observed updated=20; exact read/saved/version tuples unchanged. Proxy returned HTTP 200, image/webp, private max-age=3600, cache hit, 124384 bytes; decoded and visually inspected a 1152×648 image. Added regression test; all 8 tests and typecheck pass. This establishes a real implementation gap and local repair, not proof that it is the sole cause of the user's hosted symptom. Hosted owner-login data and image responses remain inaccessible without the user's sign-in session; private policy is unchanged.

## OPML import
Owner-scoped reusable presets, local file preview, hierarchical folders, normalized URL deduplication and result reporting. Limits: 2MB, 500 feeds, 20 outline levels, 2000 nodes, 25 registrations per request. No fetching during import. Manual refresh processes five oldest-checked feeds. Up to ten private presets. Existing articles and read/saved/version fields are untouched. Migration 0003 only adds folder and presets storage. DTD/entities and risky URLs are rejected, including conservative secret/query filters.

Tests use synthetic OPML only. Reeder 5.5.1 was identified, but real subscription export remains pending its original access approval. No personal preset is in source control.
