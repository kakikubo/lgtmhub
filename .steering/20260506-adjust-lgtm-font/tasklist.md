# タスクリスト: LGTM画像フォント調整

## タスク

- [x] Archivo Black TTF と OFL.txt を `public/fonts/` にダウンロード配置
- [x] 不要になった `public/fonts/Roboto-Black.ttf` を削除
- [x] `src/lib/image/compose-lgtm.ts` の `FONT_PATH` / `FONT_FAMILY` を Archivo Black に差し替え
- [x] `docs/functional-design.md` の font-family サンプルを `Archivo Black, sans-serif` に更新
- [x] `tests/unit/lib/image/compose-lgtm.test.ts` にフォントファイル存在確認テストを追加
- [x] `npm test` が全てパスすることを確認 (150/150 pass)
- [x] `npm run lint` / `npm run typecheck` がエラーなしで完了することを確認 (lint は worktree 内では biome の `!**/.claude/worktrees` 除外設定により `.` 全体がスキップされるため、変更ファイル個別に `npx biome check src/lib/image/compose-lgtm.ts tests/unit/lib/image/compose-lgtm.test.ts` を実行して clean を確認。typecheck は無エラー)

## 申し送り事項

### 実装完了日
2026-05-06

### 計画と実績の差分
- 計画通り。追加の構造変更なし。
- フォントは Archivo Black (OFL-1.1) を Google Fonts 公式 (`google/fonts` リポジトリ) から取得し `public/fonts/` に同梱。Roboto-Black.ttf は削除。
- ドキュメント (`docs/functional-design.md`) の `font-family` を実装と統一 (`Arial Black` → `Archivo Black`)。

### 学んだこと
- `sharp` の Pango 経由テキスト合成では `fontfile` 指定でリポジトリ同梱 TTF を直接読ませる構成が既に確立しており、フォント差し替えは定数 2 行の変更で完結する。
- `biome.json` の `!**/.claude/worktrees` 除外設定により、worktree 内から `npm run lint` を実行すると `.` パスが ignored 扱いになる (CI/メインリポジトリでは正常)。
- OFL ライセンスフォントを再配布する場合は OFL.txt をフォント本体と同フォルダに配置する必要がある。

### 次回への改善提案
- worktree 内でも lint がローカル実行できるよう、biome の `includes` 除外パターンを `**/.claude/worktrees/*/...` のように調整するか、worktree 用のスクリプトを追加すると DX が改善する。
- フォント読み込み失敗時の早期検出 (起動時 `existsSync` アサーション) は任意改善として検討可能。現状はユニットテストでファイル存在を保証しているため必須ではない。
- 将来 LGTM 文字以外のテキスト合成 (例: ユーザ指定キャプション) を行う場合、フォント定数を `lib/image/fonts.ts` 等に切り出して再利用すると拡張しやすい。
