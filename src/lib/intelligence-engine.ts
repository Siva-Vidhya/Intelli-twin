import { supabaseAdmin } from './supabase-server';
import { downloadAndExtractPDF } from './pdf-analyzer';
import { analyzeText, AIAnalysis } from './ai';

export interface PipelineResult {
  fileId: string;
  success: boolean;
  status: {
    upload: 'success' | 'failed' | 'pending';
    parse: 'success' | 'failed' | 'fallback' | 'pending';
    ai: 'success' | 'failed' | 'fallback' | 'pending';
    planner: 'success' | 'failed' | 'pending';
  };
  summary: string;
}

/**
 * High-Availability Intelligence Engine:
 * Implements an isolated document pipeline with automated recovery layers.
 */
export async function runIntelligencePipeline(fileId: string, fileUrl: string): Promise<PipelineResult> {
  const result: PipelineResult = {
    fileId,
    success: false,
    status: {
      upload: 'success',
      parse: 'pending',
      ai: 'pending',
      planner: 'pending'
    },
    summary: ''
  };

  try {
    // --- STEP 1: PDF EXTRACTION ---
    let parsed: { text: string };
    try {
      console.log(`[ENGINE] Step 1: PDF Extraction [ID: ${fileId}]`);
      const extracted = await downloadAndExtractPDF(fileUrl);
      parsed = { text: extracted.text };
      
      if (parsed.text.startsWith('[Fallback Mode')) {
        result.status.parse = 'fallback';
      } else {
        result.status.parse = 'success';
      }
    } catch (e: any) {
      console.warn(`[ENGINE] Step 1: Extraction Critical Failure. Falling back. Error: ${e.message}`);
      result.status.parse = 'fallback';
      parsed = { text: `[Metadata Recovery] Source: ${fileUrl}` };
    }

    // --- STEP 2: AI ANALYSIS ---
    let analysis: AIAnalysis;
    try {
      console.log(`[ENGINE] Step 2: Intelligent Multi-Chunk Analysis`);
      analysis = await analyzeText(parsed.text);
      
      if (analysis.summary.includes('[Generated via Recovery Mode]')) {
        result.status.ai = 'fallback';
      } else {
        result.status.ai = 'success';
      }
    } catch (e: any) {
      console.error(`[ENGINE] Step 2: AI Critical Breakdown. Triggering Fallback Profile.`, e.message);
      result.status.ai = 'failed';
      analysis = {
        summary: "Detailed analysis was interrupted. Document is indexed with basic study markers. [Engine Throttled]",
        modules: [{
          name: "Study Material Overview",
          topics: ["General Content"],
          difficulty: "Medium",
          qna: [{ question: "What should I focus on?", answer: "Review the original PDF document for detailed specific insights." }],
          planner_tasks: [{ task: "Manual document scan", topic: "Overview", priority: "High" }]
        }]
      };
    }
    result.summary = analysis.summary;

    // --- STEP 3: DATABASE PERSISTENCE (EXHAUSTIVE METADATA) ---
    try {
      console.log(`[ENGINE] Step 3: Synchronizing Knowledge Profile`);
      const { error: syncErr } = await supabaseAdmin
        .from('uploads')
        .update({ summary: analysis.summary })
        .eq('id', fileId);
        
      if (syncErr) throw syncErr;
    } catch (e: any) {
       console.error('[ENGINE] Step 3: Metadata Sync Error.', e.message);
    }

    // --- STEP 4: STUDY PLAN GENERATION (Deeply Isolated) ---
    try {
      console.log(`[ENGINE] Step 4: Academic Journey Generation`);
      if (analysis.modules && Array.isArray(analysis.modules)) {
        for (const mod of analysis.modules) {
          try {
            // 4a. Module Entry
            const { data: dbMod, error: modErr } = await supabaseAdmin
              .from('modules')
              .insert([{
                file_id: fileId,
                module_name: mod.name,
                topics: mod.topics || [],
                estimated_time: mod.difficulty === 'Hard' ? '2.5 Hours' : '1.5 Hours'
              }])
              .select().single();

            if (modErr || !dbMod) {
               console.warn(`[ENGINE] Failed to insert module: ${mod.name}. Skipping sub-items.`);
               continue;
            }

            // 4b. Concurrent Q&A Insertion
            if (mod.qna && Array.isArray(mod.qna) && mod.qna.length > 0) {
              const { error: qnaErr } = await supabaseAdmin
                .from('qna')
                .insert(mod.qna.map(q => ({ 
                  module_id: dbMod.id, 
                  question: q.question, 
                  answer: q.answer 
                })));
              if (qnaErr) console.warn(`[ENGINE] Q&A Insertion failed for ${mod.name}`);
            }

            // 4c. Concurrent Task Insertion
            if (mod.planner_tasks && Array.isArray(mod.planner_tasks) && mod.planner_tasks.length > 0) {
              const { error: taskErr } = await supabaseAdmin
                .from('planner')
                .insert(mod.planner_tasks.map(pt => ({
                  module: mod.name, 
                  topic: pt.topic || mod.name, 
                  task: pt.task, 
                  due_date: 'Auto-Scheduled', 
                  status: 'Pending'
                })));
              if (taskErr) console.warn(`[ENGINE] Planner tasks failed for ${mod.name}`);
            }
          } catch (innerError: any) {
            console.error(`[ENGINE] Module processing block failed for ${mod.name}:`, innerError.message);
          }
        }
      }
      result.status.planner = 'success';
    } catch (e: any) {
      result.status.planner = 'failed';
      console.error(`[ENGINE] Step 4: Planner Generation Interrupted.`, e.message);
    }

    result.success = true;
    return result;

  } catch (error: any) {
    console.error('[ENGINE] FATAL PIPELINE COLLAPSE:', error.message);
    return result;
  }
}
