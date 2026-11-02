-- No personal identities or legacy namespaces are embedded in source.
CREATE TABLE auth_identities (
 issuer TEXT NOT NULL,
 subject TEXT NOT NULL,
 owner TEXT NOT NULL UNIQUE,
 PRIMARY KEY (issuer, subject)
);
CREATE TABLE request_budgets (
 key TEXT PRIMARY KEY NOT NULL,
 window INTEGER NOT NULL,
 used INTEGER NOT NULL
);
