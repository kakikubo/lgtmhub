export interface UserProfile {
  id: string;
  githubLogin: string;
  displayName: string;
  avatarUrl: string;
  isAdmin: boolean;
  createdAt: Date;
  updatedAt: Date;
}
