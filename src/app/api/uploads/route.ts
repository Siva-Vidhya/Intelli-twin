import { supabaseAdmin } from '@/lib/supabase-server';

export async function GET() {
  try {
    const { data: uploads, error } = await supabaseAdmin
      .from('uploads')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return Response.json({ success: true, data: { uploads } });
  } catch (error: any) {
    console.error('[API/Uploads]: GET error', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const tableName = 'uploads';
  try {
    const { file_name, file_url, file_type, summary } = await request.json();
    const payload = {
      file_name,
      file_url,
      file_type,
      summary: summary || null
    };

    console.log(`[API/${tableName}] Attempting INSERT:`, payload);

    const { data, error, status, statusText } = await supabaseAdmin
      .from(tableName)
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error(`[API/${tableName}] DB Error:`, { error, status, statusText });
      throw error;
    }

    console.log(`[API/${tableName}] Success: ID ${data.id}`);
    return Response.json({ success: true, data: { id: data.id, timestamp: new Date().toISOString() } });
  } catch (error: any) {
    console.error(`[API/${tableName}] POST Global Error:`, error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();
    if (!id) return Response.json({ success: false, error: 'Upload ID is required' }, { status: 400 });

    const { error } = await supabaseAdmin.from('uploads').delete().eq('id', id);

    if (error) throw error;

    return Response.json({ success: true, data: { id } });
  } catch (error: any) {
    console.error('[API/Uploads]: DELETE error', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
