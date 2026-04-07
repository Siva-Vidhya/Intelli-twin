import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export interface AIAnalysis {
  summary: string;
  modules: Array<{
    name: string;
    topics: string[];
    difficulty: string;
    qna: Array<{ question: string; answer: string }>;
    planner_tasks: Array<{ task: string; topic: string; priority: string }>;
  }>;
}

/**
 * Safe JSON extractor — strips markdown fences and extracts valid JSON.
 */
function safeParseJSON(raw: string): any {
  // Strip markdown code fences if present
  let clean = raw.trim();
  if (clean.startsWith("```")) {
    clean = clean.replace(/^```[a-z]*\n?/i, "").replace(/```$/,"").trim();
  }
  // Find the first { or [ and the last } or ]
  const firstBrace = Math.min(
    clean.indexOf("{") === -1 ? Infinity : clean.indexOf("{"),
    clean.indexOf("[") === -1 ? Infinity : clean.indexOf("[")
  );
  const lastBrace = Math.max(clean.lastIndexOf("}"), clean.lastIndexOf("]"));
  if (firstBrace === Infinity || lastBrace === -1) throw new Error("No JSON found in AI response");
  return JSON.parse(clean.slice(firstBrace, lastBrace + 1));
}

export async function analyzeText(rawText: string): Promise<AIAnalysis> {
  // Truncate to prevent token overflow
  const text = rawText.length > 9000 ? rawText.slice(0, 9000) : rawText;

  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.3,
    }
  });

  const prompt = `You are an expert academic study planner AI. Analyze the following document text and return ONLY a valid JSON object (no markdown, no explanation).

Document text:
"""
${text.replace(/\\/g, "\\\\").replace(/"""/g, "'''")}
"""

Return this exact JSON structure:
{
  "summary": "A clear 2-3 sentence summary of the document",
  "modules": [
    {
      "name": "Module name",
      "topics": ["topic1", "topic2"],
      "difficulty": "Easy|Medium|Hard",
      "qna": [
        { "question": "A study question?", "answer": "The answer." }
      ],
      "planner_tasks": [
        { "task": "Task description", "topic": "Topic name", "priority": "High|Medium|Low" }
      ]
    }
  ]
}

Rules:
- Return 2-4 modules minimum
- Return 2-3 Q&A per module
- Return 1-2 tasks per module
- Never return empty arrays
- Return ONLY the JSON object, nothing else`;

  let lastError: any;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      console.log(`[AI Engine] Attempt ${attempt}/3...`);
      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      console.log("[AI Engine] Raw response length:", responseText?.length || 0);

      const data = safeParseJSON(responseText);

      // Validate structure
      if (!data.summary || !Array.isArray(data.modules) || data.modules.length === 0) {
        throw new Error("AI response missing required fields: summary or modules");
      }

      // Ensure each module has required arrays
      const modules = data.modules.map((mod: any) => ({
        name: mod.name || "Study Module",
        topics: Array.isArray(mod.topics) ? mod.topics : ["General Review"],
        difficulty: mod.difficulty || "Medium",
        qna: Array.isArray(mod.qna) && mod.qna.length > 0
          ? mod.qna
          : [{ question: "What are the key concepts?", answer: "Review the module content." }],
        planner_tasks: Array.isArray(mod.planner_tasks) && mod.planner_tasks.length > 0
          ? mod.planner_tasks
          : [{ task: `Study ${mod.name || "this module"}`, topic: mod.name || "General", priority: "Medium" }]
      }));

      console.log(`[AI Engine] Success — ${modules.length} modules extracted.`);
      return { summary: data.summary, modules };

    } catch (err: any) {
      console.warn(`[AI Engine] Attempt ${attempt} failed:`, err.message);
      lastError = err;
      // Small delay before retry
      await new Promise(r => setTimeout(r, 1000 * attempt));
    }
  }

  // All attempts failed — generate a rule-based fallback
  console.warn("[AI Engine] All attempts failed. Generating fallback analysis.");
  const snippet = text.slice(0, 400).replace(/\n/g, " ").trim();
  return {
    summary: `This document covers: ${snippet}... [Analyzed via fallback mode]`,
    modules: [
      {
        name: "Core Concepts",
        topics: ["Main Ideas", "Key Themes"],
        difficulty: "Medium",
        qna: [
          { question: "What is this document about?", answer: "Please review the uploaded PDF for detailed content." },
          { question: "What are the main topics?", answer: "The document covers several academic topics outlined in the text." }
        ],
        planner_tasks: [
          { task: "Read and annotate the document", topic: "Core Concepts", priority: "High" },
          { task: "Summarize key points", topic: "Core Concepts", priority: "Medium" }
        ]
      },
      {
        name: "Review & Practice",
        topics: ["Self-Assessment", "Practice Questions"],
        difficulty: "Easy",
        qna: [
          { question: "How should I study this material?", answer: "Break the document into sections and review each systematically." }
        ],
        planner_tasks: [
          { task: "Create a mind map of the content", topic: "Review", priority: "Medium" }
        ]
      }
    ]
  };
}
