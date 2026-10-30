import { describe, expect, it } from 'vitest';
import { safeRedirectPath } from '@/lib/redirect';

describe('safeRedirectPath', () => {
  it('keeps same-site paths', () => {
    expect(safeRedirectPath('/reset-password')).toBe('/reset-password');
    expect(safeRedirectPath('/words?id=1')).toBe('/words?id=1');
  });

  it('falls back to home for missing or off-site targets', () => {
    expect(safeRedirectPath(null)).toBe('/');
    expect(safeRedirectPath('')).toBe('/');
    expect(safeRedirectPath('https://evil.com')).toBe('/');
    expect(safeRedirectPath('//evil.com')).toBe('/');
    expect(safeRedirectPath('/\\evil.com')).toBe('/');
  });
});
