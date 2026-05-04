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
      lgtm_images: {
        Row: {
          id: string;
          uploader_id: string;
          original_url: string;
          image_url: string;
          p_hash: string;
          width: number;
          height: number;
          file_size_bytes: number;
          mime_type: string;
          status: 'processing' | 'active' | 'deleted';
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          uploader_id: string;
          original_url: string;
          image_url: string;
          p_hash: string;
          width: number;
          height: number;
          file_size_bytes: number;
          mime_type?: string;
          status?: 'processing' | 'active' | 'deleted';
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          uploader_id?: string;
          original_url?: string;
          image_url?: string;
          p_hash?: string;
          width?: number;
          height?: number;
          file_size_bytes?: number;
          mime_type?: string;
          status?: 'processing' | 'active' | 'deleted';
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'lgtm_images_uploader_id_fkey';
            columns: ['uploader_id'];
            isOneToOne: false;
            referencedRelation: 'user_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      daily_upload_counts: {
        Row: {
          user_id: string;
          date: string;
          count: number;
        };
        Insert: {
          user_id: string;
          date: string;
          count?: number;
        };
        Update: {
          user_id?: string;
          date?: string;
          count?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'daily_upload_counts_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'user_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      increment_daily_upload_count: {
        Args: { p_user_id: string; p_date: string; p_max?: number };
        Returns: number;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
