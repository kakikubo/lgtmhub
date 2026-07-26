# 設計: 登録ファイル形式に WebP を追加する

## 変更点サマリ

1. `src/lib/image/validate-image.ts`
   - `ALLOWED_IMAGE_FORMATS` に `'webp'` を追加。
   - エラーメッセージを「JPEG・PNG・GIF・WebP 形式の画像を使用してください」に更新。
   - フレーム数上限 (`MAX_GIF_FRAMES`) はそのまま。コメントを「アニメ入力 (GIF / WebP) で共有」に更新。
2. `src/lib/http/safe-fetch.ts`
   - `DEFAULT_ALLOWED_CONTENT_TYPES` に `'image/webp'` を追加。
   - 拒否時のエラーメッセージを「JPEG・PNG・GIF・WebP 形式の画像 URL を入力してください」に更新。
3. `src/lib/image/compose-lgtm.ts`
   - 変更不要。`sharp({ animated: true })` は WebP 入力（静止・アニメ）も pages 数に応じて同じパスで処理する。
4. テスト
   - `tests/unit/lib/image/validate-image.test.ts`: WebP 拒否テストを WebP 受理テストへ反転し、アニメ WebP の pages>1 受理ケースを追加。エラーメッセージ assertion (`'JPEG'`) はそのまま (語頭は維持)。
   - `tests/unit/lib/image/compose-lgtm.test.ts`: 静止 WebP / アニメ WebP の入力を 1 ケースずつ追加。
   - `tests/unit/services/image-service.test.ts`: `safe-fetch` / `validate-image` モックの定数を WebP 込みに更新。
5. ドキュメント
   - `docs/product-requirements.md` L92: 対応フォーマットに WebP を追加。
   - `docs/functional-design.md`: エラーメッセージ表 (L709, L763) と該当行を WebP を含む表記に更新。

## 設計判断

- **定数名**: `MAX_GIF_FRAMES` を維持。命名変更は本 PR のスコープを超えるため別 Issue 化候補とし、コメントだけ「アニメ入力全般（GIF / WebP）で共有」に更新する。
- **アニメ WebP 生成方法 (テスト)**: sharp で純粋なアニメ WebP を作るのも GIF 同様に「縦タイル + pageHeight + animated 指定」のテクニックが必要。既存 `makeAnimatedGif` を参考にし、`.webp({ loop: 0, delay })` で書き出すヘルパーを compose-lgtm.test.ts / validate-image.test.ts に追加する。
- **エラーメッセージ後方互換**: 既存テストは `expect(...).toThrow('JPEG')` のように先頭の `JPEG` を部分一致で assert している。`JPEG・PNG・GIF・WebP` でも `JPEG` で始まるので互換維持。
- **PRD L241 (ファイルアップロード / P2)** は別機能の未着手項目のため変更しない。Issue #213 のスコープを「URL 登録 (P0)」に限定する。

## リスク

- 既存ユーザーがアップロード済みの「WebP を拒否すると思い込んだ UI 文言」がある場合、フロント側にハードコードされた文字列がないか確認する必要がある（実装時に grep 確認）。
