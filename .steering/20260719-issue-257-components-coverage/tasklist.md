# タスクリスト

Issue #257 — `components/` を unit テストし、カバレッジ計測対象に加える

## 背景と方針転換

当初 #257 は「e2e カバレッジを収集して `app/(site)` を計測」だったが、調査で技術的に大半不可能と判明:

- `app/(site)/page.tsx` は `cacheComponents` の下で静的シェルとして `next build` 時にレンダリングされ、e2e 実行時（`next start`）には実行されない → e2e カバレッジで捕捉不能
- SWC 構成のため istanbul 計装不可、V8/CDP も静的シェルに届かない
- 実ロジックは `app/(site)` ではなく `components/` にある

→ ユーザー承認のもと「`components/` を unit テストして計測に加える」に再定義。

## フェーズ1: テスト基盤

- [x] devDeps 追加（`@testing-library/react` / `user-event` / `jest-dom` / `happy-dom`）
  - jsdom 29 は undici 8 非互換（`wrap-handler.js` 欠落）で起動不可 → happy-dom に切替
- [x] `vitest.config.ts` を `test.projects` で node / happy-dom に分離
- [x] `tests/setup/component-setup.ts`（jest-dom + RTL cleanup）
- [x] `copy-markdown-button` で基盤疎通確認（clipboard は `vi.spyOn(navigator.clipboard)` + `fireEvent`。userEvent は独自 clipboard スタブを注入するため不採用）

## フェーズ2: コンポーネントテスト（10 個）

- [x] client: copy-markdown-button / load-more-button / home-images / image-register-form / image-detail-actions / image-regenerate-action
- [x] server: home-content / header / image-card / uploader-profile-row
- [x] `ui/alert-dialog`（Base UI）はパススルーにモック（portal/pointer 依存で happy-dom では不安定、かつ計測対象外）

## フェーズ3: 計測対象への追加

- [x] `coverage.include` に `components/**/*.{ts,tsx}` 追加
- [x] `coverage.exclude` に `components/ui/**` と `components/**/*-skeleton.tsx` 追加
- [x] 閾値は未設定（CI 実測を貯めてから別 Issue で判断）

## フェーズ4: 検証

- [x] `test:coverage` exit 0（32 files / 306 tests pass）
- [x] `biome check` exit 0 / `tsc --noEmit` exit 0

## フェーズ5: ドキュメント / PR

- [x] `docs/development-guidelines.md` に components 計測・projects 分離・app/(site) 除外理由を追記
- [ ] コミット・push・PR 作成（`Closes #257`）
- [ ] CI グリーン + Codecov 実測確認

## 計測結果（ローカル）

| | Stmts | Branch | Funcs | Lines |
|---|---|---|---|---|
| 全体（変更前） | 91.61 | 86.58 | 61.11(app/api集計) | — |
| 全体（変更後） | 93.68 | 90.02 | 84.31 | 95.03 |
| `components` ディレクトリ | 93.01 | 88.23 | 85.29 | 96.51 |

テスト数: 277 → 306（+29、実質は #258/#259 込みのブランチ起点から +29 の component テスト）

## 実装後の振り返り

### 実装完了日

2026-07-19

### 計画と実績の差分

| 項目 | 計画 | 実績 |
|------|------|------|
| DOM 環境 | jsdom | jsdom 29 が undici 8 非互換で起動不可 → happy-dom に切替 |
| clipboard 検証 | userEvent | userEvent が独自 clipboard スタブを注入し横取り → `vi.spyOn` + `fireEvent` に変更 |
| ダイアログ | 実 UI を操作 | Base UI の portal/pointer が happy-dom で不安定 → vendored な ui をパススルーモックし自コンポーネントのロジックを検証 |

### 学んだこと

1. **最新版が常に正解ではない**: jsdom 29 は undici 8 と非互換だった。バージョン泥沼を避け、用途に合う happy-dom へ即切替したのが正解だった
2. **テストライブラリの「親切機能」が邪魔になることがある**: userEvent の clipboard 自動スタブが、まさに検証したい clipboard 呼び出しを横取りしていた。1 pass 3 fail の非対称な失敗が手がかりになった
3. **vendored UI はモックして自コードのロジックに集中する**: Base UI ダイアログの実挙動は計測対象外。パススルーモックで content を常時描画し、自コンポーネントの fetch/router/エラー分岐に検証を絞った
4. **推測せず実物を参照する**: `HOME_IMAGES_CACHE_TAG` の値・`UserProfile` の必須フィールド・next/image の src 書き換えは、いずれも実装/型を確認してから書いた（#258 のタグ名推測失敗の教訓）

### 次回への改善提案

1. **`components/**` の閾値化**: CI 実測が数 run 貯まったら #259 と同様に閾値を検討
2. **`image-regenerate-action` の onOpenChange リセット（73-77）**: パススルーモックでは発火しないため未カバー。ダイアログ開閉グルーで低優先だが、モックを onOpenChange 対応にすれば埋められる
