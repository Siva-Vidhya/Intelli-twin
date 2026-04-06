import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    const { data: settings, error } = await supabase
      .from('settings')
      .select('*')
      .eq('id', 1)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    const s = settings || {};

    return Response.json({
      success: true,
      data: {
        profile: {
          name: s.name || 'Alex Student',
          email: s.email || 'alex@intellitwin.ai',
          studyGoal: s.study_goal || 'Master Computer Science fundamentals',
          dailyHours: s.daily_hours || 4,
          learningPace: s.learning_pace || 'Medium',
        },
        notifications: s.notifications_json || {
          studyReminders: true, deadlineAlerts: true, aiSuggestions: true,
          progressReports: false, weeklyDigest: true,
        },
        ai: {
          difficultyLevel: s.difficulty_level || 'Intermediate',
          focusSubjects: s.focus_subjects || ['Data Structures', 'Algorithms', 'OS'],
          ...(s.ai_json || { studyStyle: 'Mixed', enableAutoSchedule: true, enableAdaptiveLearning: true }),
        },
        appearance: {
          theme: s.theme || 'dark',
          accentColor: s.accent_color || '#00f2fe',
          ...(s.appearance_json || { fontSize: 'medium', compactMode: false }),
        },
        stats: {
          totalStudySessions: 147,
          knowledgeItems: 23,
          plannerTasks: 41,
          lastActive: s.last_active || new Date().toISOString(),
        },
      }
    });
  } catch (error: any) {
    console.error('Settings GET Error:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}

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
    console.error('Settings POST Error:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
