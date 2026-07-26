# tasklist.md — 一覧画面にランダム表示機能 (Issue #109)

## 実装タスク

- [x] T1: `ImageRepository` に `listActiveIds()` を追加
- [x] T2: `ImageRepository` に `findManyActiveByIds(ids)` を追加 (空配列ガード)
- [x] T3: `ImageService` に `RandomImagesResult` 型と `listRandomImages()` を追加 (Fisher-Yates / 整列 / デフォルト limit=16)
- [x] T4: `src/lib/validation/image.ts` に `imageListItemSchema` 抽出 + `randomImagesResponseSchema` / `RandomImagesResponse` 追加
- [x] T5: `app/api/images/random/route.ts` GET を追加 (no-store / force-dynamic)
- [x] T6: `components/home-images.tsx` ('use client') を新規作成 (ボタン + default/random 切替 + Empty/Error 集約)
- [x] T7: `components/home-content.tsx` を `HomeImages` 利用へ改修 (profileMap → UserProfile[])
- [x] T8: 単体テスト追加: `image-repository.test.ts` (listActiveIds / findManyActiveByIds)
- [x] T9: 単体テスト追加: `image-service.test.ts` (listRandomImages)
- [x] T10: 単体テスト追加: `tests/unit/lib/validation/image.test.ts` (randomImagesResponseSchema)
- [x] T11: E2E 追加: `tests/e2e/image-list.test.ts` にランダム表示の describe を追加
- [x] T12: ドキュメント更新: `docs/functional-design.md` (API 設計にランダム取得を追記) / `docs/architecture.md` (キャッシュ戦略に no-store を追記)

## 検証タスク

- [x] V1: implementation-validator サブエージェントで品質検証 (総合 5/5・Critical なし・全受け入れ条件充足。Warning 1〔`as T` コメント〕/ Warning 2〔E2E リロード検証強化〕を反映済み)
- [x] V2: `npm test` (189 passed) / `npm run typecheck` (exit 0) / lint (CI 相当の `biome lint src app components tests` 67ファイル エラー0)。※ `npm run lint`=`biome lint .` は worktree 配下で `.` が `!**/.claude/worktrees` 除外に該当し「0ファイル」で exit 1 となる既存の構造的制約 (origin/main でも同様、CI はリポジトリルートで実行のため影響なし)
- [x] V3: 振り返りを本ファイルに追記

## 申し送り事項

### 実装完了日
2026-05-18

### 計画と実績の差分
- 計画どおり T1〜T12 を完遂。タスク分割・方式選定の変更なし。
- 追加対応 (検証フィードバック由来):
  - `shuffle` の `as T` にガイドライン準拠の理由コメントを追記 (Warning 1)。
  - `home-images.tsx` の wrapper に `data-testid="home-images"` / `data-mode` を付与し、
    E2E でモード遷移・リロード復帰を**決定的に**検証できるよう強化 (Warning 2)。
  - biome フォーマット差分 (`listRandomImages` のシグネチャ1行化) と
    `image-service.test.ts` の import 並び順を修正。

### 学んだこと
- **依存 Issue の取り込み確認は必須**: worktree のベースが古い main で #108 未取込
  (`LIST_IMAGES_DEFAULT_LIMIT=20`) だった。`git fetch` → `origin/main` 確認 →
  `reset --hard origin/main` で最新化してから着手した。依存ありの Issue は
  最初に「依存実装が現ブランチ履歴にあるか」を `git merge-base --is-ancestor` で確認する。
- **worktree での lint 制約**: `biome.json` の `!**/.claude/worktrees` により
  worktree 配下では `biome lint .` が 0 ファイル→exit 1 になる。実体検証は
  明示パス (`src app components tests`) で行う必要がある (CI はルート実行のため無問題)。
- **RSC→Client の Map 受け渡し回避**: `Map<string,UserProfile>` を props で
  渡さず `UserProfile[]` + クライアント `useMemo` で再構築する既存制約対処を踏襲。
- **ランダム抽出方式**: migration/型再生成不要な「全 id 取得→サーバー
  Fisher-Yates→本体取得」を採用。既存 `listActivePHashes`(全件 id+p_hash) より
  軽量で、現データ規模前提と整合。10 万件超で RPC/pgvector 移行を検討 (docs に明記)。

### 次回への改善提案
- `GET /api/images/random` の Route Handler 統合テストは未追加 (Service/Repository
  /validation/E2E でカバー)。中期的に `tests/unit/api/images/` 配下へ追加が望ましい。
- worktree でも `npm run lint` が機能するよう、別 Issue で lint スクリプトを
  明示パス指定に変更する改善余地あり (本 PR の関心事外のため未対応)。
