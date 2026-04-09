import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function clearErrors() {
  console.log("Starting database recovery: Resetting 'failed' analysis statuses...");

  try {
    const { data, error, count } = await supabase
      .from('uploads')
      .update({ 
        status: 'processing', 
        summary: 'System recovery: Re-triggering analysis...' 
      })
      .eq('status', 'failed')
      .select();

    if (error) {
      throw error;
    }

    console.log(`Successfully reset ${data?.length || 0} failed uploads.`);
    console.log("The analysis pipeline should now pick these up or allow for manual re-triggering.");
  } catch (err: any) {
    console.error("Critical Failure during DB reset:", err.message);
  }
}

clearErrors();
