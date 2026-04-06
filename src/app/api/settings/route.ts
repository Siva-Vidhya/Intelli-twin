import { supabaseAdmin } from '@/lib/supabase-server';

/**
 * GET: Fetch the current user setting profile.
 */
export async function GET() {
  try {
    console.log('[API/Settings] Fetching preference profile...');
    
    // Fetch a singleton settings object (Since this is a student prototype)
    const { data: settings, error } = await supabaseAdmin
      .from('user_settings')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    // Use default values if no settings found
    const defaultSettings = {
      full_name: 'Alex Student',
      email: 'alex@student.edu',
      study_goal: 'Master Artificial Intelligence Fundamentals',
      daily_hours: 4,
      difficulty_level: 'Intermediate',
      theme: 'dark',
      notifications_enabled: true
    };

    return Response.json({ 
      success: true, 
      settings: settings || defaultSettings 
    });
  } catch (error: any) {
    console.error('[API/Settings] GET Error:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * POST: Upsert user preferences.
 */
export async function POST(req: Request) {
  try {
    const settings = await req.json();
    console.log('[API/Settings] Persisting preferences...');

    // Standardize field names for the database
    const payload = {
      user_name: settings.full_name,
      theme: settings.theme,
      preferences: {
        email: settings.email,
        study_goal: settings.study_goal,
        daily_hours: settings.daily_hours,
        difficulty_level: settings.difficulty_level,
        notifications_enabled: settings.notifications_enabled
      },
      updated_at: new Date().toISOString()
    };

    // Singleton upsert logic: Find the first row to update or create a new one
    const { data: existing } = await supabaseAdmin.from('user_settings').select('id').limit(1).maybeSingle();

    let query;
    if (existing?.id) {
      query = supabaseAdmin
        .from('user_settings')
        .update(payload)
        .eq('id', existing.id);
    } else {
      query = supabaseAdmin
        .from('user_settings')
        .insert([payload]);
    }

    const { error } = await query;
    if (error) throw error;

    return Response.json({ success: true, timestamp: payload.updated_at });
  } catch (error: any) {
    console.error('[API/Settings] POST Error:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
