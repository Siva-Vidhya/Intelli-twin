import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const { profile, notifications, ai, appearance } = await request.json();
    const { difficultyLevel, focusSubjects, ...aiRest } = ai || {};
    const { theme, accentColor, ...appearanceRest } = appearance || {};

    const { error } = await supabase
      .from('settings')
      .upsert({
        id: 1,
        name: profile?.name,
        email: profile?.email,
        study_goal: profile?.studyGoal,
        daily_hours: profile?.dailyHours,
        learning_pace: profile?.learningPace,
        difficulty_level: difficultyLevel,
        focus_subjects: focusSubjects || [],
        theme,
        accent_color: accentColor,
        notifications_json: notifications || {},
        ai_json: aiRest || {},
        appearance_json: appearanceRest || {},
        last_active: new Date().toISOString(),
      });

    if (error) throw error;

    return Response.json({ success: true, data: { timestamp: new Date().toISOString() } });
  } catch (error: any) {
    console.error('Settings update Error:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
