import { supabaseAdmin } from "@/lib/supabase-server";

/**
 * Phase 2: Non-Blocking Trigger Route
 * Accepts the upload data, marks the file as "processing", 
 * fires the background worker WITHOUT awaiting it, and returns immediately.
 * This prevents frontend timeouts on large PDFs.
 */
export async function POST(req: Request) {
  try {
    const { fileUrl, fileId, fileName } = await req.json();

    if (!fileUrl || !fileId) {
      return Response.json({ success: false, error: "Missing fileUrl or fileId" }, { status: 400 });
    }

    console.log("Upload received — triggering background analysis for:", fileId);

    // Mark as processing immediately
    try {
      await supabaseAdmin.from("uploads").update({
        status: "processing",
        summary: "Initializing Intelligent Analysis..."
      }).eq("id", fileId);
    } catch (statusErr: any) {
      console.warn("[Analyze] Could not mark status:", statusErr.message);
    }

    // Fire background worker - no await (non-blocking)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    fetch(`${baseUrl}/api/analyze/background`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileUrl, fileId, fileName })
    }).catch((err: any) => {
      console.error("[Analyze] Background trigger error:", err.message);
    });

    // Return immediately — frontend polls for status
    return Response.json({ success: true, status: "processing" });

  } catch (error: any) {
    console.error("[Analyze] Trigger error:", error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
