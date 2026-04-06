import { createClient } from '@supabase/supabase-js';

// NEXT_PUBLIC_ variables are automatically available in the browser
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Single instance for the entire application (Frontend)
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  }
});

// Helper for when dynamic initialization is preferred
export function getSupabasePublic() {
  return supabase;
}
