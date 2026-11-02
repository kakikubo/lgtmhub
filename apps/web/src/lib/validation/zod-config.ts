import { z } from 'zod';

// Zod v4 は z.object() の **生成時** に `Function('')` で JIT の可否を判定し、CSP に
// script-src eval 違反を報告させる (try/catch で握りつぶすので動作は壊れない)。
// 'unsafe-eval' を許可する代わりに JIT を無効化して判定自体をさせない (Issue #276)。
//
// 設定はスキーマ生成より前に評価されている必要がある。zod スキーマを定義するモジュールは
// 必ず先頭でこのモジュールを side-effect import すること:
//   import '@/src/lib/validation/zod-config';
// (import は巻き上げられるため、他モジュールの import より後ろに z.config を書いても
// そのモジュールが生成するスキーマには効かない。PR #368 の e2e 失敗の原因)
z.config({ jitless: true });
