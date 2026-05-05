# 設計: LGTM画像フォント差し替え

## 影響範囲

| 区分 | パス | 変更内容 |
|------|------|----------|
| アセット | `public/fonts/Roboto-Black.ttf` | 削除 |
| アセット | `public/fonts/ArchivoBlack-Regular.ttf` | 追加 (OFL-1.1) |
| アセット | `public/fonts/OFL.txt` | 追加 (Archivo Black のライセンス全文) |
| 実装 | `src/lib/image/compose-lgtm.ts` | `FONT_PATH` / `FONT_FAMILY` 定数の差し替え |
| ドキュメント | `docs/functional-design.md` | サンプルコードの font-family 記述を実装に合わせる |

## 実装方針

### フォントファイルの取得

- 配布元: Google Fonts 公式リポジトリ (`https://github.com/google/fonts/raw/main/ofl/archivoblack/ArchivoBlack-Regular.ttf`)
- 検証: `file` コマンドで TrueType であることを確認、`sharp` の Pango から `fontfile` 指定で読めるかを単体テストで担保。
- ライセンス: 同じ ofl ディレクトリにある `OFL.txt` を併記する (再配布時の要件)。

### `src/lib/image/compose-lgtm.ts`

- 既存の定数のみを差し替え、関数構造は維持する:

```ts
const FONT_PATH = path.join(process.cwd(), 'public/fonts/ArchivoBlack-Regular.ttf');
const FONT_FAMILY = 'Archivo Black';
```

- Pango への font 文字列は `${FONT_FAMILY} ${fontSize}` の形式 (現状踏襲)。
- ロジック (黒文字多重コンポジット → 白文字オーバーレイ) は変更しない。

### `docs/functional-design.md`

- 現行: `font-family="Arial Black, sans-serif"` (SVG ベースの当初プラン記述)
- 変更後: `font-family="Archivo Black, sans-serif"` に統一し、実装と一致させる。

### テスト

- 既存テスト (`tests/unit/lib/image/compose-lgtm.test.ts`) はフォント独立 (寸法・WebP フォーマットのみ検証) で、改修後も無修正でパスするはず。
- 念のため、フォントファイルが解決できないケースでの誤検出を避けるため、追加のフォント存在テストを 1 件追加する:
  - `public/fonts/ArchivoBlack-Regular.ttf` が存在すること
  - `public/fonts/Roboto-Black.ttf` が存在しないこと (置換漏れ検知)

## 代替案と却下理由

| 候補 | 採否 | 理由 |
|------|------|------|
| Anton (Google Fonts) | × | 縦長コンデンスでブロック感が弱い。issue 画像の右側は等幅寄りで不一致 |
| Liberation Sans Bold | × | Bold ウェイトのみ。Arial Black ほど太さが出ない |
| 既存 Roboto Black の維持 | × | issue で明確に却下 |
| Web フォントを CDN 経由で取得 | × | サーバレス環境のコールドスタート遅延・外部依存を増やす |

## リスク・留意点

- Sharp/Pango が新しい TTF を読み込めるか: 既存 Roboto と同じ TTF 形式なので問題なし。万一読み込み失敗ならテストで検出される。
- 文字幅が変化することによる縁取り見栄え: 縁取り幅は `fontSize * 0.08` の動的計算なので、フォント差し替えだけでも破綻しない想定。
- `vercel build` のフォント同梱: `public/` 配下なので Next.js 標準で同梱される。追加設定不要。
