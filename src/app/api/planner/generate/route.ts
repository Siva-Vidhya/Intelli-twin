import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabase } from '@/lib/supabase';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(req: Request) {
  try {
    const { topics, availableHours } = await req.json();

    let context = '';
    if (!topics || topics.length === 0) {
      const { data: files } = await supabase
        .from('files')
        .select('analysis_json')
        .not('analysis_json', 'is', null)
        .limit(5);

      context = (files || [])
        .map((f: any) => f.analysis_json?.summary || '')
        .filter(Boolean)
        .join('\n');
    } else {
      context = `User wants to focus on: ${topics.join(', ')}`;
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `
      Based on the following knowledge summary, generate a study plan for ${availableHours || 4} hours.
      Knowledge context: "${context}"

      Return ONLY a JSON object:
      {
        "plan": [
          { "time": "10:00 AM", "activity": "...", "duration": "1 hour", "priority": "High" }
        ]
      }
    `;

    const result = await model.generateContent(prompt);
    const aiResponseText = result.response.text();
    const jsonMatch = aiResponseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Could not find JSON in AI response');

    const generatedPlan = JSON.parse(jsonMatch[0]);

    return Response.json({ success: true, ...generatedPlan });
  } catch (error: any) {
    console.error('Generate API Error:', error);
    return Response.json({ success: false, error: 'Generation failed', message: error.message }, { status: 500 });
  }
}
