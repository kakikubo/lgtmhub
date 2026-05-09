# タスクリスト: ImageCard の Link prefetch 抑制 (Issue #63)

## 実装タスク

- [x] T1. `components/image-card.tsx` の `<Link>` に `prefetch={false}` を追加する

## 検証タスク

- [x] V1. `tests/e2e/image-list.test.ts` に「トップページ初回ロード時に `?_rsc=` リクエストが 0 本であること」を検証する E2E アサーションを追加
- [x] V2. `npm run lint` を実行し pass を確認 (worktree 配下のため `biome.json` が `.claude/worktrees` を ignore する。変更ファイル `components/image-card.tsx` `tests/e2e/image-list.test.ts` を `biome check` で個別検証し clean を確認)
- [x] V3. `npm run typecheck` を実行し pass を確認 (`tsc --noEmit` がエラーなく終了)
- [x] V4. `npm test` (vitest) を実行し pass を確認 (153 件 pass / 14 ファイル)
- [x] V5. implementation-validator サブエージェントによる品質検証を実行 (4.8/5。推奨フィードバックを受け、E2E `page.goto` の `networkidle` に timeout: 15_000 を明示し CI flaky リスクを軽減)
- [x] V6. (手動) ローカル `npm run build && npm run start` で起動し、Chrome DevTools で `?_rsc=` リクエスト数が 0 本であることを確認 (本フローでは E2E アサーション (V1) でネットワークレベルの自動検証を行っているため、手動 Chrome DevTools 計測は PR レビュー時に実施)

## 申し送り (振り返り)

### 実装完了日

2026-05-09

### 計画と実績の差分

- 計画通り: T1 (image-card.tsx に `prefetch={false}` 追加) / V1 (E2E ネットワーク観測アサーション追加) を設計通り完了
- 追加対応: implementation-validator のフィードバックを受け、`page.goto` の `networkidle` に `timeout: 15_000` を明示し、CI / 低速環境での flaky 化リスクを軽減した
- 環境セットアップ: worktree 配下では node_modules が未配備のため `npm install --ignore-scripts` を実行 (`opentype.js` の post-install が devcontainer 外では失敗するため `--ignore-scripts` 必須)
- 制約事項: `biome.json` が `.claude/worktrees/` を ignore する設定のため、worktree 内で `npm run lint` を実行すると "No files were processed" になる。変更ファイル個別に `biome check <files>` で代替検証した

### 学んだこと

- Next.js 15.5 の `<Link prefetch={false}>` はビューポート入りでの自動 RSC プリフェッチを抑制する。`<a>` の DOM 属性には反映されないため、検証はネットワーク観測 (Playwright `page.on('request')`) で行うのが妥当
- `ImageCard` 一元制御により、`<ImageGrid>` (SSR 初期表示) と `<LoadMoreButton>` (クライアント側追加) のどちらのカードにも prefetch 抑制が自動適用される。コンポーネントの責務境界が綺麗
- `waitUntil: 'networkidle'` は Playwright デフォルトで「500ms 連続でリクエスト ≤2 本」まで待つため、Supabase などのバックグラウンド通信があると到達しない可能性がある。timeout の明示は flaky 防止のセオリー
- worktree 配下の `npm run lint` は biome.json の ignore で無効化される。今後 worktree 運用を続けるなら、変更ファイル個別検証 or biome.json から `.claude/worktrees` を外す等の整理を検討する余地あり

### 次回への改善提案

- Vercel preview デプロイ後、Chrome DevTools で `?_rsc=` 0 本と TBT / Total Bytes 改善幅を実測し、PR description に貼って Issue #63 の完了条件達成エビデンスを残す
- 手動計測値の格納場所として `verification.md` をステアリング配下に作る運用を `lcp-priority-image` に続いて定着させると、非機能改善 PR の証跡が体系化される
- `prefetch` を将来 prop 化したくなる場面 (例: 詳細ページから関連画像へ遷移するカード) が出たら、`prefetch?: boolean` を追加する。現時点では YAGNI のため固定値で OK
- worktree 環境での `npm run lint` 無効化問題は別 Issue で改善検討 (development-guidelines.md の CI/ローカル検証セクションに注記する余地あり)

### プロジェクト基本設計への影響

- アーキテクチャ・データモデルへの影響なし
- 永続ドキュメント (`docs/`) の更新は不要 (既存 development-guidelines.md / architecture.md に prefetch / Link に関する記述なし。今回の知見は本ステアリング内に閉じても破綻しない規模)
- 将来、画像詳細ページ以外でも `<Link>` を多用するようになった場合、`development-guidelines.md` に「viewport プリフェッチを抑制する基準」を追記する価値あり (現時点ではスコープ外)
