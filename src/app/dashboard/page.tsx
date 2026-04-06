"use client";

import { Brain, CheckCircle2, Clock, Target, TrendingUp, Calendar, AlertCircle, Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useState, useEffect, useCallback } from 'react';

export default function Dashboard() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [progressData, setProgressData] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [deadlines, setDeadlines] = useState<any[]>([]);
  const [stats, setStats] = useState({ streak: 0, completed: 0, hours: "0", mastery: 0 });
  const [isPolling, setIsPolling] = useState(false);

  const fetchDashboardData = useCallback(async () => {
    setIsPolling(true);
    try {
      // 1. Fetch from multiple API endpoints in parallel
      const [statsRes, tasksRes, progressRes, liveRes] = await Promise.all([
        fetch('/api/dashboard/stats'),
        fetch('/api/dashboard/tasks'),
        fetch('/api/dashboard/progress'),
        fetch('/api/dashboard/live')
      ]);

      // 2. Parse responses safely — only parse JSON when response is OK
      if (statsRes.ok) {
        const statsJson = await statsRes.json();
        if (statsJson.success && statsJson.data) setStats(statsJson.data);
      }
      if (tasksRes.ok) {
        const tasksJson = await tasksRes.json();
        if (tasksJson.success && tasksJson.data) setTasks(tasksJson.data);
      }
      if (progressRes.ok) {
        const progressJson = await progressRes.json();
        if (progressJson.success && progressJson.data) setProgressData(progressJson.data);
      }
      if (liveRes.ok) {
        const liveJson = await liveRes.json();
        if (liveJson.success && liveJson.data) {
          const liveData = liveJson.data;
          setSuggestions(liveData.suggestions || []);
          setDeadlines(liveData.deadlines || []);
          
          // Handle AI-generated tasks
          if (liveData.newTask) {
            setTasks(prev => {
              if (!prev.find(t => t.title === liveData.newTask.title)) {
                return [...prev, liveData.newTask];
              }
              return prev;
            });
          }
        }
      }
    } catch (e) {
      console.error("Dashboard multi-fetch error:", e);
    } finally {
      setTimeout(() => setIsPolling(false), 500); // UI polish
    }
  }, []);

  // Initial load and setup polling (5 seconds)
  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 5000);
    return () => clearInterval(interval);
  }, [fetchDashboardData]);

  const handleTaskComplete = async (id: string | number) => {
    // 1. Optimistic Update in UI
    setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: true } : t));

    try {
      // 2. Sync with Database
      const res = await fetch('/api/dashboard/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, completed: true })
      });

      if (res.ok) {
        const result = await res.json();
        if (result.success) {
          // 3. Immediately refresh stats and progress data
          fetchDashboardData();
        }
      }
    } catch (e) {
      console.error("Error updating task status:", e);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-outfit font-bold">Welcome back, Student</h1>
          <p className="text-gray-400 mt-1">Your AI Digital Twin has updated your learning plan.</p>
        </div>
        <div className={`flex items-center gap-3 glass-card px-4 py-2 transition-all duration-500 ${isPolling ? 'border-[#00f2fe]/40 bg-[#00f2fe]/5' : ''}`}>
          {isPolling ? (
            <Loader2 className="text-[#00f2fe] animate-spin w-5 h-5" />
          ) : (
            <Brain className="text-[#00f2fe] hover:scale-110 transition-transform w-5 h-5" />
          )}
          <span className="text-sm font-medium text-[#00f2fe]">
            {isPolling ? 'Syncing Live...' : 'AI Engine Active'}
          </span>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Study Streak', value: `${stats.streak} Days`, icon: TrendingUp, color: 'text-[#00f2fe]', borderColor: 'border-l-[#00f2fe]' },
          { label: 'Tasks Completed', value: stats.completed, icon: CheckCircle2, color: 'text-emerald-500', borderColor: 'border-l-emerald-500' },
          { label: 'Hours Studied', value: `${stats.hours}h`, icon: Clock, color: 'text-orange-500', borderColor: 'border-l-orange-500' },
          { label: 'Overall Mastery', value: `${stats.mastery}%`, icon: Target, color: 'text-purple-500', borderColor: 'border-l-purple-500' },
        ].map((item, idx) => (
          <div key={idx} className={`glass-card p-6 border-l-4 transition-all duration-500 ${item.borderColor}`}>
            <div className="flex justify-between items-start">
              <div>
                <p className="text-gray-400 text-sm font-medium">{item.label}</p>
                <h3 className="text-3xl font-bold mt-2 animate-in slide-in-from-bottom-2">{item.value}</h3>
              </div>
              <div className={`p-3 bg-white/5 rounded-lg ${item.color}`}><item.icon /></div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Today's Plan */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-panel p-6 rounded-2xl min-h-[400px]">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#00f2fe]" /> 
                Today&apos;s Plan
              </h2>
              {isPolling && <span className="text-[10px] uppercase font-black tracking-widest text-[#00f2fe] animate-pulse flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin"/> Live Sync</span>}
            </div>
            <div className="space-y-4">
              {tasks.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 gap-4 animate-in fade-in duration-700">
                   <div className="p-4 bg-emerald-500/10 rounded-full text-emerald-400"><CheckCircle2 className="w-8 h-8"/></div>
                   <p className="text-gray-400 text-sm italic">All tasks completed. Your digital twin is proud!</p>
                </div>
              )}
              {tasks.map((task, idx) => (
                <div key={task.id} 
                  className={`p-4 rounded-xl flex items-center justify-between border border-white/5 transition-all duration-500 animate-in slide-in-from-left-4 ${task.completed ? 'bg-emerald-500/5 opacity-50 scale-[0.98]' : task.bg}`}
                  style={{animationDelay: `${idx * 100}ms`}}
                >
                  <div className="flex items-center gap-4">
                    <div className={`text-sm font-medium w-20 ${task.completed ? 'text-gray-500 line-through' : 'text-gray-300'}`}>{task.time || '--:--'}</div>
                    <div className="w-px h-8 bg-white/10"></div>
                    <div>
                      <h4 className={`font-bold transition-colors ${task.completed ? 'text-gray-400 line-through' : 'text-white'}`}>{task.title}</h4>
                      <p className="text-xs text-gray-400">{task.duration}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleTaskComplete(task.id)}
                    disabled={task.completed}
                    className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all ${
                      task.completed 
                        ? 'bg-emerald-500 text-white border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]' 
                        : 'border-white/20 hover:bg-emerald-500/20 hover:text-emerald-500 hover:border-emerald-500 text-transparent'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Progress Chart */}
          <div className="glass-panel p-6 rounded-2xl h-[400px] flex flex-col">
            <h2 className="text-xl font-bold mb-4">Weekly Progress Tracker</h2>
            <div className="w-full h-full min-h-[300px]">
              {progressData && progressData.length > 0 && (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={progressData}>
                    <XAxis dataKey="name" stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip 
                      cursor={{fill: 'rgba(255,255,255,0.05)'}} 
                      contentStyle={{backgroundColor: 'rgba(15, 15, 15, 0.9)', borderColor: '#333', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)'}} 
                    />
                    <Bar dataKey="completed" fill="#00f2fe" radius={[6, 6, 0, 0]} barSize={35} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* AI Suggestions */}
          <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group">
            {isPolling && <div className="absolute top-0 left-0 w-full h-[2px] bg-purple-500/20 overflow-hidden"><div className="h-full bg-purple-500 animate-[shimmer_2s_infinite] w-[30%]"></div></div>}
            <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
              <Brain className="w-5 h-5 text-purple-400 group-hover:rotate-12 transition-transform" />
              AI Insights
            </h2>
            <div className="space-y-4">
              {suggestions.length === 0 && <p className="text-sm text-gray-500 italic py-4">Generating smart recommendations...</p>}
              {suggestions.map((sug, i) => (
                <div key={i} className={`p-4 rounded-xl border transition-all duration-500 ${i % 2 === 0 ? 'bg-purple-500/10 border-purple-500/20' : 'bg-[#00f2fe]/5 border-[#00f2fe]/10'} animate-in slide-in-from-right-4 fade-in`}>
                  <p className={`text-sm leading-relaxed ${i % 2 === 0 ? 'text-purple-200' : 'text-[#00f2fe]'}`}>&quot;{sug}&quot;</p>
                </div>
              ))}
            </div>
          </div>

          {/* Upcoming Deadlines */}
          <div className="glass-panel p-6 rounded-2xl relative overflow-hidden">
             {isPolling && <div className="absolute top-0 left-0 w-full h-[2px] bg-orange-500/20 overflow-hidden"><div className="h-full bg-orange-500 animate-[shimmer_1.5s_infinite] w-[30%]"></div></div>}
            <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
              <AlertCircle className="w-5 h-5 text-orange-400" />
              Upcoming Deadlines
            </h2>
            <div className="space-y-3">
              {deadlines.length === 0 && <p className="text-sm text-gray-500 text-center py-4 italic">No urgent deadlines.</p>}
              {deadlines.map((deadline) => (
                <div key={deadline.id} className="flex items-center justify-between pb-3 border-b border-white/5 last:border-0 last:pb-0 group hover:bg-white/5 p-2 -mx-2 rounded-lg transition-colors animate-in slide-in-from-right-4">
                  <div>
                    <h4 className="text-sm font-bold group-hover:text-orange-400 transition-colors">{deadline.title}</h4>
                    <p className={`text-[10px] font-bold uppercase tracking-tight ${deadline.color === 'red' ? 'text-red-400' : deadline.color === 'yellow' ? 'text-yellow-400' : 'text-emerald-400'}`}>{deadline.time}</p>
                  </div>
                  <span className={`px-2 py-0.5 text-[10px] rounded-full font-black uppercase tracking-widest ${deadline.color === 'red' ? 'bg-red-500/20 text-red-400' : deadline.color === 'yellow' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                    {deadline.priority}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(350%); }
        }
      `}</style>
    </div>
  );
}
