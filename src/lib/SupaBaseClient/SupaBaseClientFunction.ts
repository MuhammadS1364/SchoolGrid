import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createMockSupabaseClient } from './mockSupabase';

const metaEnv = (import.meta as { env?: Record<string, string | undefined> }).env ?? {};
const supabaseUrl: string = metaEnv.VITE_SUPABASE_URL ?? '';
const supabaseAnonKey: string = metaEnv.VITE_SUPABASE_ANON_KEY ?? '';

let cachedClient: SupabaseClient | null = null;
let cachedMode: 'mock' | 'live' | null = null;

const SANDBOX_SESSION_KEY = 'schoolgrid_sandbox_mode';

function isSandboxRequested(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    if (params.get('sandbox') === '1') {
      window.sessionStorage.setItem(SANDBOX_SESSION_KEY, '1');
      return true;
    }
    if (params.get('sandbox') === '0') {
      window.sessionStorage.removeItem(SANDBOX_SESSION_KEY);
      return false;
    }
    return window.sessionStorage.getItem(SANDBOX_SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

export const isUsingMockSupabase = (): boolean =>
  !supabaseUrl.trim() || !supabaseAnonKey.trim() || isSandboxRequested();

export interface ParsedOAuthUrlParams {
  code: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  type: string | null;
  error: string | null;
}

/**
 * Extracts OAuth / recovery tokens and errors from both query strings (?code=...)
 * and hash fragments (#access_token=...&refresh_token=...).
 */
export function parseOAuthUrlParams(search: string, hash: string): ParsedOAuthUrlParams {
  const searchParams = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const cleanHash = hash.startsWith('#') ? hash.slice(1) : hash;
  const hashParams = new URLSearchParams(cleanHash);

  const error =
    searchParams.get('error_description') ||
    searchParams.get('error') ||
    hashParams.get('error_description') ||
    hashParams.get('error');

  return {
    code: searchParams.get('code'),
    accessToken: hashParams.get('access_token'),
    refreshToken: hashParams.get('refresh_token'),
    type: hashParams.get('type') || searchParams.get('type'),
    error: error ? error.replace(/\+/g, ' ') : null,
  };
}

export function formatSupabaseError(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) {
    return err.message;
  }
  if (err && typeof err === 'object') {
    const obj = err as { message?: unknown; details?: unknown; hint?: unknown };
    if (typeof obj.message === 'string' && obj.message.trim()) {
      const extra =
        typeof obj.hint === 'string' && obj.hint.trim() ? ` (${obj.hint.trim()})` : '';
      return `${obj.message.trim()}${extra}`;
    }
  }
  return fallback;
}

export async function checkGoogleProviderEnabled(): Promise<{
  enabled: boolean;
  checked: boolean;
}> {
  if (isUsingMockSupabase()) {
    return { enabled: true, checked: true };
  }
  try {
    const res = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/settings`, {
      headers: { apikey: supabaseAnonKey },
    });
    if (!res.ok) return { enabled: true, checked: false };
    const settings = (await res.json()) as { external?: { google?: boolean } };
    if (typeof settings?.external?.google === 'boolean') {
      return { enabled: settings.external.google, checked: true };
    }
    return { enabled: true, checked: false };
  } catch {
    return { enabled: true, checked: false };
  }
}

export const SupaBaseClientFunction = (): SupabaseClient => {
  const mode: 'mock' | 'live' = isUsingMockSupabase() ? 'mock' : 'live';
  if (!cachedClient || cachedMode !== mode) {
    cachedMode = mode;
    if (mode === 'mock') {
      cachedClient = createMockSupabaseClient() as unknown as SupabaseClient;
    } else {
      cachedClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          flowType: 'pkce',
          storageKey: 'schoolgrid-auth-session',
        },
      });
    }
  }

  return cachedClient;
};

export default SupaBaseClientFunction;