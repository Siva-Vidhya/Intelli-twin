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
    // Phase 2 — Trace PDF Download
    console.log("Downloading PDF...");
    const response = await fetch(fileUrl);
    console.log("PDF Response:", response.status);
    
    if (!response.ok) throw new Error(`PDF Fetch Failed: ${response.status}`);
    
    const buffer = Buffer.from(await response.arrayBuffer());
    console.log("PDF Size:", buffer.byteLength);

    if (buffer.byteLength < 1000) {
      console.warn("[Warning] PDF size is very small, might not have been downloaded properly.");
    }

    console.log(`[Engine] Parsing PDF (${buffer.byteLength} bytes)...`);
    
    const text = await parsePDF(buffer);

    // Phase 3 — Trace PDF Extraction
    console.log("Extracted Text Length:", text.length);
    console.log("First 500 chars:", text.slice(0, 500));

    if (!text || text.length < 50) {
       console.error("ROOT CAUSE DETECTED: Extraction Empty (or too short).");
       throw new Error("PDF Extraction yielded no usable text.");
    }

    // 3. AI Analysis
    // Phase 4 — Trace AI Call
    console.log("Sending to AI:", text.length);
    const analysis = await analyzeText(text);
    console.log("AI RESPONSE:", analysis);

    if (!analysis || !analysis.summary) {
      console.error("ROOT CAUSE DETECTED: AI Call Failed to return structured output.");
    }

    // 4. Save to Database (Atomic-ish)
    // Phase 5 — Trace Database Save
    console.log("Saving Summary:", analysis.summary);
    console.log("Saving Modules:", analysis.modules.length);

    if (analysis.modules.length === 0) {
      console.error("ROOT CAUSE DETECTED: AI parsing failing (no modules returned).");
    }
    
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

      // Planner Tasks (LINKED VIA MODULE NAME FOR NOW)
      if (mod.planner_tasks?.length > 0) {
        await supabaseAdmin.from("planner").insert(
          mod.planner_tasks.map((pt: any) => ({
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
    
    try {
      await supabaseAdmin.from("uploads").update({
        status: "failed",
        summary: `Analysis Error: ${error.message}. Please check if the PDF is readable.`
      }).eq("id", fileId);
    } catch (saveErr) {
      console.error("[Engine] Failed to save error status to DB:", saveErr);
    }
  }
}
