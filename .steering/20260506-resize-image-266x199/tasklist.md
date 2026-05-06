# タスクリスト

## 実装

- [x] `src/lib/image/compose-lgtm.ts` を 266×199 中央クロップに変更
  - `MAX_OUTPUT_WIDTH` を `TARGET_WIDTH` / `TARGET_HEIGHT` に置き換え
  - `composeLgtmImage()` を固定サイズ + `fit: 'cover', position: 'center'` に変更
- [x] `app/(site)/images/[id]/page.tsx` の詳細ページを実寸 266 表示に変更
  - コンテナに `mx-auto max-w-[266px]` を付与
  - `sizes` を `"266px"` に変更

## テスト

- [x] `tests/unit/lib/image/compose-lgtm.test.ts` を 266×199 ベースに書き換え
- [x] `tests/unit/services/image-service.test.ts` の `vi.mock` を `TARGET_WIDTH` / `TARGET_HEIGHT` に書き換え

## ドキュメント

- [x] `docs/product-requirements.md:91` を 266×199 中央クロップに書き換え
- [x] `docs/functional-design.md` の以下行を更新
  - L272 / L439: リサイズ表記
  - L514-522: サンプルコード
  - L740: composeLgtmImage の説明
- [x] ~~`docs/architecture.md` の表記確認 (必要なら更新)~~ (理由: Sharp の役割表記「リサイズ」は抽象概念として包含するため変更不要)

## 検証

- [x] `npm test` をパス (153 passed)
- [x] `npm run lint` をパス
- [x] `npm run typecheck` をパス
- [x] `implementation-validator` サブエージェントで品質検証 (4.8/5)

## 振り返り

### 実装完了日

2026-05-07

### 計画と実績の差分

- 当初計画では `docs/architecture.md` の表記確認のみ予定していたが、実装検証サブエージェントの指摘により `docs/glossary.md:255` (sharp 用途説明) と `docs/development-guidelines.md:528` (コミット例文) にも旧仕様「幅1200px以内」が残っていたため追加で更新した
- ユニットテストで中央クロップ動作の証明として、左右色違い画像のピクセル値で境界が出力に保存されることをチェックする検証を追加した (当初計画にはなかったが、issue 受け入れ条件「アスペクト比が崩れない」を強く担保するため)

### 学んだこと

- `sharp.resize(w, h, { fit: 'cover' })` はデフォルトで小画像を拡大する (`withoutEnlargement` を付けない限り)。「拡大しない」を期待した実装が必要な場合のみ明示する
- `composeLgtmImage()` は出力サイズが固定になったので、`buildLgtmOverlay()` の引数も定数になった。元の「アスペクト比に応じてオーバーレイを生成」というロジックの複雑さが解消されコード量が削減された
- `next/image` の `sizes="266px"` 指定により大きい variant のリクエストが抑制される (LGTM 表示には十分)

### 次回への改善提案

- ドキュメント内の固有数値 (1200 等) は今後変更時に grep で取りこぼしが発生しやすい。永続ドキュメントの書き換え時は事前に対象ディレクトリ全体を grep して影響範囲を洗い出してから着手するルーチンを徹底する
- 実装計画段階で `docs/glossary.md` も「数値が出てくるドキュメント」として常に確認対象に含めるべき
- 既存の 1200px 系画像を 266×199 にダウンサイズする再合成バッチ (issue スコープ外として明記) は次タスクとして必要 (ストレージ削減効果の本格化のため)
