# Requirements — 管理者限定 LGTM 画像再生成

## 背景

- 現状、一度作成した LGTM 画像を作り直す手段がない。合成処理の改善・初回合成の崩れ・元画像の差し替え等に対応できない。
- 「元画像から作り直す」 or 「別 URL に差し替えて作り直す」を両方カバーする必要がある。
- 管理者運用のため、一般ユーザーには露出しない。

Issue: https://github.com/kakikubo/lgtmhub/issues/195

## スコープ (Must)

### UI

- 画像詳細ページ `app/(site)/images/[id]/page.tsx` に、**管理者 (`user_profiles.is_admin = true`) のみに表示**される「再生成」アクションを追加する。
- 削除アクション (所有者のみ) とは権限軸が別のため、別ファイル `components/image-regenerate-action.tsx` (`'use client'`) に切り出す。
- 既存の削除 `AlertDialog` パターンを踏襲した確認ダイアログを持つ。
  - 入力欄に現在の `original_url` をプリフィルし、必要なら差し替え可能。
  - 「再生成」実行 → 処理中ローディング → 成功で `router.refresh()`、失敗でエラー表示。
- `page.tsx` で `user_profiles.is_admin` を引き `isAdmin` を渡す。

### API

- 新規: `POST /api/images/[id]/regenerate`
  - Body: `{ originalUrl?: string }` (JSON)。省略時は既存の `original_url` を再利用。
- 認可: **再利用可能な `requireAdmin(supabase)` ヘルパーを `src/lib/auth/` に新設**。非管理者には 403 を返す。将来の管理者機能 (PRD 機能6) で共有する。

### 再生成処理フロー

`ImageService.createImage()` は共通部分を抜き出せていないため、共通の内部ロジック (取得 → 検証 → pHash → 合成 → Blob put) を **プライベート helper に切り出し** てから再利用する (ExtractMethod)。差分:

1. 対象 URL (差し替え or 既存) から `safeFetch` で取得 → `validateImage` → `calculatePHash` → `composeLgtmImage`。
2. **重複判定は自レコード ID を除外**。
3. **日次アップロード数はカウントしない**。
4. **新しい Blob キー (新 UUID) で put** し、DB の `image_url` を更新。immutable 設計維持。
5. DB 更新後、**旧 Blob を削除**。
6. `revalidateTag(HOME_IMAGES_CACHE_TAG, 'max')` を呼ぶ。

### DB 更新カラム

| カラム | 扱い |
|--------|------|
| `image_url`, `p_hash`, `width`, `height`, `file_size_bytes`, `is_animated`, `mime_type`, `updated_at` | 必ず更新 (mime_type は現状 `image/webp` 固定だが Insert 時と揃えるため update する) |
| `original_url` | URL 差し替え時のみ更新 |
| `id`, `uploader_id`, `created_at`, `status` | 据え置き |

- **監査カラム (`regenerated_by`, `regenerated_at`) は追加しない**。「誰がどの画像を再生成したか」は **サーバログ (`console.info`)** に出す。

### 失敗時の挙動 (アトミック性)

- 取得・検証・合成がすべて成功するまで **既存レコード / Blob には一切触れない**。
- 差し替え URL が 404 / 取得失敗 / 検証 NG のとき、既存画像は無傷でエラーを返す。
- 新 Blob put 成功後の DB 更新失敗 → 新 Blob をベストエフォートで削除。
- DB 更新成功後の旧 Blob 削除失敗 → 孤児 Blob をログに残し、日次クリーンアップに委ねる (2 フェーズコミットは行わない)。

## Out of Scope

- 一括再生成 (バッチ)
- 管理者による任意画像の削除 (PRD 機能6) — 今回は `requireAdmin()` の土台のみ提供
- 監査テーブル / カラムによる履歴永続化
- 旧画像の世代保持
- 元画像消失の自動検知・通知

## 受け入れ条件

- [ ] 管理者として詳細ページを開くと再生成アクションが表示され、非管理者には表示されない。
- [ ] `POST /api/images/[id]/regenerate` が非管理者に対して 403 を返す。
- [ ] URL を省略した再生成で、既存 `original_url` から画像が作り直され、`image_url` が新 URL に更新される。
- [ ] URL を差し替えた再生成で、新 URL から画像が作り直され、`original_url` と `image_url` が更新される。
- [ ] 再生成で日次アップロード数が増えない (`daily_upload_counts` は変化しない)。
- [ ] 重複判定で自レコードが除外され、同一 URL 再生成が弾かれない。
- [ ] 取得 / 検証失敗時に既存画像が無傷で残り、エラーが表示される。
- [ ] 再生成後、一覧・詳細のキャッシュが無効化される。
- [ ] 旧 Blob が削除される。
- [ ] 誰が再生成したかがサーバログに残る。

## 非機能

- `pnpm run check` / `pnpm run typecheck` / `pnpm run test` が通る。
- 既存の `as` キャスト / `any` 使用制約 (development-guidelines) を遵守。
- レイヤー依存: `app → src/services → src/repositories, src/lib` の単方向。
