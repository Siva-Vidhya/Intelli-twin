// Local NLP Analysis Pipeline

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  'the','is','at','which','and','on','in','to','with','of','for','a','an',
  'that','this','by','as','are','was','were','it','from','be','or','can',
  'not','your','we','will','they','have','but','all','has','had','been',
  'their','what','when','where','how','who','which','about','more','also',
  'some','these','those','then','than','into','over','such','each','other',
  'its','our','there','would','could','should','may','might','used','using',
]);

/** Detect if a raw PDF line looks like a heading */
function isHeading(line: string): boolean {
  const t = line.trim();
  if (!t || t.length < 3 || t.length > 80) return false;

  // Explicit markers: Chapter, Module, Unit, Section, Part + number
  if (/^(chapter|module|unit|section|part|topic)\s*[\d]+/i.test(t)) return true;

  // ALL-CAPS short line (e.g. "INTRODUCTION", "SQL QUERIES")
  if (t === t.toUpperCase() && /[A-Z]/.test(t) && t.length < 70) return true;

  // Title-Case line not ending in sentence punctuation
  const wordCount = t.split(/\s+/).length;
  const titleCase = /^[A-Z][^.?!]*$/.test(t);
  if (titleCase && wordCount <= 8 && !/[.?!]$/.test(t)) return true;

  // Numbered heading "1. Introduction" / "1.1 Overview"
  if (/^\d+(\.\d+)*\.?\s+[A-Z]/.test(t)) return true;

  return false;
}

/** Build frequency map of meaningful words */
function getTopKeywords(text: string, n = 6): string[] {
  const words = text.toLowerCase().match(/\b[a-z]{4,}\b/g) || [];
  const counts: Record<string, number> = {};
  for (const w of words) {
    if (!STOP_WORDS.has(w)) counts[w] = (counts[w] || 0) + 1;
  }
  return Object.keys(counts)
    .sort((a, b) => counts[b] - counts[a])
    .slice(0, n)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1));
}

/** Split text into clean sentences */
function getSentences(text: string): string[] {
  return text
    .split(/(?<=[.?!])\s+/)
    .map(s => s.trim().replace(/\s+/g, ' '))
    .filter(s => s.length > 25 && s.length < 300);
}

/** Generate Q&A items from a list of sentences + a topic label */
function buildQA(
  sentences: string[],
  topic: string,
  startIdx: number,
  count: number
): Array<{ question: string; answer: string; type: string }> {
  const qa: Array<{ question: string; answer: string; type: string }> = [];

  // 1. Definitional pattern "X is a/an/the ..."
  const defRegex = /^(.{3,50}?)\s+(is a|is an|is the|are)\s+(.{10,})$/i;
  for (const s of sentences) {
    if (qa.length >= count) break;
    const m = s.match(defRegex);
    if (m) {
      qa.push({
        question: `What ${m[2].toLowerCase()} ${m[3].replace(/[.?!]$/, '')}?`,
        answer: m[1].trim(),
        type: 'Short Answer',
      });
    }
  }

  // 2. Fallback: topic-based evaluative questions from related sentences
  if (qa.length < count) {
    const related = sentences.filter(s =>
      s.toLowerCase().includes(topic.toLowerCase().split(' ')[0])
    );
    const pool = related.length > 0 ? related : sentences;
    let i = 0;
    while (qa.length < count && i < pool.length) {
      qa.push({
        question: `Q${startIdx + qa.length + 1}: Explain in detail: "${pool[i].replace(/[.?!]$/, '')}?"`,
        answer: pool[i],
        type: i % 2 === 0 ? 'Long Answer' : 'Short Answer',
      });
      i++;
    }
  }

  // Number all questions consistently
  return qa
    .slice(0, count)
    .map((q, i) => ({ ...q, question: q.question.startsWith('Q') ? q.question : `Q${startIdx + i + 1}: ${q.question}` }));
}

// ─── Main Export ─────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const name = (formData.get('name') as string) || file?.name || 'Unknown Document';
    const cleanName = name.replace(/\.[^/.]+$/, '');

    // ── Step 1: Extract raw text ─────────────────────────────────────────────
    let rawText = '';

    if (file && file.type === 'application/pdf') {
      try {
        const pdfParse = require('pdf-parse'); // dynamic require avoids ESM issues
        const buffer = Buffer.from(await file.arrayBuffer());
        const result = await pdfParse(buffer);
        rawText = result.text || '';
      } catch (err) {
        console.error('pdf-parse error:', err);
        rawText = '';
      }
    } else if (file && file.size > 0 && file.size < 5_000_000 && !file.type.includes('image')) {
      rawText = await file.text();
    }

    const hasContent = rawText.trim().length > 100;

    // ── Step 2: Structural heading detection ────────────────────────────────
    const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
    const sentences = getSentences(rawText);

    type Section = { heading: string; body: string[]; lines: string[] };
    const sections: Section[] = [];
    let currentSection: Section | null = null;

    for (const line of lines) {
      if (isHeading(line)) {
        if (currentSection) sections.push(currentSection);
        currentSection = { heading: line, body: [], lines: [] };
      } else if (currentSection) {
        currentSection.lines.push(line);
        const sentenceChunk = getSentences(line);
        currentSection.body.push(...sentenceChunk);
      }
    }
    if (currentSection) sections.push(currentSection);

    // ── Step 3: Module generation ────────────────────────────────────────────
    const today = new Date();

    const effectiveSections: Section[] = sections.length >= 2
      ? sections
      : hasContent
        // Fallback: split sentences into 3 even chunks
        ? (() => {
            const chunkSize = Math.ceil(sentences.length / 3);
            const keywords = getTopKeywords(rawText, 3);
            return [0, 1, 2].map(i => ({
              heading: keywords[i] ? `${keywords[i]} Concepts` : `Module ${i + 1}`,
              body: sentences.slice(i * chunkSize, (i + 1) * chunkSize),
              lines: [],
            }));
          })()
        // No content at all
        : [{ heading: cleanName, body: [`No extractable text found in ${cleanName}.`], lines: [] }];

    const modules = effectiveSections.slice(0, 5).map((sec, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() + index);
      const dateStr = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      const startHour = 10 + (index % 3) * 2;
      const subtopics = sec.body.length > 0
        ? sec.body.slice(0, 4)
        : sec.lines.slice(0, 4).map(l => l.length > 5 ? l : `Study ${sec.heading}`);

      return {
        id: `mod-${index + 1}`,
        title: `Module ${index + 1}: ${sec.heading.replace(/^\d+(\.\d+)*\.?\s*/, '').trim()}`,
        date: dateStr,
        time: `${startHour}:00 AM – ${startHour + 2}:00 PM`,
        subtopics: subtopics.length > 0 ? subtopics : [`Study ${sec.heading}`],
        completed: false,
      };
    });

    // ── Step 4: Topics ───────────────────────────────────────────────────────
    const topics = hasContent
      ? getTopKeywords(rawText, 6)
      : modules.map(m => m.title.replace(/^Module \d+: /, ''));

    // ── Step 5: Summary ──────────────────────────────────────────────────────
    const summaryBase = sentences.length > 0
      ? sentences.slice(0, 5).join(' ')
      : `This document "${cleanName}" covers: ${topics.join(', ')}.`;
    const summary = summaryBase.length > 20
      ? summaryBase
      : `"${cleanName}" introduces the following core areas: ${topics.join(', ')}.`;

    // ── Step 6: Q&A generation ───────────────────────────────────────────────
    const qaSession: Array<{ question: string; answer: string; type: string }> = [];
    let qIndex = 0;
    for (const sec of effectiveSections.slice(0, 5)) {
      const secSentences = sec.body.length > 0 ? sec.body : sentences;
      const secQA = buildQA(secSentences, sec.heading, qIndex, 2);
      qaSession.push(...secQA);
      qIndex += secQA.length;
      if (qaSession.length >= 8) break;
    }
    // If still empty, use global sentences
    if (qaSession.length === 0 && sentences.length > 0) {
      qaSession.push(...buildQA(sentences, cleanName, 0, 6));
    }

    // ── Step 7: Tasks ────────────────────────────────────────────────────────
    const taskTypes = ['Study', 'Revise', 'Practice', 'Review'];
    const tasks = modules.map((mod, i) => ({
      title: `${taskTypes[i % 4]} – ${mod.title.replace(/^Module \d+: /, '')}`,
      priority: i === 0 ? 'High' : 'Medium',
      duration: '90 mins',
      category: i === 0 ? 'Today' : 'Upcoming',
    }));

    // ── Step 8: Study Plan (date-wise) ───────────────────────────────────────
    const studyPlan = modules.map((mod, i) => ({
      day: `Day ${i + 1}`,
      date: mod.date,
      slots: [
        { time: mod.time, activity: mod.title },
        { time: `${14 + (i % 2)}:00 PM – ${16 + (i % 2)}:00 PM`, activity: i % 2 === 0 ? 'Revision Session' : 'Practice Problems' },
      ],
    }));

    return Response.json({
      success: true,
      data: {
        summary,
        topics,
        modules,
        tasks,
        qaSession,
        studyPlan,
        difficulty: modules.length >= 4 ? 'Advanced' : 'Intermediate',
        estimatedTime: `${modules.length * 2} Hours`,
        priority: 'High',
        extractedText: rawText.slice(0, 8000), // stored in DB for reference
      }
    });
  } catch (error: unknown) {
    console.error('Analyze route error:', error instanceof Error ? error.message : String(error));
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
