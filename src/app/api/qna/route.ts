import { supabaseAdmin } from '@/lib/supabase-server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const moduleId = searchParams.get('moduleId');

    const query = supabaseAdmin.from('qna').select('*');
    if (moduleId) query.eq('module_id', moduleId);

    const { data: qna, error } = await query.order('created_at', { ascending: true });

    if (error) throw error;

    return Response.json({ success: true, data: { qna } });
  } catch (error: any) {
    console.error('[API/QNA]: GET error', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { module_id, question, answer } = await request.json();

    const { data, error } = await supabaseAdmin
      .from('qna')
      .insert([{
        module_id,
        question,
        answer
      }])
      .select()
      .single();

    if (error) throw error;

    return Response.json({ success: true, data: { id: data.id } });
  } catch (error: any) {
    console.error('[API/QNA]: POST error', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
