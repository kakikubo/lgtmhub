import { createImageErrorResponseSchema } from '@/src/lib/validation/image';

export interface CreateImageErrorResult {
  message: string;
  existingImageId?: string;
  // 401 のときだけ true。フォームが「再度ログインへ戻る」リンクを出す判定に使う
  needsRelogin?: boolean;
}

const FALLBACK_MESSAGE = '画像の登録に失敗しました。時間をおいて再度お試しください';

/**
 * POST /api/images のエラーレスポンスを UI 表示用メッセージに変換する純関数。
 *
 * - status code を信頼の起点にし、body は「あれば追加情報として使う」程度に扱う
 * - body が想定外の形でも握りつぶしてフォールバックメッセージを返す
 * - `as` キャストは使わず、zod で safeParse する
 */
export function mapCreateImageError(status: number, body: unknown): CreateImageErrorResult {
  const parsed = createImageErrorResponseSchema.safeParse(body);
  const errorText = parsed.success ? parsed.data.error : null;
  const existingImageId = parsed.success ? parsed.data.existingImageId : undefined;

  switch (status) {
    case 400:
      return {
        message: errorText
          ? `入力値が正しくありません: ${errorText}`
          : '入力値が正しくありません',
      };
    case 401:
      return {
        message: 'セッションが切れました。再度ログインしてからお試しください',
        needsRelogin: true,
      };
    case 409:
      return {
        message: '同じ画像がすでに登録されています',
        existingImageId,
      };
    case 429:
      return {
        message: '本日の登録上限(10枚)に達しました。明日再度お試しください',
      };
    default:
      return { message: FALLBACK_MESSAGE };
  }
}

export const CREATE_IMAGE_FALLBACK_MESSAGE = FALLBACK_MESSAGE;
