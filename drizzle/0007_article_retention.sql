-- Additive only: no existing article is removed by this migration.
CREATE TABLE article_expirations (
  owner TEXT NOT NULL,
  feed TEXT NOT NULL REFERENCES feeds(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  url TEXT NOT NULL,
  PRIMARY KEY (owner, feed, id)
);
CREATE INDEX article_expirations_url ON article_expirations(owner, feed, url);
