import { describe, expect, it } from 'vitest';
import {
  THEME_STORAGE_KEY,
  isThemePreference,
  readThemePreference,
  resolveTheme,
  writeThemePreference,
} from './themePreference';

function storage(initial?: string): Storage {
  let value = initial ?? null;
  return {
    getItem: () => value,
    setItem: (_key, next) => { value = next; },
    removeItem: () => { value = null; },
    clear: () => { value = null; },
    key: () => null,
    length: 0,
  } as Storage;
}

describe('theme preference', () => {
  it('accepts only the supported preferences', () => {
    expect(isThemePreference('light')).toBe(true);
    expect(isThemePreference('dark')).toBe(true);
    expect(isThemePreference('system')).toBe(true);
    expect(isThemePreference('blue')).toBe(false);
  });

  it('defaults invalid or missing storage to system', () => {
    expect(readThemePreference(storage())).toBe('system');
    expect(readThemePreference(storage('invalid'))).toBe('system');
  });

  it('resolves system using the OS preference and preserves explicit choices', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });

  it('writes the versioned preference without storing any user data', () => {
    const target = storage();
    writeThemePreference('dark', target);
    expect(target.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });
});
