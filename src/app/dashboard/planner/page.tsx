"use client";

import { useEffect, useState, useCallback } from 'react';
import {
  Calendar as CalendarIcon, Clock, Plus, Sparkles,
  CheckCircle2, Loader2, AlertCircle, TrendingUp, Target, Zap, Brain, X,
  BookOpen, ListChecks, HelpCircle, BarChart3, FileText, Trash2
} from 'lucide-react';
import { getSupabasePublic } from '@/lib/supabase';

interface PlannerTask {
  id: string;
  module: string;
  topic: string;
  task: string;
  due_date: string;
  status: 'Pending' | 'Completed' | string;
  created_at: string;
}

interface Module {
  id: string;
  file_id: string;
  module_name: string;
  topics: string[];
  estimated_time: string;
}

interface QNA {
  id: string;
  module_id: string;
  question: string;
  answer: string;
}

interface Stats {
  dailyPercentage: number;
  weeklyCompletion: number;
  studyHours: number;
  totalTasks: number;
  completedTasks: number;
}

type PlannerTab = 'summary' | 'modules' | 'qna' | 'tasks';

export default function StudyPlanner() {
  const [hasMounted, setHasMounted] = useState(false);
  const [plannerTasks, setPlannerTasks] = useState<PlannerTask[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [qna, setQna] = useState<QNA[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [activeTab, setActiveTab] = useState<PlannerTab>('summary');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [addingTask, setAddingTask] = useState(false);
  const [latestUpload, setLatestUpload] = useState<any>(null);

  const fetchPlannerData = useCallback(async () => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/planner/live');
      if (!res.ok) throw new Error(`Server returned HTTP ${res.status}`);
      const result = await res.json();
      if (!result.success || !result.data) throw new Error(result.message || 'Failed to load planner data');
      
      const data = result.data;
      const allTasks = data.tasks || [];
      setPlannerTasks(allTasks);
      setLatestUpload(data.latestAnalysis || null);
      setModules(data.modules || []);
      setQna(data.qna || []);

      // Compute Stats from standardized data
      if (data.stats) {
        setStats(data.stats);
      } else {
        const total = allTasks.length;
        const completed = allTasks.filter((t: any) => t.completed || t.status === 'Completed').length;
        setStats({
          totalTasks: total,
          completedTasks: completed,
          dailyPercentage: total ? Math.round((completed / total) * 100) : 0,
          weeklyCompletion: total ? Math.round((completed / total) * 85) : 0,
          studyHours: Math.round(total * 0.8)
        });
      }

      setLastUpdated(data.lastUpdated || new Date().toLocaleTimeString());
    } catch (error) {
      console.error('[Study Planner]: fetchPlannerData error', error);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  useEffect(() => {
    setHasMounted(true);
    fetchPlannerData();

    const supabase = getSupabasePublic();
    const channel = supabase
      .channel('planner_realtime_v3')
      .on('postgres_changes', { event: '*', table: 'planner', schema: 'public' }, () => fetchPlannerData())
      .on('postgres_changes', { event: '*', table: 'uploads', schema: 'public' }, () => fetchPlannerData())
      .on('postgres_changes', { event: '*', table: 'modules', schema: 'public' }, () => fetchPlannerData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchPlannerData]);

  const handleTaskStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'Completed' ? 'Pending' : 'Completed';
    setPlannerTasks(prev => prev.map(t => t.id === id ? { ...t, status: newStatus } : t));
    try {
      const res = await fetch('/api/planner', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus }),
      });
      if (res.ok) {
        const result = await res.json();
        if (result.success) fetchPlannerData();
      }
    } catch (error) { console.error('Failed to update task', error); }
  };

  const handleDeleteTask = async (id: string) => {
    setPlannerTasks(prev => prev.filter(t => t.id !== id));
    try {
      const res = await fetch('/api/planner', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        const result = await res.json();
        if (result.success) fetchPlannerData();
      }
    } catch (error) { console.error('Failed to delete task', error); }
  };

  const handleAddTask = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newTaskTitle.trim()) return;
    setAddingTask(true);
    try {
      const res = await fetch('/api/planner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task: newTaskTitle, due_date: 'Today', module: 'General', topic: 'User Added' }),
      });
      if (res.ok) {
        const result = await res.json();
        if (result.success) {
          setNewTaskTitle('');
          fetchPlannerData();
        }
      }
    } catch (error) { console.error('Failed to add task', error); }
    finally { setAddingTask(false); }
  };

  const TABS: { id: PlannerTab; label: string; icon: React.ReactNode }[] = [
    { id: 'summary',   label: 'Summary',    icon: <FileText className="w-4 h-4" /> },
    { id: 'modules',   label: 'Modules',    icon: <BookOpen className="w-4 h-4" /> },
    { id: 'qna',       label: 'Q & A',      icon: <HelpCircle className="w-4 h-4" /> },
    { id: 'tasks',     label: 'Tasks',      icon: <ListChecks className="w-4 h-4" /> },
  ];

  if (!hasMounted) return null; // Hydration defense

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-10">
        <div>
          <h1 className="text-4xl font-outfit font-bold text-white">AI Study Planner</h1>
          <p className="text-gray-400 mt-2">Dynamic schedule generated from your academic uploads.</p>
        </div>
        <button
          onClick={fetchPlannerData}
          disabled={isSyncing}
          className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-[#8a2be2] to-[#bc78ec] text-white rounded-full text-sm font-bold shadow-lg hover:scale-105 transition-all"
        >
          {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          Refresh Plan
        </button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          {[
            { label: 'Overall Progress', value: `${stats.dailyPercentage}%`, icon: <Target className="w-5 h-5"/>, color: 'text-[#00f2fe]' },
            { label: 'Weekly Readiness', value: `${stats.weeklyCompletion}%`, icon: <TrendingUp className="w-5 h-5"/>, color: 'text-purple-400' },
            { label: 'Study Hours', value: `${stats.studyHours}h`, icon: <Clock className="w-5 h-5"/>, color: 'text-orange-400' },
            { label: 'Tasks Done', value: `${stats.completedTasks}/${stats.totalTasks}`, icon: <CheckCircle2 className="w-5 h-5"/>, color: 'text-emerald-400' },
          ].map((s) => (
            <div key={s.label} className="glass-card p-5 bg-white/5 rounded-2xl border border-white/5">
              <div className="flex justify-between items-start mb-3">
                <span className={`p-2 bg-white/5 rounded-lg ${s.color}`}>{s.icon}</span>
                <span className="text-2xl font-bold text-white">{s.value}</span>
              </div>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="glass-card rounded-3xl border border-white/5 overflow-hidden">
        <div className="flex items-center gap-1 bg-black/20 p-2 border-b border-white/5">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all ${
                activeTab === tab.id ? 'bg-[#8a2be2] text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {tab.icon}{tab.label}
            </button>
          ))}
        </div>

        <div className="p-8 min-h-[400px]">
          {activeTab === 'summary' && (
            <div className="animate-in fade-in slide-in-from-bottom-4">
              {latestUpload ? (
                <div className="grid md:grid-cols-2 gap-8">
                  <div className="overflow-hidden flex flex-col max-w-full">
                    <h3 className="text-xs font-black uppercase tracking-widest text-[#00f2fe] mb-4">AI Analysis Summary</h3>
                    <div 
                      className="p-6 bg-white/5 rounded-2xl border border-white/5 leading-relaxed text-gray-300"
                      style={{ 
                        wordBreak: 'break-word', 
                        overflowWrap: 'anywhere', 
                        maxWidth: '100%', 
                        flexWrap: 'wrap' 
                      }}
                    >
                      <p className="font-bold text-lg text-white mb-2">{latestUpload.file_name}</p>
                      <div className="w-full">
                        {latestUpload.summary || "No summary available yet. Analysis might be in progress."}
                      </div>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-widest text-purple-400 mb-4">Extracted Modules</h3>
                    <div className="space-y-3">
                      {modules.map(mod => (
                        <div key={mod.id} className="p-4 bg-white/5 rounded-xl border border-white/5 flex justify-between items-center transition-all hover:bg-white/10">
                          <span className="text-white font-medium">{mod.module_name}</span>
                          <span className="text-gray-500 text-xs">{mod.estimated_time || '1h'}</span>
                        </div>
                      ))}
                      {modules.length === 0 && <p className="text-gray-600 italic py-4">No modules extracted yet.</p>}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-20 opacity-40">
                  <Brain className="w-12 h-12 mx-auto mb-4"/>
                  <p>No analyzed documents found. Please upload learning materials in the Knowledge Base.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'modules' && (
            <div className="grid md:grid-cols-3 gap-6 animate-in fade-in">
              {modules.map(mod => (
                <div key={mod.id} className="glass-card p-6 bg-white/5 rounded-2xl border border-white/5 hover:border-[#8a2be2]/40 transition-all">
                  <h4 className="font-bold text-lg text-white mb-3">{mod.module_name}</h4>
                  <ul className="space-y-2 mb-4">
                    {mod.topics?.map((t, i) => (
                      <li key={i} className="text-xs text-gray-400 flex items-center gap-2">
                        <div className="w-1 h-1 bg-[#864af9] rounded-full"/> {t}
                      </li>
                    ))}
                  </ul>
                  <div className="text-[10px] text-gray-500 uppercase font-black tracking-widest">
                    Est. Time: {mod.estimated_time}
                  </div>
                </div>
              ))}
              {modules.length === 0 && <p className="text-gray-500 italic col-span-3 text-center py-20">No modules found. Ensure you have analyzed some documents.</p>}
            </div>
          )}

          {activeTab === 'qna' && (
            <div className="space-y-4 animate-in fade-in">
              {qna.map((item, i) => (
                <div key={item.id} className="p-5 bg-white/5 rounded-xl border border-white/5 group hover:border-[#00f2fe]/20 transition-all">
                   <p className="text-xs font-black text-purple-400 uppercase mb-2">Question {i+1}</p>
                   <p className="text-white font-medium mb-4">{item.question}</p>
                   <details className="group">
                     <summary className="text-xs text-[#00f2fe] font-bold cursor-pointer list-none flex items-center gap-2 outline-none">
                       <HelpCircle className="w-4 h-4"/> Click to View Answer
                     </summary>
                     <p className="mt-3 text-sm text-gray-300 italic p-4 bg-black/20 rounded-lg border-l-2 border-emerald-500 animate-in slide-in-from-top-2">
                       {item.answer}
                     </p>
                   </details>
                </div>
              ))}
              {qna.length === 0 && <p className="text-gray-500 italic text-center py-20">No practice questions available.</p>}
            </div>
          )}

          {activeTab === 'tasks' && (
            <div className="animate-in fade-in">
              <form onSubmit={handleAddTask} className="flex gap-4 mb-8">
                <input 
                  type="text" value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)}
                  placeholder="Add a custom study objective..."
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-5 py-3 text-white focus:outline-none focus:border-[#8a2be2] transition-colors"
                />
                <button type="submit" disabled={addingTask} className="px-8 py-3 bg-[#8a2be2] text-white rounded-xl font-bold hover:scale-105 transition-all disabled:opacity-50">
                  {addingTask ? <Loader2 className="w-4 h-4 animate-spin"/> : 'Add Task'}
                </button>
              </form>
              
              <div className="space-y-3">
                {plannerTasks.map((t) => (
                  <div key={t.id} className={`p-4 rounded-xl border flex items-center gap-4 transition-all ${t.status === 'Completed' ? 'bg-emerald-500/5 border-emerald-500/20 opacity-60' : 'bg-white/5 border-white/5 hover:border-white/10'}`}>
                    <button onClick={() => handleTaskStatus(t.id, t.status)} className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${t.status === 'Completed' ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-gray-600'}`}>
                      {t.status === 'Completed' && <CheckCircle2 className="w-4 h-4"/>}
                    </button>
                    <div className="flex-1">
                      <p className={`font-bold ${t.status === 'Completed' ? 'line-through text-gray-500' : 'text-white'}`}>{t.task}</p>
                      <p className="text-[10px] text-gray-500 uppercase tracking-widest">{t.module || 'General'}</p>
                    </div>
                    <button onClick={() => handleDeleteTask(t.id)} className="text-gray-600 hover:text-red-400 p-2 transition-colors">
                       <Trash2 className="w-4 h-4"/>
                    </button>
                  </div>
                ))}
                {plannerTasks.length === 0 && <p className="text-gray-500 italic text-center py-20">Your study plan is empty. Add a task or analyze a document!</p>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
