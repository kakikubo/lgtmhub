import { redirect } from 'next/navigation';
import { ImageRegisterForm } from '@/components/image-register-form';
import { createClient } from '@/src/lib/supabase/server';

export default async function NewImagePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/?auth_error=login_required');
  }

  return (
    <section className="mx-auto max-w-2xl px-4 py-8 space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">LGTM 画像を登録する</h1>
        <p className="text-sm text-gray-600">
          画像 URL を入力すると、自動で LGTM 文字を合成して登録します。
        </p>
      </header>

      <ImageRegisterForm />
    </section>
  );
}
