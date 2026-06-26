# 要求: 登録ファイル形式に WebP を追加する

参照: [Issue #213](https://github.com/kakikubo/lgtmhub/issues/213)

## ゴール

LGTM 画像ソースとして WebP の URL を入力した際、JPEG / PNG / GIF と同等のフローで登録・表示できるようにする。静止 WebP / アニメ WebP のいずれも受理し、アニメ WebP はアニメ GIF と同じパスでアニメーション WebP として保存・表示する。

## 背景

- 現状の `ALLOWED_IMAGE_FORMATS` は `['jpeg', 'png', 'gif']` で WebP を明示拒否している。
- `safe-fetch.ts` の `DEFAULT_ALLOWED_CONTENT_TYPES` も `'image/webp'` を弾く。
- Issue #201 (PR #212) でアニメーション GIF → アニメーション WebP の合成パイプラインを整備済みで、`sharp({ animated: true })` 経由のフローは入力 WebP も追加実装なしで受けられる状態。

## 受け入れ基準

- 静止 WebP の URL を登録できる。
- アニメ WebP の URL を登録すると、アニメ WebP として保存され一覧・詳細で動いて見える。
- バリデーション拒否時のエラーメッセージで WebP も対応フォーマットとして案内される。
- `npm test` / `npm run lint` / `npm run typecheck` が green。

## スコープ外

- pHash の重複判定ロジック（元画像 1 フレーム目の pHash のままで十分）。
- 動く画像であることを示す UI バッジ（別 Issue）。
- ファイルアップロード機能（P2 / 未実装）の対応フォーマット更新。本 Issue は URL 登録 (P0) の対応フォーマットのみ拡張する。
- フレーム数上限定数名の変更（`MAX_GIF_FRAMES` のまま維持。PR レビュー時に判断する余地は残す）。
