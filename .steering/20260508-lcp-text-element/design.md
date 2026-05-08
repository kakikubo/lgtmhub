# 設計: LCP テキスト化 (ヒーロー見出し)

## アプローチ概要

`app/(site)/page.tsx` の `<header>` を「大きい `<h1>` + 説明文」のヒーロー
レイアウトに置き換える。これにより Chrome の LCP 選出ロジックが、ファースト
ビュー内の **テキストブロック (h1 + tagline)** を最大要素として選び、
`next/image` の到着を待たずに LCP を確定する。

## 主要な変更箇所

### 1. `app/(site)/page.tsx`

ヘッダー部分のみ差し替える。`section` のレイアウトや `<ImageGrid>` 以下は変更しない。

#### Before

```tsx
<header className="space-y-2">
  <h1 className="text-2xl font-bold">LGTM 画像一覧</h1>
  {user ? null : (
    <p className="text-sm text-gray-600">
      画像の閲覧とマークダウンのコピーはログイン不要です。 画像を登録するには GitHub
      でログインしてください。
    </p>
  )}
</header>
```

#### After

```tsx
<header className="space-y-3 py-2">
  <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-tight">
    Make every LGTM count.
  </h1>
  <p className="text-base md:text-lg text-gray-700 max-w-2xl leading-relaxed">
    GitHub Pull Request のレビューコメントにそのままコピペできる LGTM 画像を、
    みんなでシェアする掲示板です。 画像の閲覧とマークダウンのコピーはログイン不要、
    画像を登録するには GitHub でログインしてください。
  </p>
</header>
```

#### ポイント

- **h1 を `text-4xl md:text-6xl` に拡大**: モバイル 36px / デスクトップ 60px。
  単行で `tracking-tight leading-tight` を当て、見出し bbox 面積を最大化する
- **見出し文言を変更**: 「LGTM 画像一覧」(機能名) → `Make every LGTM count.`
  (英語キャッチコピー)。PRD の「コードレビュー文化をより楽しいものにする」を
  「ありきたりな LGTM で済ませず一回一回を意味のあるものに」というメッセージで
  表現し、エンジニア向けサービスの空気感を出す
- **説明文を常時表示 (ログイン分岐を撤去)**: 未ログイン誘導はログインボタンに
  集約済みのため、説明文は state によらず固定。これにより SSR で文字数が
  決定し、ファーストビューの bbox が確定する → CLS リスクなし
- **`max-w-2xl`** で説明文を 2〜3 行にラップさせ、行ボックスを縦に積み上げて
  テキストブロック全体の bbox 面積を稼ぐ

### 2. `tests/e2e/image-list.test.ts`

`getByRole('heading', { name: 'LGTM 画像一覧' })` を `'Make every LGTM count.'` に
更新する。`fetchpriority=high` のアサーションは現状維持 (画像 priority 仕様は
不変のため、テスト不変条件として保持する)。

## なぜテキストが LCP になるのか

Chrome の LCP 選出ロジックは「ビューポート内の最大の contentful 要素」を選ぶ。

LCP は「単一要素」を選ぶため、h1 と p の **どちらか面積の大きい方** が LCP に
なる。両方が画像カード 1 枚目 (image-grid 先頭) より大きい必要がある。

### モバイル (360×640px 想定)

`grid-cols-2 gap-4` でカード幅 = (360-32-16)/2 = 156px、カード高 = 156×3/4 = 117px。

| 要素 | 概算 bbox |
|------|----------|
| ヒーロー h1 (text-4xl, ~36px, 2 行ラップ) | ~328 × 80 = 26,240 |
| ヒーロー段落 (text-base, ~16px × leading 1.625, 3-4 行) | ~328 × 100 = 32,800 |
| 1 枚目画像 (156px 幅, 4:3) | 156 × 117 = **18,252** |

→ h1, p のいずれもテキスト要素として画像より大きく、LCP 要素はテキストになる。

### デスクトップ (1280×800px 想定)

`max-w-6xl px-4` で section content = 1088px。`xl:grid-cols-4 gap-4` で
カード幅 = (1088-48)/4 = 260px、カード高 = 260×3/4 = 195px。

| 要素 | 概算 bbox |
|------|----------|
| ヒーロー h1 (text-6xl, ~60px, 単行 leading-tight, 英文 22 char) | ~660 × 75 = **49,500**[^1] |
| ヒーロー段落 (text-lg, ~18px × leading 1.625 = 29px, 3 行 ラップ) | 672 × 87 = **58,464** |
| 1 枚目画像 (260px 幅, 4:3) | 260 × 195 = **50,700** |

→ p (3 行ラップ) は画像を上回るため LCP 候補として安定。h1 単行 bbox は英文
22 文字で約 49.5k と画像 50.7k を僅差で下回る可能性があるが、p が確実に
LCP に選ばれるため目的 (テキスト LCP 化) は達成される。

[^1]: 英文の平均グリフ幅 ≒ font-size × 0.5 で概算。日本語 (CJK 全角) より
      bbox が縮むため、p の方が安定的に LCP 候補となる前提。

### 注意点

- レビュー指摘 (validator 4.6/5) を受けて `md:text-5xl` → `md:text-6xl` に拡大。
  `text-5xl` (48px) ではデスクトップで h1 単行 bbox が画像を僅差で下回るリスクがあり、
  画像 LCP に戻る可能性が残るため
- p の文章量は意図的に 3 行ラップを狙う長さに設定 (LGTM の役割 + ログイン仕様の 2 文)
- LCP は「単一要素」を選ぶため、h1 と p のうち面積の大きい方が LCP になる。
  本設計では p (段落) が LCP になる可能性が高いが、いずれもテキスト要素のため
  Load delay = 0 という目的は達成できる

## なぜ inline base64 / blur placeholder 案を採らないか

- inline base64: HTML サイズが ~5-30 KB 増え、TTFB 自体が悪化する。LCP
  Render delay は減るが、目標 (LCP ≤ 300ms) 達成にはオーバースペック
- blur placeholder: Next.js の `<Image placeholder="blur" blurDataURL="...">`
  で実現できるが、これは「LCP 要素が image である前提」での縮小策。テキスト
  LCP 化が目標なら不要

## アーキテクチャへの影響

- 既存パターン (Server Component + `<header>` セマンティクス) を踏襲
- データ取得 (`getHomeImagesInitial`) ・キャッシュ (`unstable_cache`) は不変
- `<ImageGrid>` 以下の `priority` 仕様も不変 (4 枚 preload を維持)
- フォントは Tailwind デフォルト (`font-sans`) のまま。Web フォント未使用の
  ため FOIT/FOUT 由来の CLS リスクなし

## テスト戦略

- **E2E**: 既存 `image-list.test.ts` の見出しアサーションを新文言に更新。
  ヒーロー文言の変更を回帰検出可能にする
- **ユニット**: 見出し変更のみで純粋なマークアップ差し替え。新規ユニット
  テストは追加しない (Server Component のスナップショットは過剰)
- **手動計測**: ローカル `npm run build && npm run start` で
  Chrome DevTools Performance を取得し、LCP 要素が h1/p のいずれかになる
  ことを確認する。Vercel production への反映は本 PR マージ後に実施

## 既知のリスク / 代替案

### リスク 1: 見出し文言変更によるブランディング揺れ

- 現状「LGTM 画像一覧」は機能名として `docs/glossary.md` でも参照される
- 本変更は **画面 UI の H1 のみ** を変更し、ドキュメント上の機能カテゴリ
  ラベル (state diagram の `画像一覧` ノード等) は触らない
- glossary.md / functional-design.md には影響なし (機能名としての「画像一覧」
  は維持される)

### リスク 2: 説明文を常時表示にしたことで未ログイン CTA が冗長になる

- 既存の「ログインして登録」ボタン (`form action={signInWithGithub}`) は維持
- 説明文中で「画像を登録するには GitHub でログイン」と触れているため、
  ボタンと文言が重複するが、誘導としては自然 (ヒーローパターンでは典型)

### 代替案: h1 の文言を「LGTM 画像一覧」のまま `text-5xl` に拡大するだけ

- メリット: 既存 E2E や glossary との整合性が完全に保たれる
- デメリット: 単独で「画像一覧」と書いてあるだけのページ上部はヒーローと
  しての説得力が弱く、PRD の「コードレビュー文化をより楽しく」に対するメッセージ
  として機能しない
- → 採用しない。文言変更を含む

## ロールバック方針

不具合発生時は本 PR を revert する。`<header>` 単独の変更のため、revert で
元の状態に戻る。データやスキーマへの影響はゼロ。
