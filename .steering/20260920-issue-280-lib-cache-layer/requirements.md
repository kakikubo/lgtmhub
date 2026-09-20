# 要求内容

## 概要

`src/lib/cache/list-home-images.ts` の lib → services 逆依存を解消し、キャッシュ境界を `src/services/cache/` へ移す。Issue #280。

## 背景

`src/lib/cache/list-home-images.ts` が `buildImageService` を import しており、CLAUDE.md / `docs/repository-structure.md` の規約「レイヤー依存は app → src/services → src/repositories, src/lib の単方向」に違反している。

cache を lib 配下に置いた経緯は `'use cache'` 境界を切り出すためだったが、依存方向としては明確な規約違反であり、規約を信頼して作業する開発者・AI エージェントを混乱させる。

Issue は案A（services へ移動）を推奨している。案B（規約に例外を足す）は採らない。

## 実装対象の機能

### 1. キャッシュ境界の移動

- `list-home-images.ts` を `src/services/cache/list-home-images.ts` へ移動する
- 公開 API（`getHomeImagesInitial` / `HOME_IMAGES_CACHE_TAG`）と `'use cache'` の挙動は変えない
- 参照箇所の import パスを漏れなく更新する

### 2. ドキュメントと規約の同期

- `docs/repository-structure.md` / `docs/architecture.md` / `src/CLAUDE.md` / `app/api/CLAUDE.md` のパスと依存ルールを実体に合わせる
- `components/HomeContent`（Server Component）が `src/services/cache/` を import してよいことを明記する

### 3. カバレッジ維持

- 移動先は `src/services/**`（閾値 90%）に入るため、ユニットテストを追加する

## 受け入れ条件

### キャッシュ境界の移動
- [ ] `src/lib/cache/` が存在しない
- [ ] `src/services/cache/list-home-images.ts` が `buildImageService` を呼び、`'use cache'` / `cacheTag` / `cacheLife('max')` を維持する
- [ ] 本番コード・テストの import がすべて新パスを指す
- [ ] `grep -n "src/lib/cache" --include='*.ts' --include='*.tsx' --include='*.md'` が docs / CLAUDE.md の現行記述で 0 件（過去の `.steering/` は対象外）

### ドキュメント
- [ ] レイヤー図とディレクトリツリーが新配置と一致する
- [ ] lib → services 禁止が維持され、例外として cache を lib に置く記述がない

### 検証
- [ ] `pnpm run check` / `pnpm run typecheck` / `pnpm run test` が通る

## 成功指標

- lib → services の逆依存がコード上もドキュメント上も存在しない
- トップページ初期一覧のキャッシュ無効化（`revalidateTag(HOME_IMAGES_CACHE_TAG, 'max')`）が同じ定数を参照し続ける

## スコープ外

以下はこのフェーズでは実装しません:

- `'use cache'` から別キャッシュ API への切り替え
- `HomeContent` を `app/` へ移すリファクタ
- 過去の `.steering/` 履歴ドキュメントのパス書き換え

## 参照ドキュメント

- Issue #280
- `docs/repository-structure.md` - レイヤー依存とディレクトリツリー
- `docs/architecture.md` - 初期画像一覧のキャッシュ
- `docs/development-guidelines.md` - カバレッジ閾値
- `src/CLAUDE.md` / `app/api/CLAUDE.md`
