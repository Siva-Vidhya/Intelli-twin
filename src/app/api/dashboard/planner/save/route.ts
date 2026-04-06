import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const { id, title, time, duration, priority, category } = await request.json();

    if (!id || !title) {
      return Response.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    const { error } = await supabase.from('tasks').insert([{
      id, title, time, duration, priority, category, completed: false,
    }]);

    if (error) throw error;

    return Response.json({ success: true, data: { timestamp: new Date().toISOString() } });
  } catch (error: any) {
    console.error('Planner Save POST Error:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();
    if (!id) return Response.json({ success: false, error: 'Task ID is required' }, { status: 400 });

    const { error } = await supabase.from('tasks').delete().eq('id', id);

    if (error) throw error;

    return Response.json({ success: true, data: { id } });
  } catch (error: any) {
    console.error('Planner Save DELETE Error:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { id, ...updates } = await request.json();
    if (!id) return Response.json({ success: false, error: 'Task ID is required' }, { status: 400 });
    if (Object.keys(updates).length === 0) {
      return Response.json({ success: false, error: 'No fields to update' }, { status: 400 });
    }

    const { error } = await supabase.from('tasks').update(updates).eq('id', id);

    if (error) throw error;

    return Response.json({ success: true, data: { id } });
  } catch (error: any) {
    console.error('Planner Save PATCH Error:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
