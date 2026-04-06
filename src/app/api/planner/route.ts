import { supabaseAdmin } from '@/lib/supabase-server';

export async function GET() {
  try {
    const { data: planner, error } = await supabaseAdmin
      .from('planner')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return Response.json({ success: true, data: { planner } });
  } catch (error: any) {
    console.error('[API/Planner]: GET error', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { module, topic, task, due_date } = await request.json();

    const { data, error } = await supabaseAdmin
      .from('planner')
      .insert([{
        module,
        topic,
        task,
        due_date,
        status: 'Pending'
      }])
      .select()
      .single();

    if (error) throw error;

    return Response.json({ 
      success: true, 
      data: {
        id: data.id, 
        timestamp: new Date().toISOString()
      }
    });
  } catch (error: any) {
    console.error('[API/Planner]: POST error', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { id, status } = await request.json();
    if (!id) return Response.json({ success: false, error: 'Task ID is required' }, { status: 400 });

    const { error } = await supabaseAdmin.from('planner').update({ status }).eq('id', id);

    if (error) throw error;

    return Response.json({ success: true, data: { id } });
  } catch (error: any) {
    console.error('[API/Planner]: PATCH error', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();
    if (!id) return Response.json({ success: false, error: 'Task ID is required' }, { status: 400 });

    const { error } = await supabaseAdmin.from('planner').delete().eq('id', id);

    if (error) throw error;

    return Response.json({ success: true, data: { id } });
  } catch (error: any) {
    console.error('[API/Planner]: DELETE error', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
