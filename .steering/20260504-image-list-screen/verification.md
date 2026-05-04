# 動作確認手順: 画像一覧画面

PR #13 の動作確認手順をローカル環境向けにまとめたもの。Vercel preview と Supabase preview project の接続が整うまでは本書を参照する。

## 前提

- devcontainer 環境で `npm run db:start` (Supabase Local) が動くこと
- `.env.local` に Supabase Local 用の URL / Key が設定されていること

`.env.local` の Supabase 設定が空 / 旧値のままなら、`.env.example` を参考に最低限以下をセットする:

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<npm run db:start 時に標準出力に出る anon key>
```

---

## 手順 1: ローカル起動 (基本セットアップ)

```bash
git switch feature/image-list-screen

# Docker ランタイムが Colima の場合は npm run db:start ではなく以下を使う
# (理由は本文末尾「トラブルシューティング: Colima 環境」を参照)
npx supabase start -x vector,logflare

# Docker Desktop の場合は通常通り
# npm run db:start

npm run db:reset
npm run db:types

npm run dev
```

→ `http://localhost:3000/` を開く

---

## 手順 2: empty state を確認 (最短)

データなし状態で確認:

- 見出し「LGTM 画像一覧」
- 「まだ画像がありません。GitHub でログインすると、画像を登録できます。」(未ログイン時)
- 「ログインして登録」「GitHub でログイン」ボタン

これだけで「ページが 500 にならず描画される」「empty state が出る」が確認できる。

---

## 手順 3: 画像一覧 API の単体確認

```bash
# 正常系: 空配列と nextCursor=null が返る
curl -s 'http://localhost:3000/api/images?limit=5' | jq

# limit 範囲外
curl -s -o /dev/null -w "%{http_code}\n" 'http://localhost:3000/api/images?limit=999'   # → 400
curl -s -o /dev/null -w "%{http_code}\n" 'http://localhost:3000/api/images?limit=0'     # → 400

# cursor 形式不正
curl -s -o /dev/null -w "%{http_code}\n" 'http://localhost:3000/api/images?cursor=bad'  # → 400

# 空文字も問題なく無視される (zod の前段で undefined 化)
curl -s 'http://localhost:3000/api/images?cursor=&limit=' | jq
```

---

## 手順 4: フォールバック (LoadErrorState) を確認

A 案で追加した graceful degrade を発動させる:

```bash
# dev サーバを止める (Ctrl+C)
npm run db:stop

npm run dev
```

→ `http://localhost:3000/` をリロード

- 見出しは出る
- 本文に「現在画像を読み込めません。時間をおいて再度お試しください。」(背景が薄い橙の枠) が表示される
- 500 ページにならない

確認後 `npm run db:start` で戻す。

---

## 手順 5: 一覧グリッド + マークダウンコピーを確認

実画像が無いとグリッドが見えないので、以下のいずれかでデータを作る。

`5-A` (ローカル完結・推奨) と `5-B` (登録 API 経由・任意) を用意。

### 5-A. ローカル fixture を生成して DB にシードする (推奨・外部依存なし)

外部 URL を一切使わず、`public/test-fixtures/` に Sharp で生成した WebP を置き、DB の `image_url` には相対パス (`/test-fixtures/...`) を入れる。

`<Image src="/test-fixtures/...">` は同一オリジン扱いなので `next.config.ts` の `remotePatterns` 変更不要。

#### ① サンプル画像を生成

プロジェクトルートで:

```bash
mkdir -p public/test-fixtures
node -e "
const sharp = require('sharp');
const colors = ['#5b8def', '#e57373', '#81c784'];
const labels = ['a', 'b', 'c'];
Promise.all(colors.map((c, i) => {
  const svg = \`<svg width='800' height='600' xmlns='http://www.w3.org/2000/svg'><rect width='800' height='600' fill='\${c}'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='200' font-weight='900' fill='white' stroke='black' stroke-width='10' paint-order='stroke'>LGTM</text></svg>\`;
  return sharp(Buffer.from(svg)).webp({ quality: 85 }).toFile('public/test-fixtures/sample-' + labels[i] + '.webp');
})).then(() => console.log('generated'));
"
```

→ `public/test-fixtures/sample-{a,b,c}.webp` (各 7〜8KB) が生成される。

#### ② DB にシード

Supabase Studio (`http://127.0.0.1:54323`) の SQL Editor から、または Docker exec で psql に流し込む:

```bash
docker exec -i supabase_db_lgtmhub psql -U postgres -d postgres <<'SQL'
insert into auth.users (id, email)
values ('00000000-0000-0000-0000-000000000001', 'local-dev@example.com')
on conflict (id) do nothing;

insert into public.user_profiles (id, github_login, display_name, avatar_url)
values (
  '00000000-0000-0000-0000-000000000001',
  'localdev', 'Local Dev', 'https://avatars.githubusercontent.com/u/0'
) on conflict (id) do nothing;

insert into public.lgtm_images
  (uploader_id, original_url, image_url, p_hash, width, height, file_size_bytes)
values
  ('00000000-0000-0000-0000-000000000001', '/test-fixtures/sample-a.webp', '/test-fixtures/sample-a.webp', repeat('0', 1024), 800, 600, 7838),
  ('00000000-0000-0000-0000-000000000001', '/test-fixtures/sample-b.webp', '/test-fixtures/sample-b.webp', repeat('1', 1024), 800, 600, 7676),
  ('00000000-0000-0000-0000-000000000001', '/test-fixtures/sample-c.webp', '/test-fixtures/sample-c.webp', repeat('2', 1024), 800, 600, 7474);
SQL
```

> `avatar_url` は未ログイン時に表示されないので外部 URL のままで OK。完全 local にしたければ `/test-fixtures/avatar.webp` を生成して差し替える。

#### ③ ブラウザで確認

`http://localhost:3000/` をリロード。

確認できること:

- **青 / 赤 / 緑の LGTM 文字付きカードが 3 列グリッド** で表示される (実画像が見える)
- 各カードに「マークダウンをコピー」ボタン
- ボタンを押下 → 「コピーしました ✓」に変わり 2 秒で戻る
- テキストエディタに貼り付け → `![LGTM](/test-fixtures/sample-a.webp)` が貼れる
- HTTP レベルでも検証可能:
  ```bash
  curl -s 'http://localhost:3000/api/images?limit=10' | jq '.images | map({id, imageUrl})'
  curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/test-fixtures/sample-a.webp   # → 200
  ```

レスポンシブ確認: DevTools の device toolbar (Cmd+Shift+M) で幅を変えて 2 / 3 / 4 カラムが切り替わること。

#### ④ 「もっと読み込む」も確認したい場合

21 件以上必要。同じ fixture を流用して水増しする:

```bash
docker exec -i supabase_db_lgtmhub psql -U postgres -d postgres <<'SQL'
insert into public.lgtm_images
  (uploader_id, original_url, image_url, p_hash, width, height, file_size_bytes)
select
  '00000000-0000-0000-0000-000000000001',
  '/test-fixtures/sample-' || (array['a','b','c'])[1 + (i % 3)] || '.webp',
  '/test-fixtures/sample-' || (array['a','b','c'])[1 + (i % 3)] || '.webp',
  lpad(i::text, 1024, '0'),
  800, 600, 7838
from generate_series(1, 25) i;
SQL
```

→ ページ末尾に「もっと読み込む」ボタンが出る → 押下で次ページ取得 → 画像が下に追記される。Network タブで `GET /api/images?cursor=...` 200 を確認。

### 5-B. 本物の画像登録フロー (任意・Vercel Blob 必須)

ローカルで GitHub OAuth + 実画像登録まで試す場合:

1. `.env.local` に `BLOB_READ_WRITE_TOKEN=<Vercel Dashboard で生成>` を設定
2. `http://localhost:3000/` で「GitHub でログイン」 → OAuth で戻る
3. 登録 UI は今回の PR 範囲外なので curl で API 直叩き:

   ```bash
   # Cookie はブラウザの DevTools → Application → Cookies からコピー
   curl -X POST http://localhost:3000/api/images \
     -H 'Content-Type: application/json' \
     -H 'Cookie: <sb-...-auth-token=...>' \
     -d '{"imageUrl":"https://images.unsplash.com/photo-XXXX?w=800"}'
   ```

4. リロードすると LGTM 合成済み実画像が一覧に表示される (Vercel Blob 経由なので Next.js `<Image>` で正しく描画)

preview デプロイが整えば不要。

---

## 後始末

```bash
# シードデータ削除
docker exec -i supabase_db_lgtmhub psql -U postgres -d postgres <<'SQL'
delete from public.lgtm_images where image_url like '/test-fixtures/%';
delete from public.user_profiles where id = '00000000-0000-0000-0000-000000000001';
delete from auth.users where id = '00000000-0000-0000-0000-000000000001';
SQL

# fixture 画像削除 (commit に含めない)
rm -rf public/test-fixtures/

# Supabase Local 停止
npm run db:stop
```

---

## 推奨確認範囲

時間が取れない場合の最小セット (合計 5 分):

- 手順 1 → 2 (起動 + empty state)
- 手順 3 (API curl)
- 手順 4 (フォールバック)

これで PR Test plan の主要項目はカバーできる。マークダウンコピーのフィードバック表示 (Test plan 2 つ目) は手順 5-A で確認すること。

---

## PR Test plan との対応

| Test plan 項目 | カバーする手順 |
|----------------|---------------|
| `/` を開き、画像一覧 / empty state / 「もっと読み込む」が表示される | 手順 2 (empty), 5-A ③ (一覧), 5-A ④ (もっと読み込む) |
| 「マークダウンをコピー」押下 → クリップボードコピー + 「コピーしました ✓」を 2 秒間表示 | 手順 5-A ③ |

---

## トラブルシューティング: Colima 環境

`npm run db:start` (= `supabase start`) が以下のエラーで失敗する場合の対処。

### 症状

```
failed to start docker container "supabase_vector_<project>": Error response from daemon:
error while creating mount source path '/Users/<user>/.config/colima/default/docker.sock':
mkdir /Users/<user>/.config/colima/default/docker.sock: operation not supported
```

### 原因

Supabase の `vector` コンテナ (analytics 用ログ収集) は host の Docker socket を bind-mount するが、Colima の VM (virtiofs マウント) は host 側のソケットファイルを VM 内に再現できないため必ず失敗する。Docker Desktop では起きない、Colima 固有の既知問題。

### 対処 1: vector / logflare を除外して起動 (推奨)

```bash
npx supabase start -x vector,logflare
```

`vector` (analytics 用ログ収集) と `logflare` (analytics エンドポイント) はローカル開発の機能テストに不要。除外しても DB / Auth / Storage / Studio / API はすべて起動する。

`npm run db:start` の挙動を変えたい場合は `package.json` の scripts を書き換える案もあるが、CI や他環境に影響するため本書では推奨しない。Colima ユーザーは `npx supabase start -x vector,logflare` を直接叩くこと。

### 対処 2: docker context が古い socket path を指している場合

Colima が `~/.colima` から `~/.config/colima` に設定を自動移行していると、Docker context が古い path を指したままになる場合がある。`docker context inspect colima` でホスト path を確認:

```bash
docker context inspect colima | grep '"Host"'
```

実際の socket と一致しなければ更新:

```bash
# colima status で実 socket path を確認
colima status 2>&1 | grep "docker socket"
# 例: docker socket: unix:///Users/<user>/.config/colima/default/docker.sock

# context を一致させる
docker context update colima --docker host=unix:///Users/<user>/.config/colima/default/docker.sock

# 疎通確認
docker info --format 'OK: {{.Name}}'
```

### 対処 3: Colima daemon が二重稼働している場合

`pgrep -lf colima` で `~/.colima/...` 経路と `~/.config/colima/...` 経路の daemon が両方見つかる場合は、Colima を再起動して整理する:

```bash
colima stop
colima start
```

### 後始末

```bash
# 対処 1 で起動した場合、停止コマンドは通常通り
npm run db:stop   # = supabase stop
```
