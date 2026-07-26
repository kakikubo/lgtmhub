# requirements.md — アニメーション GIF を登録対象に追加する

Issue: https://github.com/kakikubo/lgtmhub/issues/201

## 概要

現状はアニメーション GIF を明示的に拒否しており、かつ合成パイプラインが
全画像を静止 WebP に再エンコードするためフレームが失われる。
本 PR では、LGTM 文字を全フレームに焼き込んだ **アニメーション WebP** として
保存・表示できるようにする。

## ユーザーストーリー

- アニメ GIF (`https://...something.gif`) を入力すると、登録後の一覧／詳細／
  コピーしたマークダウン先で **動いた状態の LGTM 画像** として閲覧できる。
- 静止画 (jpeg / png / 静止 gif) の挙動はこれまでと変わらない。

## スコープ（1 PR = 1 関心事: コア改修）

1. **バリデーション**: `validate-image.ts` のアニメ GIF 拒否ブロックを撤廃し、
   フレーム数上限 (150 フレーム) を新設する。
2. **合成パイプライン**: `compose-lgtm.ts` を
   `sharp(..., { animated: true })` で全フレーム読み込み → 縦タイル合成 →
   アニメーション WebP 出力に書き換える。静止画入力の挙動は維持する。
3. **DB マイグレーション**: `lgtm_images` に
   `is_animated boolean NOT NULL DEFAULT false` を追加し、登録時に判定結果を
   保存する。`mime_type` は `image/webp` のまま。
4. **詳細画面表示**: `app/(site)/images/[id]/page.tsx` の `<Image>` に
   `unoptimized` を追加してアニメ喪失を防ぐ。
5. **タイムアウト**: `app/api/images/route.ts` に
   `export const maxDuration = 60` を追加する (同期処理を維持)。
6. **テスト**: validate-image / compose-lgtm のユニットテストを追加・更新する。
   e2e は静止画の現行カバレッジを壊さない範囲で挙動を維持する。

## スコープ外（別 Issue）

- 「動く画像 / GIF」UI バッジ表示 (`is_animated` を読むだけの UI 専任 PR)
- 非同期バックグラウンド処理化 (`status='processing'` を活用した堅牢化)
- pHash の動画的同等性判定 (現状は元画像の 1 フレーム目 pHash で十分)

## 受け入れ基準

- [ ] アニメ GIF を登録すると、アニメーション WebP として Blob に保存される。
- [ ] 一覧 (`/`)、詳細 (`/images/[id]`)、コピー先マークダウン (`![LGTM](url)`)
      の 3 経路すべてで動いて見える。
- [ ] 静止画 (jpeg / png / 静止 gif) の登録・表示が従来通り。
- [ ] 151 フレーム以上の GIF は明示エラーで拒否される
      (`フレーム数が多すぎます (150 フレーム以下にしてください)`)。
- [ ] `lgtm_images.is_animated` が登録時に正しく記録される。
- [ ] validate-image / compose-lgtm のユニットテストが追加・更新されている。
- [ ] `npm test` / `npm run lint` / `npm run typecheck` が green。

## 前提・要確認

- **Vercel プラン**: Hobby だと `maxDuration` 上限が 10 秒のため、フレーム上限
  150 と `maxDuration = 60` を再調整する必要がある。
  Issue 本文の「Pro 前提で進めるが、実プランを確認すること」に従い、Pro 想定で
  実装する。プラン不一致が判明した場合は本 PR レビュー時に再調整する。
- **`@vercel/blob` のコンテンツタイプ**: 静止画も含めて `image/webp` のため、
  本機能でも mime_type は `image/webp` のまま (アニメーション WebP も `image/webp`)。
