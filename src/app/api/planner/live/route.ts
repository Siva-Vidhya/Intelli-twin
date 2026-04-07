import { supabaseAdmin } from "@/lib/supabase-server";

/**
 * Phase 6: Live Planner State API
 * Returns the latest upload status + all associated study data.
 * Frontend polls this every 3 seconds until status === "completed" or "failed".
 */
export async function GET() {
  try {
    // Get the most recent upload
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

    // Only hydrate sub-tables when analysis is done
    if (fileId && status === "completed") {
      const [modulesRes, tasksRes] = await Promise.all([
        supabaseAdmin.from("modules").select("*").eq("file_id", fileId).order("created_at"),
        supabaseAdmin.from("planner").select("*").order("created_at")
      ]);

      modules = modulesRes.data || [];
      tasks = tasksRes.data || [];

      if (modules.length > 0) {
        const moduleIds = modules.map((m: any) => m.id);
        const { data: qnaData } = await supabaseAdmin
          .from("qna")
          .select("*")
          .in("module_id", moduleIds)
          .order("created_at");
        qna = qnaData || [];
      }
    } else if (fileId && status === "processing") {
      // While processing, return tasks that may already exist
      const { data: existingTasks } = await supabaseAdmin
        .from("planner").select("*").order("created_at");
      tasks = existingTasks || [];
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
