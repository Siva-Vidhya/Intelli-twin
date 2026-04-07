import { supabaseAdmin } from "@/lib/supabase-server";
import { analyzeText } from "@/lib/ai";
import { parsePDF } from "@/lib/pdf-parser";

/**
 * Phase 2: Background Worker Route
 * This runs the heavy pipeline (download → parse → AI → save) without blocking the frontend.
 * It is fired-and-forgotten by /api/analyze.
 */
export async function POST(req: Request) {
  let fileId = "unknown";

  try {
    const { fileUrl, fileId: id } = await req.json();
    fileId = id;

    if (!fileUrl || !fileId) {
      return Response.json({ success: false, error: "Missing parameters" }, { status: 400 });
    }

    // ── STEP 1: Download PDF ──────────────────────────────────────────────
    console.log("[BG] Downloading PDF:", fileUrl);
    const response = await fetch(fileUrl, { cache: "no-store" });
    if (!response.ok) throw new Error(`PDF fetch failed: ${response.status} ${response.statusText}`);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    console.log("[BG] PDF downloaded, bytes:", buffer.byteLength);

    // ── STEP 2: Extract Text (with retry) ────────────────────────────────
    let text = "";
    let attempt = 0;
    while (attempt < 3 && text.length < 50) {
      attempt++;
      try {
        console.log(`[BG] PDF parse attempt ${attempt}...`);
        text = await parsePDF(buffer);
        console.log("[BG] Extracted text length:", text.length);
      } catch (parseErr: any) {
        console.warn(`[BG] Parse attempt ${attempt} failed:`, parseErr.message);
      }
    }

    if (!text || text.length < 50) {
      throw new Error("PDF text extraction failed after 3 attempts. Document may be image-only.");
    }

    // Truncate to prevent Gemini token overflow
    const truncatedText = text.length > 10000 ? text.slice(0, 10000) : text;

    // ── STEP 3: AI Analysis (with retry) ─────────────────────────────────
    console.log("[BG] Starting AI analysis...");
    let analysis: any = null;
    let aiAttempt = 0;
    while (aiAttempt < 3 && !analysis) {
      aiAttempt++;
      try {
        console.log(`[BG] AI attempt ${aiAttempt}...`);
        analysis = await analyzeText(truncatedText);
      } catch (aiErr: any) {
        console.warn(`[BG] AI attempt ${aiAttempt} failed:`, aiErr.message);
      }
    }

    // Fallback if all AI attempts fail
    if (!analysis) {
      console.warn("[BG] All AI attempts failed. Using fallback summary.");
      const snippet = truncatedText.slice(0, 400).replace(/\n/g, " ").trim();
      analysis = {
        summary: `Study material overview: ${snippet}... [Extracted via Fallback Mode]`,
        modules: [{
          name: "Study Overview",
          topics: ["Core Content"],
          difficulty: "Medium",
          qna: [{ question: "What is this document about?", answer: "An educational document. Please review manually." }],
          planner_tasks: [{ task: "Read through the uploaded document", topic: "General", priority: "High" }]
        }]
      };
    }

    // ── STEP 4: Save to Database ──────────────────────────────────────────
    console.log("[BG] Saving results to Supabase...");
    await supabaseAdmin.from("uploads").update({
      summary: analysis.summary,
      status: "completed"
    }).eq("id", fileId);

    // Save modules, Q&A, tasks
    const modules = analysis.modules || [];
    for (const mod of modules) {
      const { data: dbMod, error: modErr } = await supabaseAdmin
        .from("modules")
        .insert([{
          file_id: fileId,
          module_name: mod.name,
          topics: mod.topics || [],
          estimated_time: mod.difficulty === "Hard" ? "2.5 Hours" : "1.5 Hours"
        }])
        .select().single();

      if (modErr || !dbMod) {
        console.warn("[BG] Module insert failed:", modErr?.message);
        continue;
      }

      const inserts: Promise<any>[] = [];

      if (mod.qna?.length > 0) {
        inserts.push(supabaseAdmin.from("qna").insert(
          mod.qna.map((q: any) => ({ module_id: dbMod.id, question: q.question, answer: q.answer }))
        ));
      }

      if (mod.planner_tasks?.length > 0) {
        inserts.push(supabaseAdmin.from("planner").insert(
          mod.planner_tasks.map((pt: any) => ({
            module: mod.name,
            topic: pt.topic || mod.name,
            task: pt.task,
            due_date: "Auto-Scheduled",
            status: "Pending"
          }))
        ));
      }

      await Promise.all(inserts);
    }

    console.log("[BG] Analysis pipeline complete for file:", fileId);
    return Response.json({ success: true });

  } catch (error: any) {
    console.error("[BG] Pipeline failure:", error.message);

    // Mark upload as failed so UI stops polling
    if (fileId !== "unknown") {
      await supabaseAdmin.from("uploads").update({
        summary: "Unable to analyze document. Please try re-uploading.",
        status: "failed"
      }).eq("id", fileId).catch(() => {});
    }

    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
