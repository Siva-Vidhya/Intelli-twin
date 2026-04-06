import { supabaseAdmin } from '@/lib/supabase-server';
import { downloadAndExtractPDF } from '@/lib/pdf-analyzer';
import { analyzeText, AIAnalysis } from '@/lib/ai';

/**
 * Isolated Intelligence Pipeline:
 * Individually wraps each major processing stage to prevent a generic collapse.
 * Provides pinpoint diagnostics and automated fallback recovery.
 */
export async function POST(req: Request) {
  let fileId = 'unknown';
  const pipelineStatus = {
    fetch: "pending",
    ai: "pending",
    metadata: "pending",
    planner: "pending"
  };

  try {
    const { fileUrl, id } = await req.json();
    fileId = id;

    if (!fileUrl || !id) {
      return Response.json({ success: false, error: 'Missing parameters' }, { status: 400 });
    }

    // --- PHASE 1: PDF EXTRACTION ---
    let parsed;
    try {
      console.log(`[PIPELINE] Phase 1 START: PDF Extract for ${fileUrl}`);
      parsed = await downloadAndExtractPDF(fileUrl);
      if (!parsed.text || parsed.text.length < 20) throw new Error('Document yields no text.');
      pipelineStatus.fetch = "success";
      console.log(`[PIPELINE] Phase 1 SUCCESS: ${parsed.text.length} characters extracted.`);
    } catch (err: any) {
      pipelineStatus.fetch = "failed";
      console.error(`[PIPELINE] Phase 1 FAILURE: ${err.message}`);
      throw new Error(`PDF Extraction Failed: ${err.message}`);
    }

    // --- PHASE 2: AI ANALYSIS ---
    let analysis: AIAnalysis;
    try {
      console.log(`[PIPELINE] Phase 2 START: Intelligence Generation`);
      analysis = await analyzeText(parsed.text);
      
      if (analysis.summary.includes('[Generated via Recovery Mode]')) {
        pipelineStatus.ai = "failed (recovered)";
        console.warn(`[PIPELINE] Phase 2 WARNING: AI using fallback profile.`);
      } else {
        pipelineStatus.ai = "success";
        console.log(`[PIPELINE] Phase 2 SUCCESS: AI analysis generated.`);
      }
    } catch (err: any) {
      pipelineStatus.ai = "failed (critical)";
      console.error(`[PIPELINE] Phase 2 CRITICAL: ${err.message}`);
      // Fallback analysis to prevent pipeline exit if AI genuinely fails
      analysis = {
        summary: "This study material is currently being indexed. [Manual Analysis Required]",
        modules: [{
          name: "Document Overview", topics: ["New Content"], difficulty: "Easy",
          qna: [], planner_tasks: [{ task: "Review Document", topic: "General", priority: "Normal" }]
        }]
      };
    }

    // --- PHASE 3: METADATA SYNC ---
    try {
      console.log(`[PIPELINE] Phase 3 START: Knowledge Base Update`);
      const { error: uploadErr } = await supabaseAdmin
        .from('uploads')
        .update({ summary: analysis.summary })
        .eq('id', fileId);

      if (uploadErr) throw uploadErr;
      pipelineStatus.metadata = "success";
      console.log(`[PIPELINE] Phase 3 SUCCESS: Metadata synchronized.`);
    } catch (err: any) {
      pipelineStatus.metadata = "failed";
      console.error(`[PIPELINE] Phase 3 FAILURE: ${err.message}`);
      // Non-critical, continue to planner
    }

    // --- PHASE 4: STUDY PLAN GENERATION ---
    try {
      console.log(`[PIPELINE] Phase 4 START: Planner Table Influx`);
      if (analysis.modules && Array.isArray(analysis.modules)) {
        for (const mod of analysis.modules) {
          const { data: dbMod, error: modErr } = await supabaseAdmin
            .from('modules')
            .insert([{
              file_id: fileId,
              module_name: mod.name,
              topics: mod.topics || [],
              estimated_time: mod.difficulty === 'Hard' ? '2.5 Hours' : '1.5 Hours'
            }])
            .select().single();

          if (!modErr && dbMod) {
            // Sync Q&A and Tasks in parallel
            await Promise.all([
              mod.qna?.length > 0 ? supabaseAdmin.from('qna').insert(mod.qna.map(q => ({ module_id: dbMod.id, ...q }))) : Promise.resolve(),
              mod.planner_tasks?.length > 0 ? supabaseAdmin.from('planner').insert(mod.planner_tasks.map(pt => ({
                module: mod.name, topic: pt.topic || mod.name, task: pt.task, due_date: 'Auto-Scheduled', status: 'Pending'
              }))) : Promise.resolve()
            ]);
          }
        }
      }
      pipelineStatus.planner = "success";
      console.log(`[PIPELINE] Phase 4 SUCCESS: Study journey initialized.`);
    } catch (err: any) {
      pipelineStatus.planner = "failed";
      console.error(`[PIPELINE] Phase 4 FAILURE: ${err.message}`);
    }

    return Response.json({ 
      success: true, 
      data: {
        pipeline: pipelineStatus,
        summary: analysis.summary
      }
    });

  } catch (error: any) {
    console.error('[Analyze Route] Fatal Collision:', error.message);
    
    // Safety persistence for UI visibility
    if (fileId !== 'unknown') {
      try {
        await supabaseAdmin
          .from('uploads')
          .update({ summary: `Analysis Alert: ${error.message}` })
          .eq('id', fileId);
      } catch (e) {
        console.error('[Analyze Route] Recovery persistence failed');
      }
    }

    return Response.json({ success: false, error: error.message,
      pipeline: pipelineStatus
    }, { status: 500 });
  }
}
