# 要求内容

## 概要

CLAUDE.md / `docs/development-guidelines.md` が禁じている `as` キャストのうち、例外に該当しない 4 箇所を、型を握りつぶさない実装へ書き換える。

## 背景

規約は「`as` キャストと `any` は使わない。例外は `database.types.ts` 由来の絞り込みとテストのモック値のみ」と定めている。プロダクションコードに規約外の `as` が 4 箇所残っており、型安全の例外が散在している。

参照: GitHub Issue [#281](https://github.com/kakikubo/lgtmhub/issues/281)

## 実装対象の機能

### 1. Fisher-Yates シャッフルの tuple 代入を一時変数スワップにする
- `src/services/image-service.ts` の `[result[j] as T, result[i] as T]` を、一時変数を使ったスワップに書き換える
- `noUncheckedIndexedAccess` 下でも `as` なしでコンパイルできるようにする

### 2. 画像詳細ページの catch 戻り値から `as` を除く
- `app/(site)/images/[id]/page.tsx` の `return null as PublicLgtmImageDetail | null` を、戻り値の型注釈で `return null` にする

### 3. 画像フォーマット判定の `includes` から `as` を除く
- `src/lib/image/validate-image.ts` の `(ALLOWED_IMAGE_FORMATS as readonly string[]).includes(value)` を、`readonly string[]` 型の別定数経由にする

### 4. フォント読み込みの ArrayBuffer 変換から `as` を除く
- `src/lib/image/compose-lgtm.ts` の `ttf.buffer.slice(...) as ArrayBuffer` を、新しい `ArrayBuffer` へコピーする実装に置き換える
- フォントはモジュール内でキャッシュされるため、1 回のコピーコストは許容する

## 受け入れ条件

### 規約外の `as` を排除する
- [ ] 上記 4 箇所に `as` キャストが残っていない
- [ ] `src/` `app/` `components/` のプロダクションコードに、例外（`database.types.ts` 由来の絞り込み、`as const`、import エイリアス）以外の `as` が残っていない
- [ ] CLAUDE.md の例外リストへ ArrayBuffer を追記しなくて済む（コピー実装で回避できる）

### 既存の振る舞いを変えない
- [ ] シャッフル・画像詳細の 404 フォールバック・フォーマット判定・LGTM 合成の実行時挙動は変わらない
- [ ] `pnpm run typecheck` が通る
- [ ] `pnpm run test` が通る

## 成功指標

- プロダクションコードの規約外 `as` が 0 件になる
- 例外リストを増やさずに規約を満たせる

## スコープ外

以下はこのフェーズでは実装しません:

- テストコード内の `as`（ガイドライン上許容）
- `src/repositories/image-repository.ts` の `row.status as ImageStatus`（`database.types.ts` 由来の許容例外）
- `as const`（const assertion。型を狭める正規の構文）
- import エイリアス（`import { X as Y }`）
- `scripts/preview-lgtm-fonts.ts` の同様の ArrayBuffer キャスト（検証対象外のスクリプト。本番コードから helper を公開するほどではない）

## 参照ドキュメント

- `docs/development-guidelines.md` - `as` キャスト禁止と許容例外
- `docs/architecture.md` - 型方針
- GitHub Issue [#281](https://github.com/kakikubo/lgtmhub/issues/281)
