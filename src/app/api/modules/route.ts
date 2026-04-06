import { supabaseAdmin } from '@/lib/supabase-server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('fileId');

    const query = supabaseAdmin.from('modules').select('*');
    if (fileId) query.eq('file_id', fileId);

    const { data: modules, error } = await query.order('created_at', { ascending: true });

    if (error) throw error;

    return Response.json({ success: true, data: { modules } });
  } catch (error: any) {
    console.error('[API/Modules]: GET error', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { file_id, module_name, topics, estimated_time } = await request.json();

    const { data, error } = await supabaseAdmin
      .from('modules')
      .insert([{
        file_id,
        module_name,
        topics: topics || [],
        estimated_time
      }])
      .select()
      .single();

    if (error) throw error;

    return Response.json({ success: true, data: { id: data.id } });
  } catch (error: any) {
    console.error('[API/Modules]: POST error', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
