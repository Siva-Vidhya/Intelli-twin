import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    const { data: tasks, error: taskErr } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false });

    if (taskErr) throw taskErr;

    const allTasks = tasks || [];
    const totalTasks = allTasks.length;
    const completedTasks = allTasks.filter((t: any) => t.completed).length;
    const dailyPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    const weeklyCompletion = Math.min(100, Math.round(dailyPercentage * 0.9));

    let totalHours = 0;
    allTasks.forEach((t: any) => {
      if (t.completed && t.duration) {
        const h = parseFloat(t.duration.replace(/[^0-9.]/g, ''));
        if (!isNaN(h)) totalHours += h;
      }
    });

    // Notifications
    const notifications: any[] = [];
    const highPriority = allTasks.filter((t: any) => !t.completed && t.priority === 'High');
    if (highPriority.length > 0) {
      notifications.push({
        id: 'n-hp',
        type: 'deadline',
        message: `High Priority: ${highPriority[0].title} is pending.`,
        timestamp: 'Just now',
      });
    }

    // Latest AI analysis
    let latestAnalysis = null;
    const { data: files } = await supabase
      .from('files')
      .select('name, category, analysis_json')
      .not('analysis_json', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1);

    if (files && files.length > 0) {
      latestAnalysis = {
        fileName: files[0].name,
        category: files[0].category,
        analysis: files[0].analysis_json,
      };
    }

    const suggestionsPool = [
      'Your focus peaks in 1 hour. Schedule your hardest task now.',
      "You're progressing well — continue your revision.",
      'Concentration detected: Move heavy tasks earlier in your plan.',
      'Master CS fundamentals: focus on DBMS today.',
    ];

    if (latestAnalysis) {
      suggestionsPool.unshift(
        `Active Integration: Auto-generated tasks from ${latestAnalysis.fileName} are now ready.`
      );
    }

    const suggestions = suggestionsPool.slice(0, 2);
    if (completedTasks > 2) suggestions[0] = 'Great job! Your study twin has logged 3 sessions today.';

    return Response.json({
      success: true,
      data: {
        tasks: allTasks.map((t: any) => ({ ...t, completed: Boolean(t.completed) })),
        stats: { dailyPercentage, weeklyCompletion, studyHours: totalHours.toFixed(1), totalTasks, completedTasks },
        suggestions,
        notifications,
        latestAnalysis,
        lastUpdated: new Date().toLocaleTimeString(),
      }
    });
  } catch (error: any) {
    console.error('Planner Live Error:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
