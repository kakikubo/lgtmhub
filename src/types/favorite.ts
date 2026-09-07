// ユーザーごとのお気に入り登録 (Issue #198 / PRD 機能4)。
// 非公開・個人リストのため公開用の派生型 (PublicXxx) は持たない。
// お気に入り一覧 API は「createdAt にお気に入り登録日時を詰めた PublicLgtmImage」を返すため、
// 画像側の型 (src/types/image.ts) をそのまま再利用する。
export interface Favorite {
  id: string;
  userId: string;
  lgtmImageId: string;
  createdAt: Date;
}
