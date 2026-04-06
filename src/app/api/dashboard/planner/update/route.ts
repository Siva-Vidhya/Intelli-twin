import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const { id, completed } = await request.json();

    const { error } = await supabase
      .from('tasks')
      .update({
        completed: Boolean(completed),
        category: completed ? 'Completed' : 'Today',
      })
      .eq('id', id);

    if (error) throw error;

    return Response.json({ success: true, data: { id } });
  } catch (error: any) {
    console.error('Planner Update Error:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
