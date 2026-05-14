# タスクリスト: 画像保存サイズを長辺400pxに縮小

- [x] `src/lib/image/compose-lgtm.ts`: MAX_LONG_SIDE を 800 → 400 に変更
- [x] `app/(site)/images/[id]/page.tsx`: max-w-[800px] → max-w-[400px]、sizes属性を更新
- [x] `tests/unit/lib/image/compose-lgtm.test.ts`: テスト期待値を400px基準に更新
- [x] `tests/unit/services/image-service.test.ts`: MAX_LONG_SIDE モックを 800 → 400 に更新
- [x] `npm test` / `npm run lint` / `npm run typecheck` を実行して全パスを確認 (typecheckは@vercel/*パッケージ未インストールによる既存エラーのみで今回変更と無関係)
- [x] docs/に残存していた「800px」を7箇所「400px」に更新
- [x] image-service.test.ts の composeLgtmImage モック戻り値を width:400, height:300 に揃え

---

## 申し送り事項

- **実装完了日**: 2026-05-14
- **計画と実績の差分**:
  - 計画外で `docs/` 配下7箇所の「800px」記述を「400px」に更新（実装検証サブエージェントが検出）
  - `image-service.test.ts` のモック戻り値 width:800→400 も合わせて修正
- **学んだこと**:
  - テスト期待値は `MAX_LONG_SIDE` から逆算した `floor()` 結果を手計算で確認してから記述すること
  - 「原画未満テスト」の画像サイズは新しい MAX_LONG_SIDE を下回る値にしないと、縮小テストになってしまう
- **次回への改善提案**:
  - 既存画像（800px保存済み）の表示について、新しい max-w-[400px] コンテナ内で適切に表示されるかは本番環境で目視確認すること
  - scripts/preview-lgtm-fonts.ts の CANVAS_HEIGHT=800 は任意で 400 に揃えることを検討

