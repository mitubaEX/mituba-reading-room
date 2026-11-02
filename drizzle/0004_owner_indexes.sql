-- Proposal only. Not applied to Sites or Cloudflare.
CREATE INDEX IF NOT EXISTS feeds_owner_url ON feeds(owner,url);
CREATE INDEX IF NOT EXISTS articles_owner_date ON articles(owner,COALESCE(published,added) DESC);
CREATE INDEX IF NOT EXISTS articles_owner_feed ON articles(owner,feed);
CREATE INDEX IF NOT EXISTS presets_owner_created ON presets(owner,created DESC);
