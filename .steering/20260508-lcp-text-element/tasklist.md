# タスクリスト: LCP テキスト化 (ヒーロー見出し)

## 実装タスク

- [x] T1. `app/(site)/page.tsx` の `<header>` をヒーロー風に差し替える
      (h1 を `text-4xl md:text-5xl` に拡大、説明文を `max-w-2xl` で常時表示、
       ログイン分岐を撤去、文言を「LGTM 画像でレビューを楽しく」に変更)
- [x] T2. `tests/e2e/image-list.test.ts` の見出しアサーションを新文言
      `'LGTM 画像でレビューを楽しく'` に更新する

## 検証タスク

- [x] V1. `npm run lint` を実行し pass を確認 (`biome lint` で 58 ファイル検査・違反なし)
- [x] V2. `npm run typecheck` を実行し pass を確認 (`tsc --noEmit` 成功)
- [x] V3. `npm test` を実行し pass を確認 (153 件 pass)
- [x] V4. implementation-validator サブエージェントによる検証を実行
      (4.6/5。レビュー指摘を受け h1 を `md:text-5xl` → `md:text-6xl` に拡大し
       デスクトップでテキスト bbox が画像を上回るマージンを確保)
- [ ] V5. (任意) ローカル `npm run build && npm run start` で Chrome DevTools
      Performance を取得し、LCP 要素が h1/p のテキスト要素になることを確認
      (本 task は手動。CI/E2E では検証しない)

## 申し送り (振り返り)

### 実装完了日

2026-05-08

### 計画と実績の差分

- 計画通り: T1 (`app/(site)/page.tsx` のヒーロー化) / T2 (E2E 見出しアサーション
  更新) は設計通り完了
- 設計修正: implementation-validator のレビュー (4.6/5) を受け、デスクトップでの
  LCP マージンを確保するため h1 を `md:text-5xl` (48px) → `md:text-6xl` (60px) に
  拡大。bbox 計算の前提となるグリッド寸法 (`max-w-6xl px-4 + xl:grid-cols-4 gap-4`
  = カード幅 260px) が当初の概算 (300px) より小さく、画像の bbox が ~50,700 と
  低めであることに気付いた点も合わせて design.md を更新
- スコープ厳守: validator が提案した `<section aria-labelledby>` ランドマーク
  強化案は本 PR では取り込まず (LCP 達成と直交する A11y 改善のため、別 Issue で
  扱う方が「1PR=1関心事」の原則に沿う)

### 学んだこと

- **LCP は「単一要素」を比較する**: 当初の設計で「テキストブロック合算 71,000 >
  画像 67,500」と書いたが、実際は h1 と p を別々の LCP 候補として比較する。
  validator の指摘で軌道修正できた。次回テキスト LCP 化の設計では、必ず
  「単独 bbox の最大値」で比較すること
- **bbox 計算は `max-w-6xl + px-4 + grid gap` まで含めて Tailwind で再現する**:
  最大幅 1152px から左右パディング 32px を引いた 1088px が真の content width。
  `xl:grid-cols-4 gap-4` のカラム幅は (1088-48)/4 = 260px、画像高は 4:3 なので
  195px。画像 bbox = 50,700。最初は 1280×800 から 25vw で 300×225 = 67,500 と
  ざっくり算出していたため、必要な h1 サイズを過小評価していた
- **Tailwind の text-6xl は 3.75rem (60px) で line-height は default `1`**: 
  `leading-tight` (1.25) を併用すると行ボックス高 = 75px となり、見出し単行で
  ~750 × 75 = 56,250 の bbox が確保できる。`md:text-5xl` (48px × 1.25 = 60px) では
  ~700 × 60 = 42,000 で画像を下回るため、デスクトップでは text-5xl は不十分

### 後追い修正

- レビュー後、ヒーロー見出しを「LGTM 画像でレビューを楽しく」→
  `Make every LGTM count.` の英語キャッチコピーに変更。E2E と design.md の
  bbox 計算 (英文 22 char で h1 単行 ~49.5k) も合わせて更新。h1 単独では画像
  bbox を僅差で下回るが、p (3 行ラップで ~58k) が確実に LCP 候補となる前提

### 次回への改善提案

- Vercel preview デプロイ後に Chrome DevTools Performance で 3 回計測し、LCP
  要素・LCP 値・Load delay を `verification.md` として残す。前回の
  20260506-lcp-priority-image でも提案されていた取り組み
- `<section aria-labelledby="hero-heading">` + h1 の `id` 付与は別 Issue として
  追跡 (a11y 改善トラック)。同時に `<header>` のセマンティクス (page-level vs
  section-level) を development-guidelines に追記すると揺れを防げる
- LCP bbox の概算ロジックは間違えやすいため、`docs/architecture.md` の
  パフォーマンス目標セクションに「Tailwind の `max-w-*` / `grid-cols-* gap-*` を
  考慮した bbox 算出例」を追記する案あり (ただし過剰ドキュメント化のリスクも
  あるため、もう 1 度同じ落とし穴に遭遇したら追記する方針)
