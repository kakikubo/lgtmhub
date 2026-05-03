export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super(`${resource} が見つかりません: ${id}`, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class DuplicateImageError extends AppError {
  constructor(public readonly existingImageId: string) {
    super('同じ画像がすでに登録されています', 'DUPLICATE_IMAGE');
    this.name = 'DuplicateImageError';
  }
}

export class DailyLimitExceededError extends AppError {
  constructor() {
    super('本日の登録上限(10枚)に達しました', 'DAILY_LIMIT_EXCEEDED');
    this.name = 'DailyLimitExceededError';
  }
}

export class BadRequestError extends AppError {
  constructor(message: string) {
    super(message, 'BAD_REQUEST');
    this.name = 'BadRequestError';
  }
}

export class DatabaseError extends AppError {
  constructor(message: string) {
    super(message, 'DATABASE_ERROR');
    this.name = 'DatabaseError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = '認証が必要です') {
    super(message, 'UNAUTHORIZED');
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'この操作を実行する権限がありません') {
    super(message, 'FORBIDDEN');
    this.name = 'ForbiddenError';
  }
}
