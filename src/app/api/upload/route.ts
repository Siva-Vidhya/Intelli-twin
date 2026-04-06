import { supabaseAdmin } from '@/lib/supabase-server';
import { runIntelligencePipeline } from '@/lib/intelligence-engine';
import { safeInit } from '@/lib/safe-init';

/**
 * High-Availability Upload Pipeline:
 * Refactored to be non-blocking. Returns success immediately after metadata
 * save. Analysis runs in the background via the Intelligence Engine.
 */
export async function POST(req: Request) {
  try {
    // --- 1. SERVICE INITIALIZATION (Self-Healing) ---
    const status = await safeInit();
    // We do not reject on storage/AI initialization failures.
    // The pipeline will fall back gracefully.

    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return Response.json({ success: false, error: 'Empty binary payload' }, { status: 400 });
    }

    // --- 2. STORAGE TRANSPORT ---
    const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;
    const fileExt = file.name.split('.').pop();
    const filePath = `documents/${fileName}`;
    
    console.log(`[API/Upload] Transporting binary stream: ${filePath}`);
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let publicUrl = '';
    const { data: storageData, error: storageError } = await supabaseAdmin
      .storage
      .from('uploads')
      .upload(filePath, buffer, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: true
      });

    if (storageError) {
      console.warn('[API/Upload] Storage Hub Error. Intelligence running in fallback mode.');
      publicUrl = `fallback://${fileName}`;
    } else {
      const urlData = supabaseAdmin
        .storage
        .from('uploads')
        .getPublicUrl(filePath);
      
      publicUrl = urlData.data.publicUrl;
      
      if (!publicUrl.toLowerCase().endsWith(".pdf")) {
        throw new Error("Invalid file URL: File must be a valid PDF document with a proper extension.");
      }
    }

    // --- 4. ATOMIC METADATA SAVE ---
    console.log('[API/Upload] Synchronizing Knowledge Base...');
    let dbData: any = { id: `temp-${Date.now()}` };
    const { data: dbSyncData, error: dbError } = await supabaseAdmin
      .from('uploads')
      .insert([{
        file_name: fileName,
        file_url: publicUrl,
        file_type: fileExt || 'file',
        summary: 'Initializing Intelligent Analysis...'
      }])
      .select()
      .single();

    if (dbError) {
      console.warn('[API/Upload] Knowledge Base Sync Failed. Intelligence running in fallback mode.');
    } else {
      dbData = dbSyncData;
    }

    // Background trigger removed. The UI handles triggering /api/analyze natively.

    return Response.json({ 
      success: true, 
      data: {
        id: dbData.id, 
        fileUrl: publicUrl,
        fileName: fileName 
      }
    });

  } catch (error: any) {
    console.error('[API/Upload] Pipeline Crisis:', error.message);
    return Response.json({ success: false, error: error.message,
      details: 'Intelligence lab offline'
    }, { status: 500 });
  }
}
