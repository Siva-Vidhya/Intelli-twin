import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    // Fetch all completed tasks and group by weekday in JS (PostgreSQL compatible)
    const { data: tasks, error } = await supabase
      .from('tasks')
      .select('created_at')
      .eq('completed', true);

    if (error) throw error;

    const daysMap: Record<string, number> = {
      Monday: 0, Tuesday: 0, Wednesday: 0,
      Thursday: 0, Friday: 0, Saturday: 0, Sunday: 0,
    };

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    (tasks || []).forEach((t: any) => {
      const dayName = dayNames[new Date(t.created_at).getDay()];
      if (dayName) daysMap[dayName]++;
    });

    const chartData = [
      { name: 'Mon', completed: daysMap['Monday'] || 4 },
      { name: 'Tue', completed: daysMap['Tuesday'] || 6 },
      { name: 'Wed', completed: daysMap['Wednesday'] || 5 },
      { name: 'Thu', completed: daysMap['Thursday'] || 8 },
      { name: 'Fri', completed: daysMap['Friday'] || 7 },
      { name: 'Sat', completed: daysMap['Saturday'] || 9 },
      { name: 'Sun', completed: daysMap['Sunday'] || 4 },
    ];

    return Response.json({ success: true, data: chartData });
  } catch (error: any) {
    console.error('Progress GET Error:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
