import { supabaseAdmin } from '@/lib/supabase-server';

export async function GET() {
  try {
    // 1. Fetch latest uploaded document and its summary
    const { data: uploads, error: uploadErr } = await supabaseAdmin
      .from('uploads')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1);

    if (uploadErr) throw uploadErr;
    const latestUpload = uploads && uploads.length > 0 ? uploads[0] : null;
    const fileId = latestUpload ? latestUpload.id : null;

    // 2. If a file exists, fetch its associated modules, planner tasks, and q&a
    let modulesList: any[] = [];
    let qnaList: any[] = [];
    let tasksList: any[] = [];

    if (fileId) {
      const [modulesRes, qnaRes, tasksRes] = await Promise.all([
        supabaseAdmin.from('modules').select('*').eq('file_id', fileId).order('created_at', { ascending: true }),
        supabaseAdmin.from('qna').select('*').order('created_at', { ascending: true }), // Needs to map from module_id but for dashboard UI simplicity we pull all relating to these modules
        supabaseAdmin.from('planner').select('*').order('created_at', { ascending: true }) // Tasks might be general or bound to modules
      ]);

      modulesList = modulesRes.data || [];
      const moduleIds = modulesList.map(m => m.id);
      
      qnaList = qnaRes.data ? qnaRes.data.filter(q => moduleIds.includes(q.module_id)) : [];
      tasksList = tasksRes.data || [];
    } else {
      // If no file exists, fetch general planner tasks anyway
      const { data: tasks } = await supabaseAdmin.from('planner').select('*').order('created_at', { ascending: true });
      tasksList = tasks || [];
    }

    return Response.json({
      success: true,
      latestUpload,
      modules: modulesList,
      qna: qnaList,
      planner: tasksList,
      lastUpdated: new Date().toLocaleTimeString()
    });

  } catch (error: any) {
    console.error('[Planner Live API] Error:', error.message);
    return Response.json({ success: false, error: 'Failed to fetch live planner state' }, { status: 500 });
  }
}
