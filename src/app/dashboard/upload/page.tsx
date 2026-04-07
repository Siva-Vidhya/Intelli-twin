"use client";

import { useState, useEffect, useMemo } from 'react';
import { 
  UploadCloud, File, FileText, CheckCircle2, X, Brain, 
  Search, Trash2, Clock, HardDrive, FilePlus, 
  Loader2, AlertCircle, Calendar, Zap, RefreshCw,
  RotateCcw
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface UploadedFile {
  id: string;
  file_name: string;
  file_type: string;
  file_url: string;
  summary?: string;
  created_at: string;
  status: 'Completed' | 'Processing' | 'AI Analyzing' | 'Analyzing' | 'Failed' | 'Uploading';
  progress?: number;
  size?: string;
}

interface Stats {
  totalFiles: number;
  storageUsed: string;
  filesToday: number;
  recentUploads: number;
}

export default function UploadPage() {
  const [hasMounted, setHasMounted] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("All");

  const fetchMetadata = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/uploads');
      if (!res.ok) throw new Error(`Server returned HTTP ${res.status}`);
      const data = await res.json();
      
      if (data.success && data.data) {
        const { uploads } = data.data;
        setFiles(prev => {
          const uploading = prev.filter(f => f.status !== 'Completed' && f.status !== 'Failed');
          const serverFiles = uploads.map((sf: any) => {
             const isFailed = sf.summary?.includes('Analysis failed') || sf.summary?.includes('Error');
             return {
               ...sf,
               status: isFailed ? 'Failed' : (sf.summary ? 'Completed' : 'Processing'),
               progress: sf.summary ? 100 : 0,
               size: sf.file_type === 'pdf' ? '1.2 MB' : '0.4 MB',
             };
          }).filter((sf: UploadedFile) => !uploading.find(uf => uf.id === sf.id));
          return [...uploading, ...serverFiles];
        });
        
        const total = uploads.length;
        setStats({
          totalFiles: total,
          storageUsed: (total * 0.8).toFixed(2) + " MB",
          filesToday: uploads.filter((f: any) => {
            const today = new Date().toDateString();
            return new Date(f.created_at).toDateString() === today;
          }).length,
          recentUploads: uploads.filter((f: any) => (Date.now() - new Date(f.created_at).getTime()) < 3600000).length
        });
        setLastSync(new Date().toLocaleTimeString());
      }
    } catch (error) {
      console.error("[Upload Dashboard]: fetchMetadata error", error);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    setHasMounted(true);
    fetchMetadata();
    
    // Subscribe to uploads changes for multi-device sync
    const fileChannel = supabase
      .channel('upload_sync_secure')
      .on('postgres_changes', { event: '*', table: 'uploads', schema: 'public' }, () => {
        fetchMetadata(); 
      })
      .subscribe();
      
    // Auto-delete fundamentally broken uploads
    const clearFailed = async () => {
      // Small delay ensures state is populated
      setTimeout(async () => {
        setFiles(currentFiles => {
          const failed = currentFiles.filter(f => f.status === "Failed");
          failed.forEach(async (file) => {
            await fetch('/api/uploads', {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: file.id })
            }).catch(() => null);
          });
          return currentFiles.filter(f => f.status !== "Failed");
        });
      }, 5000); // Clean silently
    }
    clearFailed();
      
    return () => { supabase.removeChannel(fileChannel); };
  }, []);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleAnalyze = async (fileUrl: string, dbId: string, tempId?: string, fileName?: string) => {
    const targetId = tempId || dbId;
    setFiles(prev => prev.map(f => f.id === targetId ? { ...f, status: 'AI Analyzing', progress: 80 } : f));
    
    try {
      console.log(`[Upload Dashboard] Triggering background analysis for ID: ${dbId}`);
      const aiRes = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          fileId: dbId,
          fileUrl,
          fileName: fileName || dbId
        })
      });

      if (!aiRes.ok) throw new Error(`Analyze trigger returned HTTP ${aiRes.status}`);
      const aiResult = await aiRes.json().catch(() => ({ success: false }));

      if (!aiResult.success) {
        throw new Error(aiResult.error || 'Analysis trigger failed');
      }

      // Analysis is now running in the background.
      // Mark as 'Analyzing' — Planner page will update via polling.
      setFiles(prev => prev.map(f => f.id === targetId 
        ? { ...f, status: 'Analyzing' as const, progress: 90, summary: 'AI is analyzing your document...' } 
        : f
      ));
      fetchMetadata();
    } catch (err: any) {
      console.error("[Upload Dashboard]: Analysis trigger error:", err);
      setFiles(prev => prev.map(f => f.id === targetId 
        ? { ...f, status: 'Failed', progress: 0, summary: `Analysis Error: ${err.message}` } 
        : f
      ));
    }
  };

  const simulateUpload = async (file: File) => {
    const tempId = "ui-" + Math.random().toString(36).substring(2, 11);
    const ext = file.name.split('.').pop()?.toLowerCase();
    
    const newFile: UploadedFile = {
      id: tempId,
      file_name: file.name,
      file_type: ext || 'file',
      file_url: '',
      created_at: new Date().toISOString(),
      status: 'Uploading',
      progress: 30,
      size: (file.size / 1024 / 1024).toFixed(2) + ' MB'
    };

    // Clear duplicate uploads preemptively
    setFiles(prev => prev.filter(f => f.file_name !== file.name));
    setFiles(prev => [newFile, ...prev]);

    // Add Upload Timeout Protection
    const timeout = setTimeout(() => {
      setFiles(prev => 
        prev.map(f =>
          f.id === tempId
            ? { ...f, status: "Failed", summary: "Upload Timeout: The pipeline took too long to respond." }
            : f
        )
      );
    }, 20000);

    try {
      // 1. Secure Server-Side Upload (Storage + Metadata in one atomic request)
      console.log(`[Upload Dashboard] Starting Secure Pipeline for: ${file.name}`);
      console.log("Uploading file:", file.name);
      const formData = new FormData();
      formData.append('file', file);

      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadRes.ok) throw new Error(`Server returned HTTP ${uploadRes.status}`);
      const uploadResult = await uploadRes.json();
      if (!uploadResult.success) throw new Error(uploadResult.message || uploadResult.error || 'Server rejected the document stream.');

      // Add Upload Pipeline Safety
      if (!uploadResult?.data?.fileUrl) {
        throw new Error("Upload succeeded but file URL missing");
      }

      // 2. Trigger Stable AI Analysis (non-blocking — background worker handles heavy lifting)
      const { id: dbId, fileUrl, fileName } = uploadResult.data;
      await handleAnalyze(fileUrl, dbId, tempId, fileName);

      clearTimeout(timeout);

    } catch (err: any) {
      console.error("[Upload Pipeline Error]", err);
      setFiles(prev =>
        prev.map(f =>
          f.id === tempId
            ? {
                ...f,
                status: 'Failed',
                progress: 0,
                summary: err.message || "Upload Failed"
              }
            : f
        )
      );
    }
  };

  const handleDeleteFile = async (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
    try {
      const res = await fetch('/api/uploads', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        const result = await res.json();
        if (result.success) fetchMetadata();
      }
    } catch (error) {
      console.error("[Upload Dashboard]: handleDeleteFile error", error);
    }
  };

  const filteredFiles = useMemo(() => {
    return files.filter(f => {
      const matchesSearch = f.file_name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = filterType === "All" || f.file_type.toLowerCase() === filterType.toLowerCase();
      return matchesSearch && matchesType;
    });
  }, [files, searchQuery, filterType]);

  if (!hasMounted) return null;

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl animate-in font-outfit">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-10">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-white drop-shadow-lg">Knowledge Base</h1>
          <p className="text-gray-400 mt-2 font-medium">Powering your IntelliTwin learning schedule with AI Analysis.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={async () => {
              await fetch('/api/uploads/clear', { method: "POST" });
              setFiles([]);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-xl text-sm font-bold text-red-500 hover:bg-red-500/20 transition-all"
          >
            <Trash2 className="w-4 h-4"/> Clear All
          </button>
          <button onClick={() => fetchMetadata()} className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm font-bold text-white hover:bg-white/10 transition-all">
             <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`}/> {isSyncing ? 'Syncing...' : 'Sync Now'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
        {[
          { label: 'Total Files', value: stats?.totalFiles || 0, icon: <File className="w-4 h-4"/>, color: 'border-l-[#00f2fe]' },
          { label: 'AI Summaries', value: files.filter(f => f.summary && !f.status.includes('Failed')).length, icon: <Brain className="w-4 h-4 text-purple-400"/>, color: 'border-l-purple-500' },
          { label: 'Files Today', value: stats?.filesToday || 0, icon: <Zap className="w-4 h-4 text-orange-400"/>, color: 'border-l-orange-500' },
          { label: 'Storage', value: stats?.storageUsed || '0 MB', icon: <HardDrive className="w-4 h-4"/>, color: 'border-l-emerald-500' },
        ].map((s) => (
          <div key={s.label} className={`glass-card p-6 border-l-4 ${s.color} bg-white/5 rounded-2xl`}>
            <div className="flex justify-between items-center mb-3 text-gray-500">
              <span className="text-[10px] uppercase font-black tracking-widest">{s.label}</span>
              {s.icon}
            </div>
            <h3 className="text-3xl font-bold text-white">{s.value}</h3>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <div 
            onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag}
            onDrop={(e) => { e.preventDefault(); setDragActive(false); if (e.dataTransfer.files) Array.from(e.dataTransfer.files).forEach(simulateUpload); }}
            className={`glass-panel border-2 border-dashed rounded-[2.5rem] p-10 flex flex-col items-center justify-center text-center transition-all h-[380px] sticky top-24 bg-white/5 ${dragActive ? 'border-[#00f2fe] bg-[#00f2fe]/5 scale-105' : 'border-white/10'}`}
          >
            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6">
              <UploadCloud className={`w-10 h-10 ${dragActive ? 'text-[#00f2fe] animate-pulse' : 'text-gray-500'}`} />
            </div>
            <h3 className="text-xl font-bold mb-2 text-white">Import Learning Materials</h3>
            <p className="text-gray-500 text-sm mb-8 max-w-[200px]">PDFs, lecture notes, or textbooks.</p>
            <input type="file" multiple className="hidden" id="fileInput" onChange={(e) => { if(e.target.files) Array.from(e.target.files).forEach(simulateUpload); }} />
            <label htmlFor="fileInput" className="px-8 py-3 rounded-full bg-[#00f2fe] hover:bg-[#00f2fe]/80 transition-all font-bold text-sm text-black cursor-pointer shadow-[0_0_20px_rgba(0,242,254,0.3)]">
              Select Files
            </label>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="flex gap-4 mb-6 overflow-x-auto pb-2">
            {["All", "PDF", "Doc"].map(type => (
              <button 
                key={type} onClick={() => setFilterType(type)}
                className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${filterType === type ? 'bg-[#00f2fe] text-black shadow-lg shadow-[#00f2fe]/20' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
              >
                {type}
              </button>
            ))}
          </div>

          {filteredFiles.map((file) => (
            <div key={file.id} className={`glass-card p-6 group transition-all hover:border-[#00f2fe]/40 bg-white/5 rounded-2xl ${file.status === 'Failed' ? 'border-red-500/20 shadow-[0_0_20px_rgba(239,68,68,0.1)]' : 'border-white/10'}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-5">
                  <div className={`p-4 rounded-2xl shrink-0 ${file.status === 'Failed' ? 'bg-red-500/10 text-red-500' : 'bg-white/5 text-gray-500 group-hover:text-[#00f2fe]'}`}>
                    {file.file_type === 'pdf' ? <FileText className="w-6 h-6"/> : <File className="w-6 h-6"/>}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-lg text-white group-hover:text-[#00f2fe] transition-colors">{file.file_name}</h4>
                    <div className="flex items-center gap-3 mt-1 text-[10px] font-black tracking-widest text-gray-500 uppercase">
                      <span>{file.size}</span>
                      <span className="w-1.5 h-1.5 bg-white/10 rounded-full"></span>
                      <span>{new Date(file.created_at).toLocaleDateString()}</span>
                    </div>
                    {file.summary && (
                      <p className={`text-sm mt-3 line-clamp-2 leading-relaxed ${file.status === 'Failed' ? 'text-red-400/80 italic font-medium' : 'text-gray-400'}`}>
                         {file.summary}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {file.status === 'Failed' && (
                    <button 
                      onClick={() => {
                        if (!file.file_url) return;
                        handleAnalyze(file.file_url, file.id);
                      }}
                      className="p-2.5 rounded-xl bg-white/5 text-gray-400 hover:text-[#00f2fe] hover:bg-white/10 transition-all"
                      title="Retry AI Analysis"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  )}
                  {(file.status === 'Completed' || file.status === 'Failed') && (
                    <button onClick={() => handleDeleteFile(file.id)} className="p-2.5 rounded-xl bg-white/5 text-gray-400 hover:text-red-400 hover:bg-white/10 transition-all">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  {file.status === 'Completed' ? <CheckCircle2 className="w-6 h-6 text-emerald-500 drop-shadow-[0_0_8px_rgba(16,185,129,0.3)]" /> : 
                   file.status === 'Failed' ? <AlertCircle className="w-6 h-6 text-red-500" /> :
                   <Loader2 className="w-6 h-6 text-[#00f2fe] animate-spin" />}
                </div>
              </div>
              
              {(file.status !== 'Completed' && file.status !== 'Failed') && (
                <div className="mt-6">
                  <div className="flex justify-between mb-2 text-[10px] font-black tracking-widest text-[#00f2fe] uppercase">
                    <span>{file.status === 'AI Analyzing' ? 'Intelligence Lab Tuning...' : 'Optimizing Knowledge Path...'}</span>
                    <span>{file.progress}%</span>
                  </div>
                  <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden shadow-inner">
                    <div 
                      className="h-full bg-gradient-to-r from-[#00f2fe] to-blue-500 transition-all duration-500 rounded-full" 
                      style={{ width: `${file.progress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}

          {filteredFiles.length === 0 && !isSyncing && (
            <div className="text-center py-24 bg-white/5 rounded-[2rem] border border-white/5">
              <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
                <FilePlus className="w-8 h-8 text-gray-700" />
              </div>
              <h4 className="text-white font-bold text-lg">No documents found</h4>
              <p className="text-gray-500 text-sm mt-2 font-medium">Upload lecture notes to generate a study plan.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
