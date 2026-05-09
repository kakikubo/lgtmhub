# 要求: ImageCard の Link prefetch を抑制し、初期ロードの帯域圧迫を解消する

GitHub Issue: https://github.com/kakikubo/lgtmhub/issues/63

## 背景

- トップページ表示時、`components/image-card.tsx:16` の `<Link href="/images/<id>">` が viewport に入った瞬間、Next.js が **画像 1 枚あたり 1 本の RSC ペイロード** (`/images/<uuid>?_rsc=...`) を自動プリフェッチしている。
- 2026-05-08 trace では `?_rsc=` リクエストが 12 本並走しており、画像本体 (`_next/image`) と帯域・コネクションを取り合っている。
- LCP 後の Long Task および後続の Load More 操作の体感速度を悪化させる原因。
- カード数の増加に伴い影響が線形に拡大するため、`<LoadMoreButton>` 経由で増えたカードでも同じ抑制が効く必要がある。

## 要求事項

### 機能要求

1. `components/image-card.tsx` の `<Link>` から、ビューポート入りでの自動プリフェッチを無効化する
2. クリック時のみ詳細ページへの遷移が発生し、`?_rsc=` リクエストは初回ロードでは 0 本となる
3. `<ImageGrid>` 経由で初期表示されるカードと、`<LoadMoreButton>` 経由で追加されるカードの双方に同一の抑制が適用される (ImageCard 側で制御するため、追加カードも自動的に同じ挙動になる)
4. 既存の E2E テスト (`tests/e2e/image-detail.test.ts`) で「カードクリックで詳細ページに遷移できる」挙動が壊れないこと

### 非機能要求

| 指標 | 改善前 (2026-05-08 計測) | 目標 |
|---|---|---|
| 初回ロードの `?_rsc=` リクエスト数 | 12 本 (カード数と同数) | **0 本 (クリック時のみ)** |
| 初回ロードの総リクエスト数 | 30 本 | **18 本以下** |
| Total Bytes Transferred (初回) | 要計測 | 30% 削減 |
| LCP 後の Long Task 合計 (TBT) | 要計測 | 100ms 以上短縮 |
| 画像詳細ページへの遷移 LCP | 要計測 | 現状 +200ms 以内 (プリフェッチなしによる悪化を許容範囲に) |

### トレードオフ

- 詳細ページ遷移時の LCP は理論上悪化する。ホームの初期描画優先のトレードオフであることを PR description に明記する。

## スコープ外

- 自前 IntersectionObserver による hover/focus 時のみのプリフェッチ実装 (将来的な改善として保留。まずは最も保守的な `prefetch={false}` で計測する)
- 画像詳細ページ自体のパフォーマンス最適化 (別 Issue)
- Next.js の `prefetch="hover"` 相当の独自実装 (現バージョンでは API なし)

## 完了条件

- [ ] `components/image-card.tsx` の `<Link>` に `prefetch={false}` が設定されている
- [ ] E2E テストでカードリンクの `data-prefetch` 状態 (または DOM 上の挙動) が抑制されていることを検証する
- [ ] 既存の E2E テスト (`image-detail.test.ts`, `image-list.test.ts`) が pass する
- [ ] `npm run lint` / `npm run typecheck` / `npm test` が全て pass する
- [ ] ローカル `npm run build && npm run start` で起動し、Chrome DevTools で `?_rsc=` リクエストが 0 本であることを確認する
