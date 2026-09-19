# 設計書

## アーキテクチャ概要

型を握りつぶす `as` を、既存の TypeScript 機能（一時変数、関数の戻り値注釈、別定数による widening、`ArrayBuffer` へのコピー）で置き換える。実行時の公開 API とデータフローは変えない。

```
before                          after
------                          -----
tuple 代入 + as T               一時変数 + undefined ガード
return null as T | null         catch コールバックに戻り値注釈
(tuple as string[]).includes    readonly string[] 定数へ widening
Buffer.slice() as ArrayBuffer   new ArrayBuffer + Uint8Array.set
```

## コンポーネント設計

### 1. `shuffle` (`src/services/image-service.ts`)

**責務**:
- ランダム一覧用の非破壊 Fisher-Yates シャッフル

**実装の要点**:
- `noUncheckedIndexedAccess: true` のため `result[i]` は `T | undefined`
- tuple 代入 `[result[i], result[j]] = [result[j] as T, result[i] as T]` をやめる
- 一時変数で取り出し、両方が `undefined` でないときだけスワップする
- `i` / `j` は `0..length-1` なので実行時に `undefined` にはならない。ガードは型のためだけ
- `T` が `undefined` を含む場合はスワップをスキップしうるが、現行の呼び出しは `string[]` のみ

### 2. `ImageDetailPage` (`app/(site)/images/[id]/page.tsx`)

**責務**:
- 画像詳細の取得失敗を `notFound()` に倒す

**実装の要点**:
- `.catch` コールバックに明示的な戻り値型 `PublicLgtmImageDetail | null` を付ける
- 本体は `return null` のみ。`as` は不要
- `Promise.all` の推論が壊れないこと（`imageResult` は引き続き `PublicLgtmImageDetail | null`）

### 3. `isAllowedFormat` (`src/lib/image/validate-image.ts`)

**責務**:
- sharp の `metadata.format` が許可フォーマットかを判定する型ガード

**実装の要点**:
- `ALLOWED_IMAGE_FORMATS` は `readonly ['jpeg','png','gif','webp']`（`as const`）
- `Array.prototype.includes` の searchElement がリテラルユニオンに狭まり、`string` を渡せない
- `const ALLOWED_IMAGE_FORMAT_VALUES: readonly string[] = ALLOWED_IMAGE_FORMATS` で widening し、`includes(value)` を呼ぶ
- 関数の戻り値注釈 `value is AllowedImageFormat` は維持する

### 4. `loadFont` (`src/lib/image/compose-lgtm.ts`)

**責務**:
- Archivo Black の TTF を opentype.js でパースする

**実装の要点**:
- `Buffer.buffer.slice()` の戻りは `ArrayBuffer | SharedArrayBuffer`（`ArrayBufferLike`）
- `opentype.js` の `parse` は `ArrayBuffer` を要求するため、従来は `as ArrayBuffer` で握りつぶしていた
- `new ArrayBuffer(buffer.byteLength)` は常に `ArrayBuffer`。`Uint8Array.set(buffer)` でコピーする
- フォントは `cachedFont` でプロセス内キャッシュされるため、コピーは初回のみ
- helper は `compose-lgtm.ts` 内のローカル関数に留め、公開 API にはしない

## データフロー

### フォント読み込み
```
1. readFileSync で TTF を Buffer として読む
2. 新しい ArrayBuffer を確保し、バイトをコピーする
3. parseFont(arrayBuffer) で Font を得る
4. cachedFont に保持し、以降は再利用する
```

## エラーハンドリング戦略

エラーの種類・伝播は変えない。画像詳細の catch → `null` → `notFound()`、フォーマット不正の `BadRequestError` はそのまま。

## テスト戦略

### ユニットテスト
- 既存の `tests/unit/services/image-service.test.ts`（`listRandomImages` のシャッフル順）
- 既存の `tests/unit/lib/image/validate-image.test.ts`（許可フォーマット / 拒否）
- 既存の `tests/unit/lib/image/compose-lgtm.test.ts`（フォント読み込みを含む合成）

新規テストは必須ではない。振る舞いを変えない置き換えのため、既存テストと `typecheck` で担保する。

### 残存 `as` の検査
- `src/` `app/` `components/` を対象に ` as ` を検索する
- 残ってよいもの: `as const`、`import { X as Y }`、`row.status as ImageStatus`（コメント付きの許容例外）

## 依存ライブラリ

新規追加なし。

## ディレクトリ構造

```
src/services/image-service.ts          # shuffle の書き換え
app/(site)/images/[id]/page.tsx        # catch の戻り値注釈
src/lib/image/validate-image.ts        # widening 定数
src/lib/image/compose-lgtm.ts          # ArrayBuffer コピー
.steering/20260919-issue-281-remove-as-casts/
```

## 実装の順序

1. `shuffle` を一時変数スワップにする
2. 画像詳細ページの catch を戻り値注釈にする
3. フォーマット判定に widening 定数を足す
4. フォント読み込みを ArrayBuffer コピーにする
5. `typecheck` / `test` / 残存 `as` の grep

## セキュリティ考慮事項

- ArrayBuffer コピーはフォントファイルの内容を変えない。SharedArrayBuffer を parse に渡さない副作用はあるが、`readFileSync` の Buffer は通常の `ArrayBuffer` なので実行時差はない

## パフォーマンス考慮事項

- フォントコピーは初回 1 回、ファイルサイズは数十 KB 規模。合成処理全体に対して無視できる
- シャッフルの undefined ガードは O(n) の定数倍で、一覧 16 件程度では問題にならない

## 将来の拡張性

- 同様の `Buffer` → `ArrayBuffer` 変換がスクリプト側（`scripts/preview-lgtm-fonts.ts`）にもある。必要になったら共有 helper に切り出せるが、今回は本番コードの規約違反解消が目的なので切り出さない
