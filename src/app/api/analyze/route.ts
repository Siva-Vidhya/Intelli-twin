import { runAnalysisPipeline } from "@/lib/intelligence-engine";

/**
 * Phase 2: Guaranteed Non-Blocking Trigger
 * Fires the analysis pipeline logic internally within the same process.
 * This is 100% reliable compared to cross-route fetch triggers.
 */
export async function POST(req: Request) {
  try {
    const { fileUrl, fileId } = await req.json();

    if (!fileUrl || !fileId) {
      return Response.json({ success: false, error: "Missing fileUrl or fileId" }, { status: 400 });
    }

    console.log(`[Analyze] Starting Guaranteed Analysis Trigger for: ${fileId}`);

    // FIRE AND FORGET - Call the library directly without awaiting
    // This allows the request to return immediately to the frontend.
    runAnalysisPipeline(fileUrl, fileId).catch(err => {
      console.error(`[Analyze] Background Execution Error:`, err.message);
    });

    // Return immediately to the frontend polling dashboard
    return Response.json({ 
      success: true, 
      status: "processing", 
      message: "Analysis is running in the background." 
    });

  } catch (error: any) {
    console.error(`[Analyze] API Error:`, error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
