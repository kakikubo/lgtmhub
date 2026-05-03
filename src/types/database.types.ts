// 注: 本ファイルは将来 `npm run db:types` (= supabase gen types typescript --local) で
// 自動生成される。Docker / Supabase Local が起動できる環境ではコマンド実行で再生成し、
// 上書きすること。生成出力との完全互換は保たないが、アプリコードが参照する Row / Insert /
// Update の構造は維持する。

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string;
          github_login: string;
          display_name: string;
          avatar_url: string;
          is_admin: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          github_login: string;
          display_name: string;
          avatar_url: string;
          is_admin?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          github_login?: string;
          display_name?: string;
          avatar_url?: string;
          is_admin?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_profiles_id_fkey';
            columns: ['id'];
            isOneToOne: true;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
