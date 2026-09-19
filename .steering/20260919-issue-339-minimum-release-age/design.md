# 設計書

## アーキテクチャ概要

pnpm の install ゲートと Renovate の PR 作成ゲートを同じ 24h に揃える。除外リストは常設せず、24h を待てない緊急 CVE のみ pnpm 側で一時 override する。

```
npm 公開
  │
  │  24h 経過
  ▼
Renovate (minimumReleaseAge: 24 hours, internalChecksFilter: strict)
  │  npm データソースのみ。GitHub Actions 等は対象外
  ▼
依存 PR（lockfile 含む）
  │
  ▼
CI: pnpm install --frozen-lockfile
  │  pnpm-workspace.yaml の minimumReleaseAge: 1440
  ▼
成功
```

## コンポーネント設計

### 1. pnpm `minimumReleaseAge`

**責務**:
- CI / ローカル / Vercel の `pnpm install` で、公開から 1440 分未満の版を拒否する

**実装の要点**:
- `pnpm-workspace.yaml` に `minimumReleaseAge: 1440` を明示する
- pnpm 12 のデフォルトと同じ値なので挙動は変わらないが、デフォルト変更に依存しない
- `.npmrc` には置かない。pnpm 12 は auth / registry 以外を workspace yaml から読む

### 2. Renovate `minimumReleaseAge`

**責務**:
- 公開から 24h 未満の npm パッケージを PR に載せない

**実装の要点**:
- トップレベルに `internalChecksFilter: "strict"` を明示する（現行デフォルトと同じ。意図を設定ファイルに残す）
- `packageRules` の先頭付近に次を置く。末尾の集約ルールより前で、`groupName` を上書きしない

```json
{
  "matchDatasources": ["npm"],
  "minimumReleaseAge": "24 hours"
}
```

- GitHub Actions / docker / devcontainer には掛けない。pnpm ゲートと揃える対象は npm だけ
- `prCreation: "not-pending"` は入れない。CI は `pull_request` のみなので、PR 未作成ブランチにチェックが付かず無限延期になる
- `minimumReleaseAgeBuffer` はデフォルト 30 分のまま。関連パッケージ後出しによる artifact 失敗を避ける
- `minimumReleaseAgeExclude` は常設しない（緊急 CVE の一時 override のみ例外）

### 3. ドキュメント

**責務**:
- 24h ゲートが意図であること、除外を常設しないこと、緊急時は pnpm 側の一時 override であることを残す

**実装の要点**:
- 正典は `docs/development-guidelines.md` の「依存関係管理 (Renovate)」
- `docs/repository-structure.md` の `pnpm-workspace.yaml` 説明を更新する
- `AGENTS.md` の日常コマンドに短文を足す
- `README.md` の pnpm 行に 24h ゲートを足し、表の `10.x` を実体の `12.x` に直す

## データフロー

### 公開直後のパッケージを Renovate が載せない
```
1. パッケージが npm に公開される
2. 月曜の schedule で Renovate が走る
3. 公開から 24h 未満なら internalChecksFilter: strict が当該版を pending として落とす
4. 24h 以上経過した版だけがグループ PR に入る
5. CI の frozen install は同じ 24h ゲートを通る
```

### 緊急 CVE
```
1. vulnerability alerts は schedule と Renovate の minimumReleaseAge をバイパスし、24h 未満でも即時に PR が立つ
2. pnpm の minimumReleaseAge: 1440 は残るため、24h 未満の修正版は lockfile 更新 (ERR_PNPM_NO_MATURE_MATCHING_VERSION) か CI の frozen install (ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION) で止まる
3. 通常は 24h 経過後に Renovate が PR を更新するのを待つ
4. 待てない場合は人間が pnpm-workspace.yaml の minimumReleaseAgeExclude に修正版を版指定で一時追加し、24h 経過後に削除する
```

## エラーハンドリング戦略

本変更にアプリの実行時エラー処理は無い。品質ゲートの失敗は次のとおり:

- 公開直後の版が lockfile に入った場合: `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION` で install が失敗する（意図どおり）
- `lockFileMaintenance` は Renovate の `minimumReleaseAge` の対象外だが、lockfile を作り直す pnpm 自身が 24h 以上経過した版だけを解決するため、週次 lockfile 更新もゲートを通る

## テスト戦略

### ユニットテスト
- アプリコードは変えない。新規テストは不要

### 設定の確認
- `pnpm --package=renovate dlx renovate-config-validator renovate.json`
- `pnpm install --frozen-lockfile`（現行 lockfile は十分古いので成功する想定）
- `pnpm run check` / `typecheck` / `test` の回帰確認

## 依存ライブラリ

追加なし。

## ディレクトリ構造

```
pnpm-workspace.yaml
renovate.json
docs/development-guidelines.md
docs/repository-structure.md
AGENTS.md
README.md
.steering/20260919-issue-339-minimum-release-age/
```

## 実装の順序

1. `pnpm-workspace.yaml` に `minimumReleaseAge: 1440` を追加する
2. `renovate.json` に npm の 24h と `internalChecksFilter: "strict"` を入れる
3. ドキュメントを更新する
4. validator / install / check / typecheck / test を通す

## セキュリティ考慮事項

- 24h ゲートは公開直後の悪意ある版を取り込む窓を狭める。除外リストで空洞化しない
- Renovate の security update は `minimumReleaseAge` をバイパスするが、pnpm の 24h ゲートは残す。緊急時のみ `minimumReleaseAgeExclude` の版指定で一時 override

## パフォーマンス考慮事項

- 設定の読み取りのみ。install 時間への影響は無い

## 将来の拡張性

- npm の 72h unpublish 窓に合わせて 3 days へ延ばす場合は、pnpm と Renovate の両方を同時に変える
- 信頼できるパッケージだけの除外が必要になったら `minimumReleaseAgeExclude` を最小限で足す
