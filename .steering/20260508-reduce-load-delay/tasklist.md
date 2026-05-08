# タスクリスト

## 実装

- [x] `components/image-card.tsx` の `<Image>` を `unoptimized` + 固定 `width={266} height={199}` に書き換える
  - `fill` を削除
  - `sizes` を `"266px"` に変更
  - `className` を `"h-auto w-full object-cover"` に変更
  - 親 `div` の `relative` と `aspect-[4/3]` を削除
- [x] `npm run dev` でローカル起動し、トップページ画像が `https://*.public.blob.vercel-storage.com/...` に直リンクされていることを目視確認 (DevTools Network)
  - `_next/image` リクエストが 0 件であること (chrome-devtools MCP で確認: 6/6 画像が Blob 直)
  - 画像表示が崩れないこと (`<img>` の表示 width/height = 266/199 を確認、srcset なし)

## 検証

- [x] `npm run lint` がパスする (biome lint components/image-card.tsx で確認、worktree は biome.json で除外されているため対象ファイルを直接指定)
- [x] `npm run typecheck` がパスする (tsc --noEmit エラーなし)
- [x] `npm test` (vitest) がパスする (14 ファイル / 153 tests pass)
- [x] ~~`tests/e2e/image-list.test.ts` の既存検証 (fetchpriority=high / loading=eager) が壊れていないことを確認~~ (理由: 検証の結果、`next/image` の `priority` は dev 環境で `<img>` 属性化されない仕様であり、本変更前後とも `null`。E2E テスト自体が意図通り動作していない既知の問題で、本 PR のスコープ外。implementation-validator も別 PR を推奨)

## 振り返り

- [x] tasklist.md に申し送り事項を記載 (下記参照)
- [x] 詳細ページ (`app/(site)/images/[id]/page.tsx`) も同様に `unoptimized` 化すべきか判断 (下記参照)
- [x] 必要に応じて `docs/architecture.md` の「キャッシュ戦略」へ追記検討 (下記参照)

---

## 申し送り事項

### 実装完了日

2026-05-08

### 計画と実績の差分

- 計画通り `components/image-card.tsx` のみの変更で完了。他コンポーネントを巻き込まず 1 PR = 1 関心事を保てた
- design.md で記載した After 形 (`width=266 height=199`, `sizes="266px"`, `unoptimized`, `h-auto w-full object-cover`, `aspect-[4/3]` と `relative` を削除) をそのまま実装
- Chrome DevTools MCP で dev サーバーを目視確認: `_next/image` リクエスト 0、6 枚 (環境内の全画像) が Vercel Blob 直配信、`<img width=266 height=199 srcset=null>` を確認

### 学んだこと

1. **`next/image` の `priority` は `<img>` 属性に直接出力されない**: 既存 E2E テスト (`tests/e2e/image-list.test.ts:37-38`) は `fetchpriority="high"` / `loading="eager"` を期待しているが、Next.js 15.5.15 の `node_modules/next/dist/shared/lib/get-img-props.js` を確認した結果、`priority` 属性は `<link rel="preload">` を出力するだけで `<img>` の属性化は行わない。`fetchPriority` プロパティは destructure された値をそのまま forward しているだけで、`priority` から自動派生はしない。dev 環境で main ブランチのコードでも同じく `null` が出ることを確認済み。
2. **biome.json の `!**/.claude/worktrees`**: lint の `npm run lint` を worktree 内で実行すると除外されるため、対象ファイルを直接指定 (`./node_modules/.bin/biome lint components/image-card.tsx`) する必要がある。CI は main ブランチで lint するので問題は出ない。
3. **prepare スクリプト (lefthook install)**: worktree で `npm install` する場合、`core.hooksPath` が main 側に設定済みのため `lefthook install` が失敗する。`--ignore-scripts` で回避できる。

### 詳細ページ (`/images/[id]`) への同期適用について

詳細ページの `<Image>` も同様に `unoptimized` 化すべきだが、本 PR ではスコープ外とする。理由:

- 1 PR = 1 関心事原則 (PR principle)。トップページの LCP 削減と詳細ページの最適化は独立した issue
- 詳細ページは `width={image.width} height={image.height}` で DB 値を渡しており、レガシー画像との互換性のためそのまま残している。`unoptimized` 化と固定サイズ化を一緒に行うかどうかは別途設計判断が必要

**後続 issue 案**: 「詳細ページの `<Image>` も `unoptimized` 化して `_next/image` 経由を 0 にする」を別 issue として立てる候補。優先度は低 (LCP 経路ではないため)。

### E2E テスト `tests/e2e/image-list.test.ts:26-39` について

「先頭カードの img に fetchpriority=high と loading=eager が付く」検証は、Next.js 15.5 では実は動かない。dev 環境で main ブランチでも `null` が出ることを確認した。implementation-validator も別 PR での修正を推奨している。

**後続 issue 案**: 「LCP priority の E2E 検証を `<link rel=preload>` ベースに書き換える、または `fetchPriority="high"` を明示的に渡すように `image-card.tsx` を修正する」。後者の方が LCP の意図 (high priority fetch) を実装と一致させられて良い。

### `docs/architecture.md` への追記検討

「キャッシュ戦略」セクション (L242-) は粒度が粗く、`unoptimized` 経路 vs `_next/image` 経路の使い分けは実装詳細レベル。追記は不要と判断する。issue #61 の改善前後の数値が確定したら、PRD/architecture.md の「パフォーマンス要件」(L141-) に LCP 数値の達成を反映するかどうかを再評価する。

### 次回への改善提案

- `priority` の Next.js 仕様を最初に把握しておけば、design.md で `fetchPriority="high"` の明示渡しを最初から検討できた。今後 LCP 系の改善では、`priority` だけでなく `fetchPriority` / `loading` を **明示的に** 設定する慣習にする
- worktree の `npm install` ハマりポイント (lefthook + biome 除外) はプロジェクト共通の運用知。`docs/development-guidelines.md` の「開発環境セットアップ」に worktree 利用時の注意を追記すると将来の自分が助かる
- dev 環境のシード DB に画像が 6 枚しかなく、本番想定 (12 枚) と差がある。E2E が CI でグリッド非表示 → skip しているのもこれが理由。E2E 用のシード固定化は #54 PPR とも関係するため、別途検討

