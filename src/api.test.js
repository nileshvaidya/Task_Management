import { describe, it, expect } from 'vitest';
import { createSupabaseClient } from './api.js';

describe('createSupabaseClient', () => {
  it('throws a readable error when env vars are missing', () => {
    expect(() => createSupabaseClient({})).toThrowError(/SUPABASE_URL/);
  });

  it('throws a readable error when only one env var is present', () => {
    expect(() => createSupabaseClient({ VITE_SUPABASE_URL: 'https://x.supabase.co' })).toThrowError(
      /SUPABASE_ANON_KEY/
    );
  });

  it('initializes a client when both env vars are present', () => {
    const client = createSupabaseClient({
      VITE_SUPABASE_URL: 'https://example.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key',
    });
    expect(client).toBeTruthy();
    expect(client.auth).toBeDefined();
    expect(typeof client.from).toBe('function');
  });
});
