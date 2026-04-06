import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    const { data: files, error } = await supabase
      .from('files')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const allFiles = files || [];
    const totalFiles = allFiles.length;

    let extraStorageMB = 0;
    allFiles.forEach((f: any) => {
      if (f.size) {
        const match = String(f.size).match(/(\d+(\.\d+)?)/);
        if (match) extraStorageMB += parseFloat(match[0]);
      }
    });
    const totalStorageGB = (extraStorageMB / 1024).toFixed(2) + ' GB';

    const todayStr = new Date().toISOString().split('T')[0];
    const filesToday = allFiles.filter((f: any) =>
      f.created_at && new Date(f.created_at).toISOString().startsWith(todayStr)
    ).length;

    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const recentUploads = allFiles.filter((f: any) =>
      f.created_at && new Date(f.created_at) > twoHoursAgo
    ).length;

    return Response.json({
      success: true,
      data: {
        files: allFiles.map((f: any) => ({
          ...f,
          date: f.created_at ? new Date(f.created_at).toLocaleString() : (f.date || 'Unknown'),
          analysis: f.analysis_json ?? null,
        })),
        stats: { totalFiles, storageUsed: totalStorageGB, filesToday, recentUploads },
        lastUpdated: new Date().toLocaleTimeString(),
      }
    });
  } catch (error: any) {
    console.error('Upload Live Error:', error.message);
    return Response.json({ success: false, error: error.message,
      files: [],
      stats: { totalFiles: 0, storageUsed: '0.00 GB', filesToday: 0, recentUploads: 0 },
      lastUpdated: new Date().toLocaleTimeString(),
    }, { status: 500 });
  }
}
