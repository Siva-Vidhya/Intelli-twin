import { supabase } from '@/lib/supabase';

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();
    if (!id) return Response.json({ success: false, error: 'File ID is required' }, { status: 400 });

    const { error } = await supabase.from('files').delete().eq('id', id);

    if (error) throw error;

    return Response.json({ success: true, data: { id, timestamp: new Date().toISOString() } });
  } catch (error: any) {
    console.error('Upload Delete Error:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
