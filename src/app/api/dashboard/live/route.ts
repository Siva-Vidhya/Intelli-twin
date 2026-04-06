import { supabase } from '@/lib/supabase';

const suggestionsPool = [
  "You struggled with Binary Trees yesterday. I've re-added a small review session for tomorrow.",
  'Great job on SQL queries! You finished 20% faster than average.',
  'Your focus has been dropping after 4PM. Consider moving heavy tasks earlier.',
  'Based on recent test scores, we should allocate more time to Operating Systems.',
  "You've maintained a solid study streak! Take a 15-min break.",
  'New practice problems for DBMS Normalization have been generated.',
];

export async function GET() {
  try {
    const { data: deadlines } = await supabase
      .from('tasks')
      .select('id, title, time, priority')
      .in('priority', ['High', 'Medium'])
      .eq('completed', false)
      .order('created_at', { ascending: true })
      .limit(3);

    const deadlinesWithColors = (deadlines || []).map((d: any) => ({
      ...d,
      color: d.priority === 'High' ? 'red' : d.priority === 'Medium' ? 'yellow' : 'emerald',
    }));

    const { count: fileCount } = await supabase
      .from('files')
      .select('id', { count: 'exact', head: true });

    const shuffledSugs = [...suggestionsPool].sort(() => 0.5 - Math.random()).slice(0, 2);
    if (fileCount && fileCount > 0) {
      shuffledSugs[0] = `I've analyzed your ${fileCount} uploaded documents. Let's start with a review.`;
    }

    const dynamicTask = Math.random() > 0.7 ? {
      id: 'ai-task-' + Date.now(),
      time: '08:00 PM',
      title: 'AI Extra Review: ' + ['Graphs', 'Recursion', 'Dynamic Prog.', 'Heaps', 'Sorting'][Math.floor(Math.random() * 5)],
      duration: '30 mins',
      bg: 'bg-purple-500/10',
      completed: false,
    } : null;

    return Response.json({
      success: true,
      data: {
        suggestions: shuffledSugs,
        deadlines: deadlinesWithColors,
        newTask: dynamicTask,
      }
    });
  } catch (error: any) {
    console.error('Dashboard Live Error:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
