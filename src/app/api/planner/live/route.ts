import { supabaseAdmin } from "@/lib/supabase-server";

/**
 * Phase 6: Live Planner State API (Guaranteed Linkage)
 * Returns the latest upload status + all associated study data.
 * Filtering is strictly by file_id to prevent data leakage.
 */
export async function GET() {
  try {
    // 1. Get the most recent upload (document context)
    const { data: uploads, error: uploadErr } = await supabaseAdmin
      .from("uploads")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1);

    if (uploadErr) throw uploadErr;

    const latestUpload = uploads?.[0] ?? null;
    const fileId = latestUpload?.id ?? null;
    const status = latestUpload?.status ?? "idle";

    let modules: any[] = [];
    let qna: any[] = [];
    let tasks: any[] = [];

    // 2. Fetch linked data only if we have a file context
    if (fileId) {
      // Parallel fetch for modules and LINKED planner tasks
      const [modulesRes, tasksRes] = await Promise.all([
        supabaseAdmin.from("modules").select("*").eq("file_id", fileId).order("created_at"),
        supabaseAdmin.from("planner").select("*").eq("file_id", fileId).order("created_at")
      ]);

      modules = modulesRes.data || [];
      tasks = tasksRes.data || [];

      // 3. Fetch Q&A for these modules
      if (modules.length > 0) {
        const moduleIds = modules.map((m: any) => m.id);
        const { data: qnaData } = await supabaseAdmin
          .from("qna")
          .select("*")
          .in("module_id", moduleIds)
          .order("created_at");
        qna = qnaData || [];
      }
    }

    return Response.json({
      success: true,
      status,          // "processing" | "completed" | "failed" | "idle"
      data: {
        latestAnalysis: latestUpload,
        modules,
        qna,
        tasks,
        lastUpdated: new Date().toISOString()
      }
    });

  } catch (error: any) {
    console.error("[Planner Live] Error:", error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
