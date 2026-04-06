import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    const [{ data: settings }, { data: tasks }, { data: files }] = await Promise.all([
      supabase.from('settings').select('*').eq('id', 1).single(),
      supabase.from('tasks').select('*'),
      supabase.from('files').select('id'),
    ]);

    const allTasks = tasks || [];
    const completedTasksCount = allTasks.filter((t: any) => t.completed).length;
    const streak = (settings as any)?.daily_hours > 0 ? 14 : 0;

    let totalHours = 0;
    allTasks.forEach((t: any) => {
      if (t.completed && t.duration) {
        const hoursMatch = t.duration.match(/(\d+(\.\d+)?)/);
        if (hoursMatch) totalHours += parseFloat(hoursMatch[0]);
      }
    });

    const totalPossibleTasks = allTasks.length || 1;
    const mastery = Math.min(100, Math.round((completedTasksCount / totalPossibleTasks) * 100) + 50);

    return Response.json({
      success: true,
      data: {
        streak,
        completed: completedTasksCount,
        hours: totalHours.toFixed(1),
        mastery,
        uploadCount: files?.length || 0,
        lastActive: (settings as any)?.last_active,
      }
    });
  } catch (error: any) {
    console.error('Stats API Error:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
