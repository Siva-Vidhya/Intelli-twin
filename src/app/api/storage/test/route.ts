import { supabaseAdmin } from '@/lib/supabase-server';

/**
 * Storage Hub Audit (8-Step):
 * Robust diagnostic for the 'uploads' bucket ensuring high-authority access and
 * automated auto-provisioning of study resources.
 */
export async function GET() {
  const auditReport: any = {
    auth: {
      url_present: !!process.env.SUPABASE_URL,
      service_role_present: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
    hub_lifecycle: {
      detected: false,
      provisioned: false,
      public_access: false,
      write_delete_cycle: false,
    },
    diagnostics: [],
    success: false
  };

  try {
    console.log('[Storage Hub] Starting 8-step Audit Layer...');

    // 1-3. Environment Audit
    if (!auditReport.auth.url_present || !auditReport.auth.service_role_present) {
      throw new Error('Critical: SUPABASE_URL or SERVICE_ROLE_KEY is missing from .env.local');
    }

    // 4. Hub Check (Bucket Presence)
    console.log('[Storage Hub] Step 4: Scanning for target bucket...');
    const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets();
    if (listError) throw listError;

    const uploadsHub = buckets?.find(b => b.name === 'uploads');
    
    // 5. Hub Provisioning (Auto-Create)
    if (!uploadsHub) {
      console.log('[Storage Hub] Step 5: Hub missing. Attempting Automated Provisioning...');
      const { error: createError } = await supabaseAdmin.storage.createBucket('uploads', {
        public: true,
        fileSizeLimit: 52428800 // 50MB for robust study materials
      });
      if (createError) {
        console.error('[Storage Hub] Provisioning Failure:', createError.message);
        throw createError;
      }
      auditReport.hub_lifecycle.provisioned = true;
      auditReport.hub_lifecycle.public_access = true;
      console.log("[Storage Hub] Hub 'uploads' created with High Authority.");
    } else {
      auditReport.hub_lifecycle.detected = true;
      auditReport.hub_lifecycle.public_access = uploadsHub.public;
      console.log(`[Storage Hub] Hub 'uploads' detected. (Public: ${uploadsHub.public})`);
    }

    // 6. Hub Verification (Bypass RLS Write Test)
    console.log('[Storage Hub] Step 6: Initiating High-Authority Write Test...');
    const testFile = `hub-diag-${Date.now()}.txt`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from('uploads')
      .upload(testFile, 'Diagnostic Payload: Hub Health Check.', { 
        contentType: 'text/plain',
        upsert: true 
      });

    if (uploadError) {
      console.error('[Storage Hub] Hub Write Blocked:', uploadError.message);
      throw uploadError;
    }
    console.log('[Storage Hub] Hub Write: SUCCESS.');

    // 7. Hub Cleanup (Delete Test)
    console.log('[Storage Hub] Step 7: Performing lifecycle cleanup...');
    const { error: removeError } = await supabaseAdmin.storage
      .from('uploads')
      .remove([testFile]);
    
    if (removeError) {
       console.warn('[Storage Hub] Cleanup Warning: Diagnostic residue remains.', removeError.message);
    } else {
      auditReport.hub_lifecycle.write_delete_cycle = true;
      console.log('[Storage Hub] Hub Cycle: COMPLETE.');
    }

    // 8. Result Compilation
    auditReport.success = true;
    console.log('[Storage Hub] AUDIT SUMMARY: ALL SYSTEMS OPERATIONAL.');
    return Response.json({ success: true, data: auditReport });

  } catch (error: any) {
    console.error('[Storage Hub] Audit Failure:', error.message);
    auditReport.error = error.message || 'Diagnostic System Error';
    return Response.json({ success: false, error: error.message, data: auditReport }, { status: 500 });
  }
}
