import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { proxy } from '@/proxy';

const getUser = vi.fn();
const createServerClient = vi.fn();

vi.mock('@supabase/ssr', () => ({
  createServerClient: (...args: unknown[]) => createServerClient(...args),
}));

beforeEach(() => {
  getUser.mockReset();
  getUser.mockResolvedValue({ data: { user: null }, error: null });
  createServerClient.mockReset();
  createServerClient.mockReturnValue({ auth: { getUser } });
});

function request(method: string, path: string) {
  return new NextRequest(`http://localhost${path}`, { method });
}

describe('proxy', () => {
  it.each(['/api/images', '/api/images/random'])(
    '公開 GET %s では session refresh を行わない',
    async (path) => {
      const res = await proxy(request('GET', path));

      expect(createServerClient).not.toHaveBeenCalled();
      expect(getUser).not.toHaveBeenCalled();
      expect(res.headers.get('set-cookie')).toBeNull();
    },
  );

  it.each([
    ['POST', '/api/images'],
    ['DELETE', '/api/images/img-1'],
    ['POST', '/api/images/img-1/regenerate'],
    ['GET', '/api/images/img-1'],
    ['GET', '/images/new'],
  ])('%s %s では session refresh を行う', async (method, path) => {
    await proxy(request(method, path));

    expect(getUser).toHaveBeenCalledTimes(1);
  });

  it('session refresh で更新された cookie をレスポンスに載せる', async () => {
    createServerClient.mockImplementation(
      (
        _url: string,
        _key: string,
        options: {
          cookies: {
            setAll: (cookies: { name: string; value: string; options: object }[]) => void;
          };
        },
      ) => ({
        auth: {
          getUser: async () => {
            options.cookies.setAll([{ name: 'sb-token', value: 'refreshed', options: {} }]);
            return { data: { user: null }, error: null };
          },
        },
      }),
    );

    const res = await proxy(request('POST', '/api/images'));

    expect(res.cookies.get('sb-token')?.value).toBe('refreshed');
  });
});
