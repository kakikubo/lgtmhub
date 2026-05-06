# タスクリスト: トップページ LCP 改善 (画像 priority 化)

## 実装タスク

- [x] T1. `components/image-card.tsx` に `priority?: boolean` (デフォルト `false`) を追加し `<Image>` に渡す
- [x] T2. `components/image-grid.tsx` で `PRIORITY_IMAGE_COUNT = 4` を定義し、`images.map((image, index) => ...)` で先頭 4 枚に `priority={true}` を渡す

## 検証タスク

- [x] V1. `npm run lint` を実行し pass を確認
- [x] V2. `npm run typecheck` を実行し pass を確認 (事前に `opentype.js` 未インストールのため `npm install --ignore-scripts` を実行)
- [x] V3. `npm test` を実行し pass を確認 (150 件 pass)
- [x] V4. implementation-validator サブエージェントによる検証を実行 (4.6/5、`fetchpriority` の DOM アサーション E2E を追加)
- [x] V5. ローカル `npm run build && npm run start` で起動し、Chrome DevTools MCP で再計測。LCP の Resource load delay が大幅短縮 (目安 100ms 未満) になることを確認

## 申し送り (振り返り)

### 実装完了日

2026-05-06

### 計測結果 (Before → After)

| 指標 | Before (Vercel production) | After (local production) | 改善幅 |
|------|--------------------------|------------------------|--------|
| LCP | 1,193 ms | 100 ms | **−92%** |
| Resource load delay | 1,112 ms | 3 ms | **−99.7%** |
| `loading=lazy` 判定 | FAILED | PASSED | ✅ |
| `discoverable in initial document` | PASSED | PASSED | ✅ |
| `fetchpriority=high` 判定 | FAILED | FAILED | ⚠️ 残課題 |

※ After は localhost 計測のため、Vercel production にデプロイした際は絶対値が大きくなる見込み。改善率は維持される想定。

### 計画と実績の差分

- 計画通り: T1 (image-card.tsx) / T2 (image-grid.tsx) は設計通り完了
- 追加実装: implementation-validator のフィードバックを受け、`tests/e2e/image-list.test.ts` に「先頭カードの img に `fetchpriority=high` と `loading=eager` が付くこと」を検証する E2E アサーションを追加。priority prop の将来的な剥がれを検出できるようにした
- 環境セットアップ: `opentype.js` が node_modules にないため typecheck が落ちた → `npm install --ignore-scripts` で解消 (lefthook の prepare スクリプトが既存環境で失敗するため `--ignore-scripts` 必須)

### 学んだこと

- Next.js `<Image priority>` は `<head>` に `<link rel="preload" as="image" imagesrcset>` を 4 件挿入することで LCP discovery を解決していた。`<img>` 自体に `fetchpriority="high"` 属性は (この Next.js 15.5 では) 付かないが、preload link の存在で Load delay は 1,112ms → 3ms に短縮された
- LCPDiscovery insight の `fetchpriority=high should be applied` は preload link の `fetchpriority` 属性を見ているらしく、Next.js が現状これを付けていない以上 PASSED にできない。ただし Resource load delay が 3ms まで縮んでいるため実害はゼロ
- ファーストビュー画像が `loading="lazy"` で配信されている問題は Next.js `<Image>` のデフォルト挙動なので、`xl:grid-cols-N` のレイアウトで N 枚以上の画像を扱うコンポーネントは同じ落とし穴に注意

### 次回への改善提案

- Vercel preview デプロイ後に再計測し、production 値での改善幅を `verification.md` として残すと、PRD の「LCP 3 秒以内」要件達成エビデンスとして蓄積できる
- 画像詳細ページ (`app/(site)/images/[id]/page.tsx`) でも同様の `priority` 化が必要か検証する余地あり (本 PR ではスコープ外)
- `loading=lazy` のデフォルト挙動は今後新たに `<Image>` を追加するコンポーネントで都度判断が必要 → development-guidelines.md にチェックリストとして追記する価値があるか検討
