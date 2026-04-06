import { safeInit } from '@/lib/safe-init';

/**
 * System Health Dashboard:
 * Provides a real-time diagnostic profile for all sub-systems (Storage, AI, Parser).
 * Returns the global readiness status of the Intelligence Lab.
 */
export async function GET() {
  try {
    const status = await safeInit();
    
    const payload = {
      success: true,
      hub: {
        status: (status.storage && status.ai && status.parser) ? 'Ready' : 'Degraded',
        subsystems: {
          storage: status.storage ? 'ready' : 'error',
          intelligence: status.ai ? 'ready' : 'error',
          parser: status.parser ? 'ready' : 'error'
        }
      },
      recovery: {
        active: !status.storage || !status.ai || !status.parser,
        mode: !status.storage ? 'Local Buffer' : 'Fallback Profile'
      },
      timestamp: new Date().toISOString()
    };

    const responseStatus = payload.hub.status === 'Ready' ? 200 : 207;
    return Response.json({ success: true, data: payload }, { status: responseStatus });
  } catch (error: any) {
    console.error('[System Health] Error:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
