# 設計書

## 方針

コード変更なし。CLAUDE.md 群と skill ディレクトリの追加・削除のみ。1PR = 1関心事の原則に従い 2 PR に分割する。

- PR 1 (feat/directory-claude-md): CLAUDE.md 配置 + docs のエイリアス記述修正
- PR 2 (chore/remove-doc-authoring-skills): doc 作成系 skill と setup-project の削除

両ブランチとも main から作成し、互いに独立。

## 配置設計 (承認済み)

- CLAUDE.md (ルート改訂): 全セッションに効くものだけ。検証コマンド (e2e の .env.local 読み込み含む)、@/* エイリアスの正、as/any ルール、レイヤー依存1行、スペック駆動フロー要約、docs へのポインタ
- app/api/CLAUDE.md: service ファクトリ経由・validation 配置・instanceof チェーン順序・revalidateTag・connection()
- src/CLAUDE.md: createClient/createAnonClient の使い分けと 'use cache' 制約、AppError throw と HTTP 変換の境界、db:types
- supabase/CLAUDE.md: db:types 再生成、Preview migration 運用 (ラベル・直列化・close 時の revert)

記述スタイル: 肯定形 + 理由、参照先つき。太字・表は使わない。

## あり/なし検証の結果 (採否の根拠)

- P1 route 実装: 差あり → app/api/CLAUDE.md 採用
- P2 repository 作成: 差なし (隣接コードで自己文書化) → repository DI / DTO 項目は不採用
- P3 RLS レビュー: 差なし (SQL コメントが意図を説明) → RLS 項目は不採用
- P4 component 作成: 差なし → components/CLAUDE.md 不採用
- P5 e2e 方針: .env.local の1行のみ差 → ルートの検証コマンド節へ、tests/CLAUDE.md 不採用
- 未検証で採用: 'use cache' → createAnonClient (ランタイムでしか発火しない)、Preview 運用 (コードから発見不能)

## skill 削除の根拠

- 対象 6 skill は「作法の定義」が本体で、内容は docs/*.md に実現済み (移行作業不要)
- 現セッションで skill として認識されていない (配置場所の問題でデッドウェイト)
- setup-project コマンドは削除対象 skill 群に依存し、初期セットアップは完了済み

## リスクと対処

- setup-project を将来使いたくなった場合: git 履歴から復元可能。PR 説明に明記する
- ルート CLAUDE.md 改訂でスペック駆動フローの情報が減る: steering skill と docs/ 参照で担保
