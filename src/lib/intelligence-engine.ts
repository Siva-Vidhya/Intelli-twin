import { supabaseAdmin } from "@/lib/supabase-server";
import { analyzeText } from "@/lib/ai";
import { parsePDF } from "@/lib/pdf-parser";

/**
 * GUARANTEED Pipeline Engine
 * This handles the heavy lifting (download -> parse -> AI -> save).
 * It is designed to be called asynchronously without awaiting, within the same process.
 */
export async function runAnalysisPipeline(fileUrl: string, fileId: string) {
  console.log(`[Engine] Starting Guaranteed Pipeline for: ${fileId}`);
  
  try {
    // 1. Initial Status Update
    await supabaseAdmin.from("uploads").update({
      status: "processing",
      summary: "Initializing Intelligent Analysis..."
    }).eq("id", fileId);

    // 2. Download & Parse
    console.log(`[Engine] Downloading PDF: ${fileUrl}`);
    const response = await fetch(fileUrl);
    if (!response.ok) throw new Error(`PDF Fetch Failed: ${response.status}`);
    
    const buffer = Buffer.from(await response.arrayBuffer());
    console.log(`[Engine] Parsing PDF (${buffer.byteLength} bytes)...`);
    
    const text = await parsePDF(buffer);
    if (!text || text.length < 50) throw new Error("PDF Extraction yielded no usable text.");

    // 3. AI Analysis
    console.log(`[Engine] Analyzing ${text.length} characters with Gemini...`);
    const analysis = await analyzeText(text);

    // 4. Save to Database (Atomic-ish)
    console.log(`[Engine] Saving Analysis to DB...`);
    
    // Update Upload Record
    await supabaseAdmin.from("uploads").update({
      summary: analysis.summary,
      status: "completed"
    }).eq("id", fileId);

    // Insert Modules, Q&A, and Linked Planner Tasks
    for (const mod of analysis.modules) {
      const { data: dbMod, error: modErr } = await supabaseAdmin
        .from("modules")
        .insert([{
          file_id: fileId,
          module_name: mod.name,
          topics: mod.topics,
          estimated_time: mod.difficulty === "Hard" ? "2.5 Hours" : "1.5 Hours"
        }])
        .select().single();

      if (modErr || !dbMod) {
        console.error(`[Engine] Module Insert Error:`, modErr?.message);
        continue;
      }

      // Q&A
      if (mod.qna?.length > 0) {
        await supabaseAdmin.from("qna").insert(
          mod.qna.map((q: any) => ({
            module_id: dbMod.id,
            question: q.question,
            answer: q.answer
          }))
        );
      }

      // Planner Tasks (LINKED TO FILE_ID)
      if (mod.planner_tasks?.length > 0) {
        await supabaseAdmin.from("planner").insert(
          mod.planner_tasks.map((pt: any) => ({
            file_id: fileId, // GUIDED LINK
            module: mod.name,
            topic: pt.topic,
            task: pt.task,
            due_date: "Auto-Scheduled",
            status: "Pending"
          }))
        );
      }
    }

    console.log(`[Engine] PIPELINE SUCCESS: ${fileId}`);

  } catch (error: any) {
    console.error(`[Engine] PIPELINE CRITICAL FAILURE [${fileId}]:`, error.message);
    
    await supabaseAdmin.from("uploads").update({
      status: "failed",
      summary: `Analysis Error: ${error.message}. Please check if the PDF is readable.`
    }).eq("id", fileId).catch(() => {});
  }
}
