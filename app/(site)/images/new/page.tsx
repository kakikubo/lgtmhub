import { redirect } from 'next/navigation';
import { ImageRegisterTabs } from '@/components/image-register-tabs';
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
          URL を直接入力するか、キーワードから候補画像を探して登録できます。
        </p>
      </header>

      <ImageRegisterTabs />
    </section>
  );
}
