# OPML / Reeder import

Export OPML using Reeder's official export UI, then select it in the reader management panel. The exact Classic menu has not been verified. Actual Reeder subscription access is pending its original approval outcome.

Preview folders, duplicates and exclusions before importing. Save as a preset to reuse later from owner-scoped D1 data. Never place personal OPML exports in source control or GitHub.

Limits: 2MB and 500 feeds; registrations in batches of 25 without external fetching. Refresh processes five feeds at a time. Stop takes effect before the next batch. Retry the same file after failure: existing normalized URLs are skipped. Read/saved state and existing folders are preserved. The first folder wins for duplicate entries.

Potential secret URLs, unknown query parameters and long opaque path segments are conservatively excluded for manual review. Presets are capped at ten; preset deletion/editing is not implemented.

Run `node --experimental-strip-types --test tests/opml.test.ts`. With a dedicated local preview, run `node tests/opml-integration.mjs`. `tests/fixtures/sample.opml` is synthetic, not the user's subscriptions. New databases require migrations 0000 through 0003; existing databases need only unapplied migrations.
