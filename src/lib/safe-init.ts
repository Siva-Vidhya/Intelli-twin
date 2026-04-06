import { supabaseAdmin } from './supabase-server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export interface SafeInitStatus {
  storage: boolean;
  ai: boolean;
  parser: boolean;
}

export async function safeInit(): Promise<SafeInitStatus> {
  const status: SafeInitStatus = { storage: false, ai: false, parser: false };

  // 1. Try initialize storage
  try {
    if (supabaseAdmin) {
      const { error } = await supabaseAdmin.storage.getBucket('uploads');
      if (error && error.message.includes('not found')) {
        await supabaseAdmin.storage.createBucket('uploads', { public: true });
      }
      status.storage = true;
    }
  } catch (e) {
    status.storage = false;
  }

  // 2. Try initialize AI
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      const genAI = new GoogleGenerativeAI(apiKey);
      genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      status.ai = true;
    }
  } catch (e) {
    status.ai = false;
  }

  // 3. Try initialize parser
  try {
    status.parser = true;
  } catch (e) {
    status.parser = false;
  }

  return status;
}
