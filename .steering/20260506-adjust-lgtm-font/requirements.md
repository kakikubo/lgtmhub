# 要求仕様: LGTM画像のフォント調整

## 背景

GitHub Issue #23 で、LGTM画像に合成しているテキストのフォントを差し替えてほしいという要求が出ている。

- 当初設計 (`docs/functional-design.md`) では `Arial Black, sans-serif` (font-weight 900) を指定していた。
- 現在の実装 (`src/lib/image/compose-lgtm.ts`) は `public/fonts/Roboto-Black.ttf` (Roboto Black) を使用している。
- issue 添付画像で「左 (現状: Roboto Black)」と「右 (目標: Arial Black 系の太い角ばったサンセリフ)」の比較が示されており、可能な限り右側に寄せたい。

## ゴール

- LGTM 合成テキストのフォントを、**Arial Black 系のブロック体** に差し替える。
- Vercel サーバレス環境 (`process.cwd()` 配下から `fontfile` を読み込む構成) を維持する。
- ライセンスはリポジトリ同梱可能なものに限定する (Roboto は Apache-2.0、後継候補も同等の OSS)。

## 非ゴール

- フォントサイズ / 縁取り幅 / 配置ロジックの調整は対象外 (今回のスコープではない)。
- LGTM 文字以外の UI フォント (画面上の見出し等) の変更は対象外。
- Web 表示用の `@font-face` 配信や Tailwind フォント設定の追加は対象外 (画像合成用のサーバサイド読み込みのみ)。

## 採用フォント

- **Archivo Black** (Google Fonts / OFL-1.1)
  - Arial Black 互換を意識して設計された無料の単一ウェイト (Black) サンセリフ。
  - リポジトリ既存の `Roboto-Black.ttf` 同様、TTF を `public/fonts/` に同梱して `sharp` の Pango 経由で読み込む。
  - OFL ライセンス全文 (`OFL.txt`) も同フォルダに配置して再配布要件を満たす。

## 受け入れ条件

1. `composeLgtmImage()` が生成する WebP のテキストが Archivo Black 由来の字形になる。
2. 既存のユニットテスト (`tests/unit/lib/image/compose-lgtm.test.ts`) が引き続きパスする。
3. `npm run lint` / `npm run typecheck` / `npm test` がいずれもエラーなく完了する。
4. `Roboto-Black.ttf` への参照がコード/ドキュメントに残っていない。
5. `docs/functional-design.md` の font-family 表記が現状の実装と整合する (`Archivo Black, sans-serif` または同等)。
