# tasklist.md

## 実装タスク (一覧側の profile 受け渡し削除)

- [x] `components/image-card.tsx` から投稿者アバターブロックと `profile` props を削除
- [x] `components/image-grid.tsx` から `profiles` props と `ImageCard` への受け渡しを削除
- [x] `components/load-more-button.tsx` から `profiles` state と `json.profiles` 参照を削除
- [x] `components/home-images.tsx` から `initialProfiles` / `randomProfiles` / `profileMap` を削除
- [x] `components/home-content.tsx` から `fetchUploaderProfiles` 関数と `initialProfiles` 受け渡しを削除
- [x] `app/api/images/route.ts` から `buildUserProfileService` 呼び出しと `profiles` 同梱を削除
- [x] `app/api/images/random/route.ts` から `buildUserProfileService` 呼び出しと `profiles` 同梱を削除
- [x] `src/lib/validation/image.ts` のレスポンススキーマから `profiles` を削除し、`userProfileResponseSchema` / `UserProfileResponse` 型も削除

## 実装タスク (詳細ページへの投稿者行追加)

- [x] `components/uploader-profile-row.tsx` を新規作成し、投稿者行 (`投稿者： アバター 表示名 (link)`) を描画
- [x] `app/(site)/images/[id]/page.tsx` で `UserProfileService.findById(uploaderId)` を呼び、`UploaderProfileRow` を `DetailView` に組み込む

## テスト更新タスク

- [x] `tests/unit/api/images/list-route.test.ts` から profile 関連のテストを削除
- [x] `tests/unit/api/images/random-route.test.ts` から profile 関連のテストを削除
- [x] `tests/unit/lib/validation/image.test.ts` から `profiles` 関連テストを削除し、サンプル入力を更新
- [x] `tests/e2e/image-list.test.ts` から「投稿者行」「GitHub リンク」「fallback」関連テストを削除
- [x] `tests/e2e/image-detail.test.ts` に「投稿者行が表示される」「fallback でもリンクは張られない」テストを追加

## 検証タスク

- [x] `npm run lint` がエラー無し (npm スクリプトはラッパー由来のパース失敗が出るため `./node_modules/.bin/biome lint .` で確認: "No fixes applied" / 0 errors)
- [x] `npm run typecheck` がエラー無し (`tsc --noEmit` 通過)
- [x] `npm test` がすべて pass (18 ファイル / 194 件)

## 申し送り

### 実装完了日

2026-05-21

### 計画と実績の差分

- 計画通りに完了。設計書に書いた「下流 → 上流」の順 (ImageCard → ImageGrid → LoadMoreButton → HomeImages → home-content → API route → schema → 詳細ページ追加) で進めることで、各ステップが独立してビルド可能な状態を保てた
- 「採用しなかった案」として `profiles` をスキーマに残す案も検討したが、同 PR 内で全消費者を更新できる前提のため思い切って削除。結果として API スキーマも router もシンプルになった
- implementation-validator の総合スコアは 5/5、検出された問題なし

### 学んだこと

- **「機能の場所を移す」変更は、移動先の追加よりも移動元の経路削除の方が広範囲になりがち**: 一覧側は `home-content → HomeImages → ImageGrid → ImageCard` / `LoadMoreButton → ImageGrid` の二系統 + 両方の API 経由でクライアントが受け取る profiles の zod 検証 + テスト、と削除箇所が多かった
- **逐次取得 vs 並列取得の選択基準**: 詳細ページの `findById(uploaderId)` は逐次 (`Promise.all` の後に追加で 1 回) になる。「画像取得後でないと uploaderId が分からない」制約が本質で、最適化は不可能と割り切るのが正解だった
- **`data-testid` + `data-fallback` の命名規則の威力**: 既存の `image-card-uploader` / `data-fallback="true|false"` のパターンを `image-detail-uploader` に踏襲したことで、E2E テストの書き方も一覧側と整合し、レビューしやすかった
- **npm スクリプト経由の lint 結果に注意**: 環境のラッパー (おそらく rtk 系) が `npm run lint` の出力を解釈しようとして "ESLint output JSON parse failed" を表示するが、これはラッパー側の問題で実際の biome lint は通っている。`./node_modules/.bin/biome lint .` を直接叩くのが確実

### 次回への改善提案

- **「データ取得経路の整理」が伴う Issue は、最初に経路の全体像を Grep して可視化すると見通しが立ちやすい**: 今回は `Grep "ImageGrid|profile=|initialProfiles|fetchUploaderProfiles"` で全消費者を 1 ショットで列挙できた。これを設計段階で行うのが効率的
- **E2E の fallback ケースは「データ依存しないパターン」で skip 扱いになる**: 詳細ページの `data-fallback="true"` ケースは seed データに依存するため E2E では `test.skip` 扱い。fallback ロジックは `resolveUploaderDisplay.test.ts` のユニットで担保されているが、専用の fixture を用意して E2E でも検証する案は将来的に検討してもよい
- **API レスポンススキーマの破壊的変更は同 PR 内で全クライアントを更新する**: 今回の `listImagesResponseSchema` / `randomImagesResponseSchema` から `profiles` フィールド削除は破壊的だが、本リポジトリ内の唯一の消費者 (`LoadMoreButton` / `HomeImages`) も同 PR で更新したため、デプロイ順序の懸念は不要だった。レビューで「破壊的変更だが影響範囲はリポジトリ内に閉じている」点を明示すると安心感が上がる
