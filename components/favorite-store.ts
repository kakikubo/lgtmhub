'use client';

import { useSyncExternalStore } from 'react';
import { signInWithGithub } from '@/src/lib/auth/actions';
import { favoriteImageIdsResponseSchema } from '@/src/lib/validation/favorite';

const TOAST_DURATION_MS = 4000;
const ERROR_MESSAGE = 'お気に入りの更新に失敗しました。時間をおいて再度お試しください';

export interface FavoriteState {
  /** お気に入り済みの画像 ID。ID 取得の完了前は空 (= 全て輪郭ハート) */
  favoritedIds: ReadonlySet<string>;
  /** 通信中の画像 ID。二重送信の抑止に使う */
  pendingIds: ReadonlySet<string>;
  /** ログイン状態が判明したか。判明するまでボタンは操作不能にする */
  authResolved: boolean;
  signedIn: boolean;
  toast: string | null;
}

/**
 * お気に入り状態を保持するモジュールスコープのストア (Issue #198)。
 *
 * **なぜ Context Provider ではないのか**: Provider で `(site)` レイアウトを包むと、
 * Suspense 境界を含むサーバーコンポーネントの children がクライアント境界を跨ぐことになり、
 * ハイドレーション中に一覧やヘッダーの DOM が一瞬二重に存在する (実測で約 100ms)。
 * 画面のちらつきになるうえ、`getByTestId` が 2 要素に解決して既存の e2e が壊れる。
 * ストアをモジュールに置き `useSyncExternalStore` で購読すれば、ツリーに
 * ラッパーを一切挿さずに済むためこの問題が原理的に発生しない。
 *
 * サーバー上ではこのモジュールの状態は初期値のまま動かない (`ensureLoaded` は
 * ブラウザでしか走らない) ため、リクエスト間でユーザーのデータが漏れることはない。
 */
const INITIAL_STATE: FavoriteState = Object.freeze({
  favoritedIds: new Set<string>(),
  pendingIds: new Set<string>(),
  authResolved: false,
  signedIn: false,
  toast: null,
});

let state: FavoriteState = INITIAL_STATE;
const listeners = new Set<() => void>();
let loadStarted = false;
let toastTimerId: number | null = null;

function emit(): void {
  for (const listener of listeners) listener();
}

function setState(patch: Partial<FavoriteState>): void {
  state = { ...state, ...patch };
  emit();
}

function withId(source: ReadonlySet<string>, id: string, present: boolean): Set<string> {
  const next = new Set(source);
  if (present) {
    next.add(id);
  } else {
    next.delete(id);
  }
  return next;
}

/**
 * お気に入り済み画像 ID を 1 度だけ取得する。
 *
 * トップの一覧は 'use cache' で匿名キャッシュされ、「もっと読み込む」「ランダム表示」は
 * クライアント fetch でカードを増やすため、サーバー側でユーザー固有のハート状態を
 * 埋め込めない。そこで最初のハート描画時にここで 1 回だけ取得する。
 * 401 は「未ログイン」とみなし、以降の押下を GitHub ログインへの誘導に切り替える。
 */
function ensureLoaded(): void {
  if (loadStarted || typeof window === 'undefined') return;
  loadStarted = true;

  (async () => {
    try {
      const res = await fetch('/api/favorites/ids', { cache: 'no-store' });
      // 401 = 未ログイン。エラー表示はせず、ハートは輪郭のままにする
      if (!res.ok) return;
      const json = favoriteImageIdsResponseSchema.parse(await res.json());
      setState({ favoritedIds: new Set(json.lgtmImageIds), signedIn: true });
    } catch {
      // 取得失敗時もハートは輪郭のまま。押下時に改めて API がエラーを返す
    } finally {
      // 成否によらず必ず解除する。ここを通さないとボタンが永久に disabled のままになる
      setState({ authResolved: true });
    }
  })();
}

function showToast(message: string): void {
  // 短時間に 2 回失敗すると 2 本のタイマーが並走し、先に発火した 1 本目が
  // 2 本目のメッセージを規定時間より早く消してしまう。常に 1 本だけ張り直す。
  if (toastTimerId !== null) window.clearTimeout(toastTimerId);
  setState({ toast: message });
  toastTimerId = window.setTimeout(() => {
    toastTimerId = null;
    setState({ toast: null });
  }, TOAST_DURATION_MS);
}

/**
 * お気に入りを登録 / 解除する。オプティミスティック更新し、失敗したら元に戻す。
 * 未ログインなら GitHub OAuth へ誘導する。
 */
export function toggleFavorite(lgtmImageId: string): void {
  // ログイン状態が未確定のうちは何もしない (ボタンも disabled)。
  // 確定前に「未ログイン」と決めつけると、ログイン済みユーザーを OAuth へ飛ばしてしまう。
  if (!state.authResolved) return;
  if (!state.signedIn) {
    // 未ログインでもハートは表示する要件。押下で GitHub OAuth へ送る
    // (components/header.tsx と同じ server action を再利用する)
    void signInWithGithub();
    return;
  }
  if (state.pendingIds.has(lgtmImageId)) return;

  const wasFavorited = state.favoritedIds.has(lgtmImageId);
  setState({
    favoritedIds: withId(state.favoritedIds, lgtmImageId, !wasFavorited),
    pendingIds: withId(state.pendingIds, lgtmImageId, true),
  });

  (async () => {
    try {
      const res = wasFavorited
        ? await fetch(`/api/favorites/${lgtmImageId}`, { method: 'DELETE' })
        : await fetch('/api/favorites', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ lgtmImageId }),
          });

      // 409 (登録済み) / 404 (解除済み) は「望む状態と一致」しているので成功として扱う。
      // お気に入り解除の冪等性は functional-design.md 参照。
      const acceptable = res.ok || (wasFavorited ? res.status === 404 : res.status === 409);
      if (acceptable) return;

      throw new Error(`status ${res.status}`);
    } catch {
      // ロールバック。楽観更新後に別操作が挟まっても、この画像 ID の状態だけを戻す
      setState({ favoritedIds: withId(state.favoritedIds, lgtmImageId, wasFavorited) });
      showToast(ERROR_MESSAGE);
    } finally {
      setState({ pendingIds: withId(state.pendingIds, lgtmImageId, false) });
    }
  })();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // 最初のハートが描画された時点で取得を開始する
  ensureLoaded();
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): FavoriteState {
  return state;
}

// SSR 時は常に初期値。サーバーではユーザー固有の状態を持たない
function getServerSnapshot(): FavoriteState {
  return INITIAL_STATE;
}

export function useFavoriteState(): FavoriteState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** テスト専用。モジュールスコープの状態を初期化する */
export function resetFavoriteStoreForTest(): void {
  if (toastTimerId !== null) {
    window.clearTimeout(toastTimerId);
    toastTimerId = null;
  }
  state = INITIAL_STATE;
  loadStarted = false;
  listeners.clear();
}
