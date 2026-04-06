import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * AI Diagnostic Endpoint: Verifies that the GEMINI_API_KEY is correctly
 * configured and capable of performing a lightweight prompt.
 */
export async function GET() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return Response.json({ 
      success: false, 
      error: 'GEMINI_API_KEY is missing from environment variables (.env.local)' 
    }, { status: 500 });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    console.log('[AI Diagnostics] Testing connection with Gemini...');
    
    const result = await model.generateContent('Say exactly: API Key is Active.');
    const responseText = result.response.text().trim();

    return Response.json({ 
      success: true, 
      data: {
        message: responseText,
        model: 'gemini-1.5-flash',
        timestamp: new Date().toISOString()
      }
    });
  } catch (error: any) {
    console.error('[AI Diagnostics] Connection Failure:', error.message);
    return Response.json({ success: false, error: error.message 
    }, { status: 500 });
  }
}
