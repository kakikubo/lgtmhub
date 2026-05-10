# 要求内容: 画像登録ページのキーワード検索機能（Issue #78）

## 背景

`/images/new` は画像 URL の手入力のみに対応しており、登録のハードルが高い。lgtmoon.com の「キーワード検索」相当を導入し、登録導線を広げる。

参照: GitHub Issue #78

## 今回のスコープ

`/images/new` に **タブ切り替え UI** を追加し、以下の 2 モードに分岐させる。

| タブ | 入力 | 状態 |
|---|---|---|
| URL 入力 | 画像 URL を直接ペースト | 現状の `ImageRegisterForm` を踏襲 |
| キーワード検索 | キーワード | **本タスクで新規追加** |

キーワード検索タブのフロー:

1. ユーザーがキーワードを入力 → 「検索」ボタン押下
2. `/api/images/search?q=...&page=1` を叩いてサムネイル付き候補を取得
3. ユーザーが 1 枚選択 → 選択画像 URL を確定
4. 「この画像で登録する」で既存 `POST /api/images` フローに合流
5. 登録後の合成・重複検知・登録は既存ロジック (`ImageService.createImage`) をそのまま使用

## 外部 API 選定

**結論: Pexels API を採用する。**

| 候補 | 採否 | 理由 |
|---|---|---|
| Pexels | **採用** | 無料・帰属表示は item 単位で必須ではない・JSON シンプル・静止画なので既存 LGTM 合成パイプライン (Sharp 単一フレーム) と相性良 |
| Unsplash | 不採用 | 帰属表示が必須で UI 複雑化 |
| GIPHY | 不採用 | 動的 GIF が前提で `compose-lgtm` の単一フレーム処理と乖離、レート制限も厳しい |
| Pixabay | 不採用 | 画質が混在しやすい |

ただし以下の方針で「将来の差し替え」を容易にする:

- Service 層に `ImageSearchProvider` インターフェイスを置き、Pexels 実装はその一形態として注入する
- 環境変数 `IMAGE_SEARCH_PROVIDER=pexels` で選択する余地を残す（MVP では `pexels` 固定）
- レスポンス正規化スキーマを統一し、ページ全体で「Photos provided by Pexels」のクレジットを 1 箇所表示する

## 機能要件

### サーバーサイド

- `GET /api/images/search?q=<keyword>&page=<n>` を新設
  - 認証必須（`/images/new` と整合）
  - クエリ: `q` 必須・`page` 任意（デフォルト 1）
  - サーバーサイドで `IMAGE_SEARCH_API_KEY` を保持し Pexels API を呼ぶ
  - レスポンスは正規化済み（`thumbnailUrl`, `imageUrl`, `width`, `height`, `provider`, `attribution`）
  - レート制限緩和のため `Cache-Control: s-maxage=60, stale-while-revalidate=300` を付与
  - 入出力は zod でバリデーション
- 環境変数を `.env.example` に追記
  - `IMAGE_SEARCH_PROVIDER` (`pexels` 固定運用)
  - `IMAGE_SEARCH_API_KEY` (Pexels の Personal API key)

### フロントエンド

- `/images/new` をタブ切り替え対応に拡張
  - URL 入力タブ: 既存 `ImageRegisterForm` を流用
  - 検索タブ: 新規 `ImageSearchPicker` コンポーネント
    - キーワード入力 + 検索ボタン
    - サムネイルグリッド（選択状態をハイライト）
    - 「もっと見る」（次ページ取得）
    - 選択中画像 URL を確定 → 既存 `POST /api/images` を呼ぶ
- 提供元クレジット表示: 「Photos provided by Pexels」とリンクを検索タブ下部に表示
- エラー表示: レート上限・ネットワーク失敗・空ヒットの 3 ケース

### テスト

- `tests/unit/lib/validation/image-search.test.ts` — クエリ / レスポンス zod スキーマの単体テスト
- `tests/unit/services/pexels-image-search-service.test.ts` — Pexels アダプタの正規化ロジック (fetch をスタブ)
- `tests/unit/api/images/search-route.test.ts` — Route Handler の 認証 / バリデーション / 正常系・エラー系
- `tests/e2e/image-search-register.test.ts` — タブ切り替え → キーワード検索 → 画像選択 → 登録までの E2E（外部 API は MSW 等のモックで再現）
- 既存 `tests/e2e/image-register.test.ts` が壊れていないことを確認

### ドキュメント

- `docs/product-requirements.md` — 「画像登録機能」にキーワード検索を追記
- `docs/functional-design.md` — 検索 API・フロー・キャッシュ戦略を追記
- `docs/architecture.md` — 外部依存に Pexels API を追記
- `README.md` / `.env.example` — Pexels API キー取得手順

## 受け入れ条件

- [ ] `/images/new` で「URL 入力」と「キーワード検索」をタブ等で切り替えられる
- [ ] キーワード検索タブで日本語 / 英語キーワード入力 → 候補画像のサムネイルが一覧表示される
- [ ] 候補画像 1 枚を選択 → 「この画像で登録する」で既存 `POST /api/images` に合流し、登録できる
- [ ] 重複検知 (pHash) が新フローでも機能する（既存ロジックを通すため自動的に担保）
- [ ] 「Photos provided by Pexels」クレジットが検索タブに表示される
- [ ] API キーがコミットされていない（`.env.example` のみ追加）
- [ ] レート上限到達 / ネットワークエラー / 0 件ヒットがそれぞれ識別可能なメッセージで表示される
- [ ] 既存の URL 入力フロー (`tests/e2e/image-register.test.ts`) が引き続き通る
- [ ] `npm run lint` / `npm run typecheck` / `npm test` がすべて通る

## スコープ外

- ファイルアップロード機能（別 issue）
- AI 画像生成（別 issue）
- 複数プロバイダー併用 / プロバイダー切替 UI（MVP 後）
- 検索結果のお気に入り保持・履歴
- E2E で実 Pexels API を叩く（モックで再現）
