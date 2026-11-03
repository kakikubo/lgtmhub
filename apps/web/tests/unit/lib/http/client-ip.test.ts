import { describe, expect, it } from 'vitest';
import { clientIp } from '@/src/lib/http/client-ip';

describe('clientIp', () => {
  it('x-real-ip を優先する', () => {
    const headers = new Headers({
      'x-real-ip': '203.0.113.10',
      'x-forwarded-for': '198.51.100.2, 10.0.0.1',
    });
    expect(clientIp(headers)).toBe('203.0.113.10');
  });

  it('x-real-ip が無ければ x-forwarded-for の先頭を使う', () => {
    const headers = new Headers({ 'x-forwarded-for': '198.51.100.2, 10.0.0.1' });
    expect(clientIp(headers)).toBe('198.51.100.2');
  });

  it('IPv6 を受け付ける', () => {
    const headers = new Headers({ 'x-real-ip': '2001:db8::1' });
    expect(clientIp(headers)).toBe('2001:db8::1');
  });

  it('空や不正な値は unknown に倒す', () => {
    expect(clientIp(new Headers())).toBe('unknown');
    expect(clientIp(new Headers({ 'x-real-ip': 'not an ip' }))).toBe('unknown');
    expect(clientIp(new Headers({ 'x-forwarded-for': '' }))).toBe('unknown');
  });
});
