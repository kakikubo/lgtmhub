#!/usr/bin/env bash
#
# supabase-migrate-to-tokyo.sh
#
# Supabase プロジェクトを Singapore (ap-southeast-1) から東京 (ap-northeast-1) へ
# 移設するためのデータ dump/restore ランブック (Issue #152)。
#
# Supabase 公式「Migrating within Supabase」の 3 分割方式を踏襲する:
#   roles.sql  : ロール定義 (--role-only)
#   schema.sql : public スキーマの DDL
#   data.sql   : 全データ (auth.users / auth.identities 含む。--data-only --use-copy)
#
# auth スキーマを含めて移すことで GitHub ログインユーザーの同一性を維持する。
# 画像は Vercel Blob 保管 (DB 外) のため本スクリプトの対象外。
#
# 前提:
#   - supabase CLI / psql が PATH にあること
#   - 接続文字列を環境変数で渡すこと (シークレットはコミットしない):
#       OLD_URL : 旧 (Singapore) の接続文字列 (Session pooler 推奨)
#       NEW_URL : 新 (Tokyo / qbkoalhilwtjydpscrye) の接続文字列
#
# 使い方:
#   export OLD_URL='postgresql://postgres.szjjdsagnitpmzbbtfoy:***@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres'
#   export NEW_URL='postgresql://postgres.qbkoalhilwtjydpscrye:***@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres'
#   ./scripts/supabase-migrate-to-tokyo.sh dump      # dump のみ
#   ./scripts/supabase-migrate-to-tokyo.sh restore   # restore のみ
#   ./scripts/supabase-migrate-to-tokyo.sh all       # dump → restore → 件数突合
#
# 注意: 停止ウィンドウ中の旧 DB への新規書き込みは失われうる。低トラフィック時に実施すること。

set -euo pipefail

DUMP_DIR="${DUMP_DIR:-tmp/supabase-migrate}"
COMMAND="${1:-all}"

# データ移設対象スキーマ。storage / realtime / vault 等の管理スキーマは
# restore 先ロールに書き込み権限が無く permission denied になるため含めない
# (本プロジェクトは Storage 未使用、画像は Vercel Blob 保管)。
# supabase_migrations は --data-only に含めず、Phase 3 の `migration repair` で同期する。
DATA_SCHEMAS="${DATA_SCHEMAS:-auth,public}"

require_env() {
  local missing=0
  for var in "$@"; do
    if [[ -z "${!var:-}" ]]; then
      echo "ERROR: 環境変数 ${var} が未設定です。" >&2
      missing=1
    fi
  done
  [[ "${missing}" -eq 0 ]] || exit 1
}

do_dump() {
  require_env OLD_URL
  mkdir -p "${DUMP_DIR}"
  echo "==> dump roles  -> ${DUMP_DIR}/roles.sql"
  supabase db dump --db-url "${OLD_URL}" -f "${DUMP_DIR}/roles.sql" --role-only
  echo "==> dump schema -> ${DUMP_DIR}/schema.sql"
  supabase db dump --db-url "${OLD_URL}" -f "${DUMP_DIR}/schema.sql"
  echo "==> dump data   -> ${DUMP_DIR}/data.sql (schemas: ${DATA_SCHEMAS})"
  supabase db dump --db-url "${OLD_URL}" -f "${DUMP_DIR}/data.sql" --data-only --use-copy --schema "${DATA_SCHEMAS}"
  echo "==> dump 完了"
}

do_restore() {
  require_env NEW_URL
  for f in roles.sql schema.sql data.sql; do
    if [[ ! -f "${DUMP_DIR}/${f}" ]]; then
      echo "ERROR: ${DUMP_DIR}/${f} が見つかりません。先に dump を実行してください。" >&2
      exit 1
    fi
  done
  echo "==> restore -> NEW_URL (single-transaction, session_replication_role=replica)"
  psql \
    --single-transaction \
    --variable ON_ERROR_STOP=1 \
    --file "${DUMP_DIR}/roles.sql" \
    --file "${DUMP_DIR}/schema.sql" \
    --command 'SET session_replication_role = replica' \
    --file "${DUMP_DIR}/data.sql" \
    --dbname "${NEW_URL}"
  echo "==> restore 完了"
}

do_verify() {
  require_env OLD_URL NEW_URL
  local sql="SELECT
      (SELECT count(*) FROM auth.users)              AS auth_users,
      (SELECT count(*) FROM public.user_profiles)    AS user_profiles,
      (SELECT count(*) FROM public.lgtm_images)      AS lgtm_images,
      (SELECT count(*) FROM public.daily_upload_counts) AS daily_upload_counts;"
  echo "==> 件数突合 (OLD)"
  psql --variable ON_ERROR_STOP=1 --dbname "${OLD_URL}" -c "${sql}"
  echo "==> 件数突合 (NEW)"
  psql --variable ON_ERROR_STOP=1 --dbname "${NEW_URL}" -c "${sql}"
  echo "==> 上記の件数が新旧で一致していることを確認してください"
}

case "${COMMAND}" in
  dump)    do_dump ;;
  restore) do_restore ;;
  verify)  do_verify ;;
  all)     do_dump; do_restore; do_verify ;;
  *)
    echo "Usage: $0 {dump|restore|verify|all}" >&2
    exit 1
    ;;
esac
