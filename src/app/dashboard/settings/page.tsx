"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  User, Bell, Brain, Palette, Shield, Save, CheckCircle2,
  Loader2, ChevronRight, Zap, Clock,
  BookOpen, Target, Sliders, RefreshCw, Download, Trash2
} from 'lucide-react';
import { getSupabasePublic } from '@/lib/supabase';

interface UserSettings {
  full_name: string;
  email: string;
  study_goal: string;
  daily_hours: number;
  difficulty_level: string;
  theme: string;
  notifications_enabled: boolean;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={`relative w-12 h-6 rounded-full transition-all duration-300 ${on ? 'bg-[#00f2fe]' : 'bg-white/10'}`}
      aria-checked={on}
      role="switch"
    >
      <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-300 ${on ? 'translate-x-6' : 'translate-x-0'}`} />
    </button>
  );
}

function Section({ icon: Icon, title, accent, children }: {
  icon: React.ElementType;
  title: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <div className="glass-card p-6 rounded-2xl space-y-6 transition-all bg-white/5 border border-white/5 shadow-xl">
      <div className="flex items-center gap-3 border-b border-white/5 pb-4">
        <div className={`p-2.5 rounded-xl ${accent}`}>
          <Icon className="w-5 h-5" />
        </div>
        <h2 className="text-lg font-bold text-white tracking-tight">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function SettingRow({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-4 border-b border-white/5 last:border-0 last:pb-0">
      <div>
        <p className="text-sm font-semibold text-white">{label}</p>
        {desc && <p className="text-xs text-gray-500 mt-1">{desc}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

export default function SettingsPage() {
  const [hasMounted, setHasMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'notifications' | 'ai' | 'appearance' | 'account'>('profile');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [lastSaved, setLastSaved] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const isDirty = useRef(false);

  const [settings, setSettings] = useState<UserSettings>({
    full_name: '',
    email: '',
    study_goal: '',
    daily_hours: 4,
    difficulty_level: 'Intermediate',
    theme: 'dark',
    notifications_enabled: true
  });

  const fetchSettings = useCallback(async (force = false) => {
    if (isDirty.current && !force) return;
    try {
      const res = await fetch('/api/settings');
      if (!res.ok) throw new Error(`Server returned HTTP ${res.status}`);
      const result = await res.json();
      if (result.success && result.data && result.data.settings) {
        const s = result.data.settings;
        const p = s.preferences || {};
        setSettings({
          full_name: s.user_name || 'Alex Student',
          email: p.email || '',
          study_goal: p.study_goal || '',
          daily_hours: p.daily_hours || 4,
          difficulty_level: p.difficulty_level || 'Intermediate',
          theme: s.theme || 'dark',
          notifications_enabled: p.notifications_enabled !== undefined ? p.notifications_enabled : true
        });
      }
    } catch (e) {
      console.error('[Settings Dashboard]: fetchSettings error', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    setHasMounted(true);
    fetchSettings();
    const supabase = getSupabasePublic();
    const settingsChannel = supabase
      .channel('user_settings_realtime_v3')
      .on('postgres_changes', { event: '*', table: 'user_settings', schema: 'public' }, () => {
        fetchSettings(); 
      })
      .subscribe();
    return () => { supabase.removeChannel(settingsChannel); };
  }, [fetchSettings]);

  const saveSettings = async () => {
    setSaveStatus('saving');
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error(`Server returned HTTP ${res.status}`);
      const result = await res.json();
      if (result.success) {
        isDirty.current = false;
        setSaveStatus('saved');
        setLastSaved(new Date().toLocaleTimeString());
        setTimeout(() => setSaveStatus('idle'), 2500);
      } else {
        throw new Error(result.message || 'Failed to update preferences');
      }
    } catch (e) {
      console.error('[Settings Dashboard]: saveSettings error', e);
      setSaveStatus('error');
    }
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'ai', label: 'AI Settings', icon: Brain },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'account', label: 'Account', icon: Shield },
  ] as const;

  if (!hasMounted) return null; // Hydration defense

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-4 text-gray-400">
          <Loader2 className="w-10 h-10 text-[#00f2fe] animate-spin" />
          <p className="text-sm font-medium">Synchronizing preferences...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-10">
        <div>
          <h1 className="text-4xl font-outfit font-bold tracking-tight text-white">Application Settings</h1>
          <p className="text-gray-400 mt-2 text-sm">
            {lastSaved ? `Changes synced at ${lastSaved}` : 'Personalize your IntelliTwin experience.'}
          </p>
        </div>
        <button
          onClick={saveSettings}
          disabled={saveStatus === 'saving'}
          className={`flex items-center gap-2 px-8 py-3 rounded-xl font-bold text-sm transition-all shadow-lg active:scale-95 ${
            saveStatus === 'saved' ? 'bg-emerald-500 text-white' : 
            saveStatus === 'error' ? 'bg-red-500 text-white' : 
            'bg-gradient-to-r from-[#00f2fe] to-[#4facfe] text-white hover:scale-105 hover:shadow-[#00f2fe]/20'
          }`}
        >
          {saveStatus === 'saving' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Synced!' : 'Save Preferences'}
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        <div className="md:w-64 flex-shrink-0">
          <div className="glass-panel rounded-3xl p-2 space-y-1 sticky top-24 bg-white/5 border border-white/5">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-4 rounded-2xl text-sm font-semibold transition-all text-left ${
                    isActive ? 'bg-[#00f2fe]/10 text-[#00f2fe] border border-[#00f2fe]/20 shadow-sm' : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                  {isActive && <ChevronRight className="w-3.5 h-3.5 ml-auto" />}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
          {activeTab === 'profile' && (
            <Section icon={User} title="Personal Profile" accent="bg-[#00f2fe]/10 text-[#00f2fe]">
              <div className="grid md:grid-cols-2 gap-6">
                {[
                  { label: 'Display Name', key: 'full_name', type: 'text', placeholder: 'Enter your name' },
                  { label: 'E-mail Address', key: 'email', type: 'email', placeholder: 'Enter your email' },
                ].map((f) => (
                  <div key={f.key}>
                    <label className="text-xs font-black uppercase tracking-widest text-gray-500 block mb-3">{f.label}</label>
                    <input
                      type={f.type}
                      value={(settings as any)[f.key] || ''}
                      placeholder={f.placeholder}
                      onChange={(e) => { isDirty.current = true; setSettings((p) => ({ ...p, [f.key]: e.target.value })); }}
                      className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-white text-sm focus:outline-none focus:border-[#00f2fe] transition-all hover:bg-black/50"
                    />
                  </div>
                ))}
              </div>
              <div>
                <label className="text-xs font-black uppercase tracking-widest text-gray-500 block mb-3">Core Study Goal</label>
                <input
                  type="text"
                  value={settings.study_goal || ''}
                  onChange={(e) => { isDirty.current = true; setSettings((p) => ({ ...p, study_goal: e.target.value })); }}
                  className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-white text-sm focus:outline-none focus:border-[#00f2fe] transition-all hover:bg-black/50"
                  placeholder="e.g. Master Artificial Intelligence Fundamentals"
                />
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="text-xs font-black uppercase tracking-widest text-gray-500 block mb-3">Daily Learning Velocity (Hours)</label>
                  <div className="flex items-center gap-4 bg-black/20 p-4 rounded-2xl border border-white/5">
                    <input
                      type="range" min={1} max={16} value={settings.daily_hours}
                      onChange={(e) => { isDirty.current = true; setSettings((p) => ({ ...p, daily_hours: +e.target.value })); }}
                      className="flex-1 accent-[#00f2fe] cursor-pointer"
                    />
                    <span className="text-[#00f2fe] font-bold text-lg min-w-[3ch]">{settings.daily_hours}h</span>
                  </div>
                </div>
              </div>
            </Section>
          )}

          {activeTab === 'notifications' && (
            <Section icon={Bell} title="Alert Hub" accent="bg-orange-500/10 text-orange-400">
              <SettingRow label="Global Notifications" desc="Enable all alerts for analysis completion and study reminders.">
                 <Toggle on={settings.notifications_enabled} onChange={(v) => { isDirty.current = true; setSettings(s => ({ ...s, notifications_enabled: v })); }} />
              </SettingRow>
            </Section>
          )}

          {activeTab === 'ai' && (
            <Section icon={Brain} title="AI Behavior" accent="bg-purple-500/10 text-purple-400">
              <SettingRow label="Content Complexity" desc="How detailed and advanced should the AI analysis be?">
                <select
                  value={settings.difficulty_level}
                  onChange={(e) => { isDirty.current = true; setSettings((a) => ({ ...a, difficulty_level: e.target.value })); }}
                  className="bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-purple-400 cursor-pointer hover:bg-black/50 transition-all shadow-inner"
                >
                  {['Beginner', 'Intermediate', 'Advanced', 'Expert'].map((v) => <option key={v} value={v} className="bg-neutral-900">{v}</option>)}
                </select>
              </SettingRow>
            </Section>
          )}

          {activeTab === 'appearance' && (
            <Section icon={Palette} title="UI Aesthetics" accent="bg-emerald-500/10 text-emerald-400">
              <SettingRow label="Interface Theme" desc="Personalize the visual density and color palette.">
                <select
                  value={settings.theme}
                  onChange={(e) => { isDirty.current = true; setSettings((a) => ({ ...a, theme: e.target.value })); }}
                  className="bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-400 cursor-pointer hover:bg-black/50 transition-all shadow-inner"
                >
                  {['dark', 'light'].map((v) => <option key={v} value={v} className="bg-neutral-900">{v.charAt(0).toUpperCase() + v.slice(1)} Mode</option>)}
                </select>
              </SettingRow>
            </Section>
          )}

          {activeTab === 'account' && (
            <Section icon={Shield} title="Data Privacy" accent="bg-blue-500/10 text-blue-400">
              <SettingRow label="Secure Export" desc="Generate a complete archive of your AI study history.">
                <button onClick={() => alert("Archive generation started.")} className="px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm font-semibold text-white hover:bg-white/10 transition-all active:scale-95">Download PDF/JSON</button>
              </SettingRow>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}
