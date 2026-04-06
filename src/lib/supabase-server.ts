import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Server-side Admin client using Service Role Key
// ONLY for use in API routes or Server Actions. Never in client components.

let _supabaseAdmin: SupabaseClient | null = null;

/**
 * High-Authority Server Client:
 * Initializes a Supabase client with the Service Role key to bypass RLS for administrative tasks.
 * Strict environment validation ensures a secure, reliable server-to-server connection.
 */
export const getSupabaseServer = (): SupabaseClient => {
  if (!_supabaseAdmin) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[Supabase Server] CRITICAL Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
      }
      // Throw descriptive error to prevent "Ghost Proxies" from running with undefined credentials
      throw new Error('Supabase Server Failure: Service Role credentials missing from environment.');
    }

    _supabaseAdmin = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }
  return _supabaseAdmin;
};

// Admin client for bypass-RLS operations
export const supabaseAdmin = getSupabaseServer();
