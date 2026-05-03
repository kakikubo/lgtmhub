import { describe, it, expect } from 'vitest';
import {
  AppError,
  BadRequestError,
  DailyLimitExceededError,
  DatabaseError,
  DuplicateImageError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from '@/src/lib/errors';

describe('errors', () => {
  it('AppError は message と code を保持する', () => {
    const err = new AppError('test', 'TEST_CODE');
    expect(err.message).toBe('test');
    expect(err.code).toBe('TEST_CODE');
    expect(err.name).toBe('AppError');
    expect(err).toBeInstanceOf(Error);
  });

  it('NotFoundError は NOT_FOUND コードを返す', () => {
    const err = new NotFoundError('LgtmImage', 'abc-123');
    expect(err.code).toBe('NOT_FOUND');
    expect(err.message).toContain('LgtmImage');
    expect(err.message).toContain('abc-123');
    expect(err).toBeInstanceOf(AppError);
  });

  it('DuplicateImageError は existingImageId を保持する', () => {
    const err = new DuplicateImageError('image-456');
    expect(err.code).toBe('DUPLICATE_IMAGE');
    expect(err.existingImageId).toBe('image-456');
  });

  it('DailyLimitExceededError は DAILY_LIMIT_EXCEEDED コードを返す', () => {
    const err = new DailyLimitExceededError();
    expect(err.code).toBe('DAILY_LIMIT_EXCEEDED');
    expect(err.message).toContain('10枚');
  });

  it('BadRequestError は BAD_REQUEST コードを返す', () => {
    const err = new BadRequestError('入力値が不正');
    expect(err.code).toBe('BAD_REQUEST');
    expect(err.message).toBe('入力値が不正');
  });

  it('DatabaseError は DATABASE_ERROR コードを返す', () => {
    const err = new DatabaseError('connection failed');
    expect(err.code).toBe('DATABASE_ERROR');
    expect(err.message).toBe('connection failed');
  });

  it('UnauthorizedError は UNAUTHORIZED コードを返し、デフォルトメッセージは「認証が必要です」', () => {
    const err = new UnauthorizedError();
    expect(err.code).toBe('UNAUTHORIZED');
    expect(err.message).toBe('認証が必要です');
    expect(err.name).toBe('UnauthorizedError');
    expect(err).toBeInstanceOf(AppError);
  });

  it('UnauthorizedError は任意のメッセージを受け取れる', () => {
    const err = new UnauthorizedError('セッションが切れました');
    expect(err.message).toBe('セッションが切れました');
    expect(err.code).toBe('UNAUTHORIZED');
  });

  it('ForbiddenError は FORBIDDEN コードを返し、デフォルトメッセージを持つ', () => {
    const err = new ForbiddenError();
    expect(err.code).toBe('FORBIDDEN');
    expect(err.message).toBe('この操作を実行する権限がありません');
    expect(err.name).toBe('ForbiddenError');
    expect(err).toBeInstanceOf(AppError);
  });

  it('ForbiddenError は任意のメッセージを受け取れる', () => {
    const err = new ForbiddenError('管理者のみ実行できます');
    expect(err.message).toBe('管理者のみ実行できます');
    expect(err.code).toBe('FORBIDDEN');
  });
});
