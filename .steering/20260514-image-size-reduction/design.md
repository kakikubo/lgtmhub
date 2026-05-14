# 設計: 画像保存サイズを長辺400pxに縮小

## 変更ファイル一覧

### 1. `src/lib/image/compose-lgtm.ts`
- `MAX_LONG_SIDE = 800` → `MAX_LONG_SIDE = 400`

### 2. `app/(site)/images/[id]/page.tsx`
- `max-w-[800px]` → `max-w-[400px]`
- `sizes="(min-width: 768px) 736px, 100vw"` → `sizes="(min-width: 768px) 400px, 100vw"`

### 3. `tests/unit/lib/image/compose-lgtm.test.ts`
テストの期待値更新:
- `1920×1080 → 800×450` → `1920×1080 → 400×225`
- it.each の期待値 (長辺800 → 長辺400):
  - `1920×1080`: expectedW=400, expectedH=225
  - `1200×900`: expectedW=400, expectedH=300
  - `1024×1024`: expectedW=400, expectedH=400
  - `736×1000`: expectedW=294 (floor(736/1000*400)), expectedH=400
  - `600×1000`: expectedW=240 (floor(600/1000*400)), expectedH=400
- 「原画が MAX_LONG_SIDE 未満」のテスト: 600×400 は新MAX=400 を超えるため変更
  → 300×200 (< 400) に変更
- 「長辺がちょうど MAX_LONG_SIDE」のテスト: 800×600 → 400×300 に変更

### 4. `tests/unit/services/image-service.test.ts`
- モックの `MAX_LONG_SIDE: 800` → `MAX_LONG_SIDE: 400`
