import { supabaseAdmin } from '@/lib/supabase-server';

export async function GET() {
  try {
    const envStatus = {
      SUPABASE_URL: !!process.env.SUPABASE_URL,
      SUPABASE_ANON_KEY: !!process.env.SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      GEMINI_API_KEY: !!process.env.GEMINI_API_KEY
    };

    const health: any = {
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: envStatus,
      database: {
        connection: 'connected',
        tables: {
          uploads: 'unknown',
          planner: 'unknown',
          modules: 'unknown',
          qna: 'unknown',
          user_settings: 'unknown'
        }
      }
    };

    const checkTable = async (tableName: string) => {
      try {
        const { error } = await supabaseAdmin.from(tableName).select('count', { count: 'exact', head: true }).limit(1);
        return error ? `error: ${error.message}` : 'exists';
      } catch (e: any) {
        return `error: ${e.message}`;
      }
    };

    health.database.tables.uploads = await checkTable('uploads');
    health.database.tables.planner = await checkTable('planner');
    health.database.tables.modules = await checkTable('modules');
    health.database.tables.qna = await checkTable('qna');
    health.database.tables.user_settings = await checkTable('user_settings');

    // If any critical table is missing or env var is missing, set health to unhealthy
    if (
      Object.values(health.database.tables as Record<string, unknown>).some(v => (v as any).toString().startsWith('error')) ||
      !envStatus.SUPABASE_URL || !envStatus.SUPABASE_ANON_KEY || !envStatus.SUPABASE_SERVICE_ROLE_KEY
    ) {
      health.status = 'unhealthy';
    }

    return Response.json({ success: true, data: health }, { status: health.status === 'healthy' ? 200 : 503 });
  } catch (error: any) {
    console.error('[API/Health] Error:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
