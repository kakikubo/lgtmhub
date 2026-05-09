# タスクリスト

## 1. 実装

- [x] `src/lib/image/compose-lgtm.ts`: 定数 `TARGET_WIDTH/TARGET_HEIGHT` を `MAX_LONG_SIDE = 800` に置き換え、`composeLgtmImage()` のロジックを長辺 800 cap・元アスペクト比保持・原画 < 800 は拡大しない方式に書き換える
- [x] `app/(site)/images/[id]/page.tsx`: 画像コンテナの `max-w-[266px]` を `max-w-[800px]` に、`sizes="266px"` を `sizes="(min-width: 768px) 736px, 100vw"` に変更

## 2. テスト更新

- [x] `tests/unit/lib/image/compose-lgtm.test.ts`: 既存ケースを長辺 800 ベースに書き換える (横長/正方形/縦長で長辺 800、原画 < 800 は拡大されない、中央クロップ色サンプルテストは削除、`MAX_LONG_SIDE` の import に変更)
- [x] `tests/unit/services/image-service.test.ts`: `vi.mock` 内の `TARGET_WIDTH/TARGET_HEIGHT` を `MAX_LONG_SIDE` に置き換える

## 3. ドキュメント更新

- [x] `docs/product-requirements.md:91` の「266×199 中央クロップ」表記を長辺 800px リサイズに修正
- [x] `docs/functional-design.md` の関連箇所 (L272/L439/L512-522/L535-538/L739) を長辺 800px リサイズに修正
- [x] `docs/development-guidelines.md:528` の表記を長辺 800px に修正
- [x] `docs/glossary.md:255` の表記を長辺 800px に修正

## 4. 検証

- [x] `npm run lint` がエラーなく通る
- [x] `npm run typecheck` がエラーなく通る
- [x] `npm test` (Vitest) がエラーなく通る

## 5. 振り返り

- [x] 申し送り事項を tasklist.md 末尾に追記する (実装完了日、計画と実績の差分、学び、改善提案)

---

## 申し送り事項

### 実装完了日

2026-05-09

### 計画と実績の差分

- **scale 計算の方式変更**: 設計時点では `scale = 800 / longSide` を全 W/H に乗じて `Math.round` する案だったが、issue #75 の例 (736×1000 → 588×800) が `Math.floor(736 × 800 / 1000) = 588` と整合する挙動だったため、長辺は `MAX_LONG_SIDE` に固定し短辺だけ `Math.floor` で切り捨てる方式に変更した。`Math.round` を使うと 736 × 0.8 = 588.8 → 589 となり spec とズレるためこの差は重要。
- **テストケースを 1 件追加**: implementation-validator の推奨で「縦長 (短辺切り捨て) 600×1000 → 480×800」を追加し、縦長境界網羅を強化した。
- **functional-design.md コード断片を擬似コード化**: 旧コード断片は SVG `<text>` を使う古い書き方だったため、概要を示す擬似コードに置き換え、実装詳細は `src/lib/image/compose-lgtm.ts` を参照する旨明記した。
- **biome lint の挙動**: `biome.json` の `!**/.claude/worktrees` により worktree 内では `npm run lint` がパス無しエラーになる。worktree 内では変更ファイルを個別指定するか、main repo 側で実行する必要がある。

### 学び

- `sharp` の `fit: 'inside'` を使うと sharp が内部で W/H を決めるため、overlay 合成のために事前に W/H を確定させたい場合は使えない。明示的に W/H を計算してから `fit: 'fill'` を使うのが安全 (アスペクト比を自分で保証する前提)。
- LGTM 文字サイズが `canvasWidth * 0.15` で可変になるため、画像ごとに文字サイズが変わる。これは issue #52 で得られていた「全画像で文字サイズ統一」のメリットを失う代わりに、画像内バランスを優先するトレードオフ。
- pHash は元画像 buffer に対して計算されるため、合成サイズを変えても重複検知ロジックには影響しない (`src/services/image-service.ts:110`)。

### 改善提案

- 既存 266×199 画像の再合成は本 issue ではスコープ外だが、Blob URL の同一性を保証する設計 (例: 同一 blob key への上書き) があれば次回検討してもよい。
- `biome.json` の worktree 除外パターンが worktree 内実行時に空マッチを引き起こすため、`lint` スクリプトを worktree 対応にする (例: 引数なし時は対象パス明示) と運用がスムーズ。
