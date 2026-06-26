# タスクリスト: 登録ファイル形式に WebP を追加する

参照: [Issue #213](https://github.com/kakikubo/lgtmhub/issues/213)

## 実装タスク

- [x] `src/lib/image/validate-image.ts` の `ALLOWED_IMAGE_FORMATS` に `'webp'` を追加し、エラーメッセージと `MAX_GIF_FRAMES` コメントを更新
- [x] `src/lib/http/safe-fetch.ts` の `DEFAULT_ALLOWED_CONTENT_TYPES` に `'image/webp'` を追加し、エラーメッセージを更新
- [x] フロント側のハードコード文言 (「JPEG・PNG・GIF」等) を grep で洗い出し、必要があれば更新 (components/image-register-form.tsx を更新)
- [x] `tests/unit/lib/image/validate-image.test.ts`: WebP 拒否テストを受理テストに反転し、アニメ WebP の受理ケースを追加
- [x] `tests/unit/lib/image/compose-lgtm.test.ts`: 静止 WebP / アニメ WebP の入力ケースを追加 (アニメ WebP 生成ヘルパーを実装)
- [x] `tests/unit/services/image-service.test.ts`: モックの `DEFAULT_ALLOWED_CONTENT_TYPES` / `ALLOWED_IMAGE_FORMATS` に WebP を追加
- [x] `docs/product-requirements.md` L92 の対応フォーマット表記を「JPEG・PNG・GIF・WebP」に更新
- [x] `docs/functional-design.md` のエラーメッセージ表 / 説明文を WebP 込みに更新
- [x] `implementation-validator` による品質検証 (総合 5/5、改善 2 件指摘→対応済み)
- [x] `npm test` / `npm run lint` / `npm run typecheck` を green (test 208/208, lint info のみ, typecheck エラーなし)
- [x] 振り返り: 計画と実績の差分、学び、次回への改善提案を記載

## 振り返り (2026-06-26 完了)

### 計画と実績の差分

- **計画通り**: validate-image / safe-fetch / フロント文言 / 各テスト / PRD / 機能設計の更新は当初計画どおり。compose-lgtm.ts は予想どおり変更不要だった。
- **追加対応**: implementation-validator から 2 件の改善指摘を受けて以下を追加対応した。
  - `src/lib/image/compose-lgtm.ts`: アニメーション処理のエラー文言 `'GIF のフレーム高さを判定できませんでした'` → `'アニメーション画像のフレーム高さを判定できませんでした'` (WebP もこのパスを通るため一般化)。
  - `docs/functional-design.md` L763 のエラーメッセージ表記を実装側 (`WebP 形式の画像 URL`) のスペースありに統一。

### 学んだこと

- `sharp({ animated: true })` は入力フォーマット非依存で `pages` / `pageHeight` を縦タイル化して扱うため、アニメ GIF パスをそのままアニメ WebP 入力で流用できる。compose 層の変更ゼロで対応できた。
- アニメ WebP のテストデータ生成は GIF と同じ「縦タイル + pageHeight + 毎フレーム RGB 変化 + delay 配列長 = フレーム数」のレシピで再現できる ([[sharp-animated-gotchas]] と同じ罠を踏む)。
- 機能設計ドキュメントとコードの文言は実装に合わせて表記揺れを除く（半角スペース有無等）と、検証時の差分検出コストが下がる。

### 次回への改善提案

- スコープの広い変更 (許可リスト追加など) では、コード側だけでなくフロント UI の文言・テスト名 / コメント中のフォーマット表記まで含めて事前に grep するチェックを最初の調査ステップに入れる。
- 「定数名 (`MAX_GIF_FRAMES` → `MAX_ANIMATED_FRAMES` 等) の改名」は本 PR のスコープ外として明示的に別 Issue 化候補とした。後追いで Issue を立てる。
