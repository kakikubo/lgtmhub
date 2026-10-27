# タッチ端末で一覧カードの操作ボタンを常時表示する (#374)

## 結論

`OVERLAY_BUTTON_CLASS` に `@media (hover: none)` の `opacity-100` と `pointer-events-auto` を足す。Tailwind v4 は `group-hover` を `@media (hover: hover)` の中に出すため、タッチ端末ではホバー用の表示が当たらず `opacity-0` / `pointer-events-none` のままになる。任意バリアントはベースユーティリティより後に出力されるので、同じ詳細度でもタッチ端末では表示と操作が勝つ。

## 設計

追加するクラスは `[@media(hover:none)]:opacity-100` と `[@media(hover:none)]:pointer-events-auto`。`cn`（tailwind-merge）は任意メディアバリアントを `opacity-0` とは別グループとして残す。登録済みハートが後ろから足す無印の `opacity-100` も残る。デスクトップでは `(hover: none)` が一致しないので、ホバーと `group-has-[:focus-visible]` の出し分けは変わらない。

e2e は Pixel 5 の viewport に加え、CDP の `Emulation.setEmulatedMedia` で `hover: none` を立てる。Playwright のモバイルデバイスは `(hover: none)` を再現しない。未ログインのコピーボタンを押し、`data-copy-state=copied` かつ URL がトップのままであることを確認する。お気に入りは未ログインだと OAuth へ進むため、`opacity` と `pointer-events` の計算値だけを見る。

## 検討した代替案

| 案 | 却下理由 |
|---|---|
| 常時表示にする | デスクトップのホバーオーバーレイ（#169）を戻してしまう |
| `@media (hover: hover)` のときだけ隠す | 登録済みハートは無印の `opacity-100` で `opacity-0` をクラスから外す。メディア付きの `opacity-0` は残り、出力順次第でデスクトップでも消える |
| 画面幅 (`max-md`) で常時表示 | 狭いウィンドウのマウスと、広いタッチ端末を取り違える |

## Non-goals

- 未ログイン時のお気に入りボタンの遷移先
- デスクトップのホバー / キーボードフォーカスの出し分け
