# requirements.md

## 関連 Issue

- 本タスク: [#152](https://github.com/kakikubo/lgtmhub/issues/152) Supabase プロジェクトを東京 (ap-northeast-1) へ移設するか検討
- 起点: [#150](https://github.com/kakikubo/lgtmhub/issues/150) Vercel 関数リージョン東京固定 / [#46](https://github.com/kakikubo/lgtmhub/issues/46) 体感速度改善
- 関連: `.steering/20260523-supabase-env-separation`(env 分離。preview/prod のプロジェクト分離は対象外と整理済み)

## 背景

Issue #150 で Vercel 関数を `hnd1`(東京)に固定したが、Supabase は `ap-southeast-1`(Singapore)のまま。関数 ↔ DB が東京 ↔ シンガポール(片道 ~70ms)をまたいでおり、Issue #46 案 #4 「東京で揃える」が未達。

新規に東京リージョン(`ap-northeast-1`)の Supabase プロジェクト **`qbkoalhilwtjydpscrye`** を作成済み。現行プロジェクト **`szjjdsagnitpmzbbtfoy`**(lgtmdb / Singapore)から auth ユーザーを含めて移設し、同一リージョン化する。

## 調査で判明した事実

- Supabase プロジェクトは **1つだけ**(`szjjdsagnitpmzbbtfoy`)。Vercel の **preview / production 両方が単一プロジェクトを共有**。→ 新東京プロジェクト 1 つへ 1:1 置換すれば両環境とも東京化。
- アプリコードに **ref のハードコードはゼロ**。接続はすべて env 経由(`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`)。
- **画像は Vercel Blob 保管**(`src/services/image-service.ts`)。`image_url` は Blob URL で DB 外 → **画像移設不要・URL 不変**。
- **Supabase Storage 未使用**(`config.toml` でバケット未定義) → Storage 移行不要。
- **Edge Functions / Webhooks / 独自拡張なし**。`gen_random_uuid` は組み込み。
- DB 規模は極小(テーブル 3つ + migrations 5本) → **ダウンタイムは数分**。
- `user_profiles.id` が `auth.users(id)` を FK 参照 → **auth スキーマ(users / identities)の移設が必須**。移設で既存 GitHub ログインの紐付けを維持。
- 旧 ref/名称のハードコードは **ドキュメントのみ**: `docs/development-guidelines.md` L892、`.github/workflows/supabase-deploy.yml` コメント、`README.md` L75。CI 本体は `SUPABASE_PROJECT_REF` secret 参照のため非依存。

## 要求

- 現行 Singapore プロジェクトのデータ(auth ユーザー / public 3 テーブル / RLS / 関数)を東京プロジェクトへ移設する。
- preview / production 両方を東京プロジェクトに向ける(単一プロジェクト共有のため 1:1 置換で達成)。
- 既存 GitHub ログインユーザーの同一性を維持する。

## 方針(ユーザー確認済み)

- スコープ: **preview / production 両方**
- ダウンタイム: **短時間停止を許容**(低トラフィック時間帯に実施)
- 移設方式: Supabase 公式「Migrating within Supabase」の `supabase db dump` 3 分割(roles / schema / data)

## スコープ

- **対象**: DB データ移設、新プロジェクトの Auth 構成、Vercel env / GitHub Secrets 切替、ドキュメント・メモリ更新、Issue クローズ
- **対象外**:
  - 画像 Blob の移設(Vercel Blob で DB 外)
  - Supabase Storage 移行(未使用)
  - preview/prod のプロジェクト分離(`.steering/20260523-supabase-env-separation` で別途整理)
  - 無停止(ゼロダウンタイム)移行
