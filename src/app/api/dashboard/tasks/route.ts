import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    const { data: tasks, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('category', 'Today')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const tasksWithBg = (tasks || []).map((t: any) => ({
      ...t,
      bg: t.priority === 'High'
        ? 'bg-[#00f2fe]/10'
        : t.priority === 'Medium'
        ? 'bg-orange-500/10'
        : 'bg-emerald-500/10',
    }));

    return Response.json({ success: true, data: tasksWithBg });
  } catch (error: any) {
    console.error('Tasks GET Error:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { id, completed } = await request.json();
    if (!id) return Response.json({ success: false, error: 'Task ID is required' }, { status: 400 });

    const { error } = await supabase
      .from('tasks')
      .update({ completed: Boolean(completed) })
      .eq('id', id);

    if (error) throw error;

    return Response.json({ success: true, data: { timestamp: new Date().toISOString() } });
  } catch (error: any) {
    console.error('Tasks POST Error:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
