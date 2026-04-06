import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    const { data: settings, error } = await supabase
      .from('settings')
      .select('theme, accent_color, notifications_json, ai_json')
      .eq('id', 1)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    const s: any = settings || {};

    return Response.json({
      success: true,
      data: {
        theme: s.theme || 'dark',
        accentColor: s.accent_color || '#00f2fe',
        notifications: s.notifications_json || {},
        ai: s.ai_json || {},
        lastUpdated: new Date().toLocaleTimeString(),
      }
    });
  } catch (error: any) {
    console.error('Settings Live Error:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
