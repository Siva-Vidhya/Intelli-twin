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
 * Splits text into chunks of roughly 'size' characters.
 */
function splitIntoChunks(text: string, size: number): string[] {
  const chunks = [];
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.substring(i, i + size));
  }
  return chunks;
}

/**
 * Helper with exponential backoff retry
 */
async function generateWithRetry(model: any, prompt: string, retries = 2): Promise<any> {
    let lastError = null;
    for (let i = 0; i <= retries; i++) {
        try {
            const result = await model.generateContent(prompt);
            return JSON.parse(result.response.text());
        } catch (error: any) {
            console.warn(`[AI Engine] Attempt ${i + 1} failed.`, error.message);
            lastError = error;
            if (i < retries) {
                await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i))); // 1s, 2s Exponential backoff
            }
        }
    }
    throw lastError;
}

/**
 * Advanced AI Analysis: 
 * Processes text in 3000-character chunks and merges results to prevent token overflow.
 */
export async function analyzeText(text: string): Promise<AIAnalysis> {
  const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash",
    generationConfig: { responseMimeType: "application/json" }
  });

  const chunks = splitIntoChunks(text, 3000);
  console.log(`[AI Engine] Document split into ${chunks.length} chunks (3k chars/ea).`);

  const fullAnalysis: AIAnalysis = {
    summary: "",
    modules: []
  };

  try {
    // Process the first chunk for the summary and initial architecture
    const firstChunkPrompt = `
      As an expert academic AI, analyze this first segment of study material.
      Return a JSON object containing a summary and the first set of modules.
      
      Segment: "${chunks[0].replace(/"/g, "'")}"
      
      JSON Schema:
      {
        "summary": "High-level summary of the knowledge content",
        "modules": [
          {
            "name": "Module Title",
            "topics": ["T1", "T2"],
            "difficulty": "Easy/Medium/Hard",
            "qna": [{ "question": "Q", "answer": "A" }],
            "planner_tasks": [{ "task": "T", "topic": "C", "priority": "High" }]
          }
        ]
      }
    `;

    const chunkData = await generateWithRetry(model, firstChunkPrompt);
    fullAnalysis.summary = chunkData.summary || "Summary generated without specifics.";
    fullAnalysis.modules = chunkData.modules || [];

    // If there are more chunks, enrich the modules with subsequent segments (Process up to 4 more chunks to stay within reasonable time)
    const extraChunks = chunks.slice(1, 5); 
    for (const [index, chunk] of extraChunks.entries()) {
      console.log(`[AI Engine] Enriching study plan with chunk ${index + 2}/${chunks.length}...`);
      
      const enrichmentPrompt = `
        Continue the analysis for the following segment of the same document.
        Return ONLY additional JSON modules that weren't captured in the previous segment.
        
        Segment: "${chunk.replace(/"/g, "'")}"
        
        JSON Schema:
        {
          "modules": [
             { "name": "Next Module", "topics": ["T1"], "difficulty": "Medium", "qna": [], "planner_tasks": [] }
          ]
        }
      `;

      try {
        const enrichData = await generateWithRetry(model, enrichmentPrompt, 1); // Only 1 retry for enrichments
        if (enrichData && enrichData.modules) {
          fullAnalysis.modules = [...fullAnalysis.modules, ...enrichData.modules];
        }
      } catch (err) {
        console.warn(`[AI Engine] Chunk ${index + 2} enrichment failed, skipping segment.`, err);
      }
    }

    return fullAnalysis;

  } catch (error: any) {
    console.error("[AI Engine] Critical Intelligence Failure:", error.message);
    
    // Recovery: Attempt to generate a basic summary and introductory module if possible
    return {
      summary: text.substring(0, 500) + "... [Generated via Recovery Mode]",
      modules: [{
        name: "Introduction & Overview",
        topics: ["Core Concepts"],
        difficulty: "Easy",
        qna: [{ question: "What is this document about?", answer: "A comprehensive study guide extracted from the provided text." }],
        planner_tasks: [{ task: "Review starting chapters", topic: "Fundamentals", priority: "High" }]
      }]
    };
  }
}
