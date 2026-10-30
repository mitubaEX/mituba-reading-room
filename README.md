# Reading Room

自分専用の Web RSS / Atom リーダー。スマートフォンとMacで記事・既読・あとで読むを共有します。

## 機能

- Sites の ChatGPT サインインと所有者限定アクセス
- RSS / Atom 登録、サイトURLからのフィード検出、手動更新
- 記事検索、未読/すべて/あとで読む、媒体フィルター、一括既読
- D1への永続保存、競合検出、更新失敗・最終更新日時
- フィード画像、既存記事への画像補完、画像がない記事のOG/Twitter画像補完
- 認証付き画像プロキシ、遅延読込、画像失敗時のテキスト表示

Vinext / React / TypeScript / Cloudflare Workers / D1 / Drizzleで実装しています。

## このリポジトリについて

このprivateリポジトリは、動作中のSitesソースから作成した**履歴なしのコードスナップショット**です。Sitesの既存リポジトリ・公開URL・認証・共有範囲とは別管理です。GitHubへのpushでSiteは更新されません。

`.openai/hosting.json` は論理バインディング `DB` のみを保持し、特定Siteの `project_id` は除外しています。認証クライアント設定、鍵、トークン、Cookie、ローカルDB、購読や既読・保存データは含みません。Sites環境に戻すときは**既存Siteから正確なproject_idを確認して**設定し、Sites標準ワークフローで公開してください。新規Siteの作成や公開範囲変更はこのバックアップの目的に含みません。

## ローカル起動

Node.js 24.x と npm を推奨します（フレームワークの最低要件は22.13以上、テストは24で検証）。クリーンなcloneはportableプロファイルになります。

```sh
npm run install:ci
npm run build
```

初回だけ、専用のローカルD1へマイグレーションを順に適用します。

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_public_chronomancer.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_complete_triathlon.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0002_special_omega_sentinel.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0003_tearful_rawhide_kid.sql
npm run dev -- --port 5189 --hostname 127.0.0.1
```

適用済みSQLを再実行しないでください。`http://127.0.0.1:5189`を開くと開発専用の模擬サインインを使います。本番認証とは別で、ローカルデータは本番へ同期されません。既に5189を使っている場合は別ポートを選び、統合テストのbase URLも合わせてください。

## テスト

公開KAI-YOUフィードをテスト用一時ファイルに取得します。外部ネットワークが必要で、取得内容は時点により変わります。

```sh
curl --fail --max-time 20 --max-filesize 2000000 https://kai-you.net/contents/feed.rss -o /tmp/reading-room-kaiyou.xml
node --experimental-strip-types --test tests/feed.test.ts tests/images.test.ts tests/opml.test.ts
npx tsc --noEmit
npm run build
```

ローカル起動後、画面からKAI-YOU公式RSSを登録した上で実行します。

```sh
node tests/integration.mjs
node tests/ownership.mjs
```

統合テストはローカルの既読・保存状態を変更します。専用の試験データで実行してください。現在の実feedテストはKAI-YOUの20件配信を期待しており、配信件数変更時は期待値の見直しが必要です。

## セキュリティと制限

- 本番の所有者限定アクセスはSitesの入口側認証が前提です。このWorkerを認証されていない別originへ直接公開しないでください。
- APIはユーザーIDで所有権を確認し、更新要求のoriginと競合バージョンを検査します。
- 公開HTTP(S)のみ取得。内部IP・危険scheme・危険redirectを拒否し、DNS確認・タイムアウト・2MB上限・外部実体拒否を設けています。DNS確認とfetchは別処理なので、DNS pinningは未実装です。
- HTMLをUIへ挿入せず、外部ページのスクリプトを実行しません。ユーザーのCookieや認証情報を送信しません。
- OG補完は最大3記事/10分、並列2、失敗結果24時間保持。既存記事のフィード画像補完は最大2フィード/10分。画像キャッシュはbest-effortです。
- Capacity: 500 feeds; fetch up to 300 entries per feed; list newest 2000. Scheduling, non-RSS scraping, full text, OPML export and subscription editing/deletion remain unimplemented.
- ローカルでは実画像bytesとブラウザ描画を検証済み。本番の本人ログイン後描画は、作業環境に本人セッションがないため直接検証できていません。

詳細は [IMPLEMENTATION.md](IMPLEMENTATION.md)、基盤の説明は [docs/SITES-STARTER.md](docs/SITES-STARTER.md) を参照してください。

## OPML import update

Reusable owner-private presets and folder filters are implemented. See [OPML guide](docs/OPML.md). Capacity is now 500 feeds; manual refresh processes five at a time. OPML import no longer belongs to the unimplemented features listed above. Export and preset deletion/editing remain unimplemented. Personal subscription data is not included. Run `node tests/opml-integration.mjs` against dedicated local test data. Actual Reeder export remains pending access approval.
