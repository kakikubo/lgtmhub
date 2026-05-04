import { describe, expect, it } from 'vitest';
import {
  CREATE_IMAGE_FALLBACK_MESSAGE,
  mapCreateImageError,
} from '@/src/lib/validation/create-image-error';

describe('mapCreateImageError', () => {
  it('400: API の error 文言を併記する', () => {
    const result = mapCreateImageError(400, { error: '画像 URL の形式が正しくありません' });
    expect(result.message).toContain('入力値が正しくありません');
    expect(result.message).toContain('画像 URL の形式が正しくありません');
    expect(result.existingImageId).toBeUndefined();
  });

  it('400: body が不正でも汎用メッセージを返す', () => {
    const result = mapCreateImageError(400, null);
    expect(result.message).toBe('入力値が正しくありません');
  });

  it('401: セッション切れメッセージと needsRelogin=true を返す', () => {
    const result = mapCreateImageError(401, { error: '認証が必要です' });
    expect(result.message).toContain('セッションが切れました');
    expect(result.needsRelogin).toBe(true);
  });

  it('401 以外では needsRelogin が立たない', () => {
    expect(mapCreateImageError(400, null).needsRelogin).toBeUndefined();
    expect(mapCreateImageError(409, { error: 'x' }).needsRelogin).toBeUndefined();
    expect(mapCreateImageError(429, { error: 'x' }).needsRelogin).toBeUndefined();
    expect(mapCreateImageError(500, null).needsRelogin).toBeUndefined();
  });

  it('409: existingImageId をそのまま返す', () => {
    const result = mapCreateImageError(409, {
      error: '同じ画像がすでに登録されています',
      existingImageId: 'image-1',
    });
    expect(result.message).toContain('同じ画像がすでに登録されています');
    expect(result.existingImageId).toBe('image-1');
  });

  it('409: existingImageId が無くても message は決め打ちで返す', () => {
    const result = mapCreateImageError(409, { error: '同じ画像がすでに登録されています' });
    expect(result.message).toContain('同じ画像がすでに登録されています');
    expect(result.existingImageId).toBeUndefined();
  });

  it('429: 上限到達メッセージを返す', () => {
    const result = mapCreateImageError(429, { error: '本日の登録上限(10枚)に達しました' });
    expect(result.message).toContain('本日の登録上限');
    expect(result.message).toContain('明日');
  });

  it('500: 汎用フォールバックメッセージを返す', () => {
    const result = mapCreateImageError(500, { error: 'サーバーエラーが発生しました' });
    expect(result.message).toBe(CREATE_IMAGE_FALLBACK_MESSAGE);
  });

  it('想定外のステータスコードでも汎用メッセージを返す', () => {
    const result = mapCreateImageError(503, { error: 'temp' });
    expect(result.message).toBe(CREATE_IMAGE_FALLBACK_MESSAGE);
  });

  it('body が null でもクラッシュしない', () => {
    const result = mapCreateImageError(500, null);
    expect(result.message).toBe(CREATE_IMAGE_FALLBACK_MESSAGE);
  });

  it('body が想定外の形 (string) でもクラッシュせず汎用メッセージにフォールバック', () => {
    const result = mapCreateImageError(400, 'unexpected');
    expect(result.message).toBe('入力値が正しくありません');
  });

  it('body の existingImageId が空文字なら無視する (zod が弾く)', () => {
    const result = mapCreateImageError(409, {
      error: '同じ画像がすでに登録されています',
      existingImageId: '',
    });
    // existingImageId='' はスキーマの min(1) で弾かれるため、body 全体が parse 失敗扱い
    // → existingImageId は undefined のままだが、status=409 のメッセージは返る
    expect(result.existingImageId).toBeUndefined();
    expect(result.message).toContain('同じ画像がすでに登録されています');
  });
});
