import React, { useState, useEffect } from 'react';
import { 
  HardDrive, PieChart, BarChart2, Files, Building2, 
  TrendingUp, Download, Shield, Eye
} from 'lucide-react';
import { api, getToken } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { formatBytes, formatDate } from '../utils/formatters';
import { getFileIcon } from '../components/files/FileCard';
import FilePreviewModal from '../components/files/FilePreviewModal';

export default function StoragePage() {
  const { user, isAdmin, isHOD } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedPreviewFile, setSelectedPreviewFile] = useState(null);

  useEffect(() => {
    loadStorageAnalytics();
  }, []);

  const loadStorageAnalytics = async () => {
    setLoading(true);
    try {
      const res = await api.get('/analytics/storage');
      setData(res);
    } catch (err) {
      console.warn('Storage analytics error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = (file) => {
    const token = getToken();
    window.open(`/api/files/${file.id}/download?token=${token || ''}`, '_blank');
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-xs text-slate-400 animate-pulse">
        Calculating storage analytics...
      </div>
    );
  }

  const usedBytes = data?.totalStorageBytes || 0;
  const quotaBytes = data?.storageQuotaBytes || (20 * 1024 * 1024 * 1024);
  const percentage = data?.usedPercentage || 0;
  const availableBytes = data?.availableStorageBytes || 0;
  const totalFiles = data?.totalFiles || 0;
  const byDept = data?.byDepartment || [];
  const byType = data?.byType || [];
  const largestFiles = data?.largestFiles || [];

  return (
    <div className="space-y-6 text-left">
      {/* Header */}
      <div className="border-b border-slate-200 pb-3 dark:border-slate-800">
        <h2 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <HardDrive className="h-5 w-5 text-brand-600" />
          Storage Analytics & Quota Usage
        </h2>
        <p className="text-xs text-slate-400">
          Monitor storage allocation across departments, file types, and top largest documents.
        </p>
      </div>

      {/* Main Storage Progress Gauge Card */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Total Storage Capacity
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-slate-900 dark:text-slate-100">
                {formatBytes(usedBytes)}
              </span>
              <span className="text-sm font-semibold text-slate-400">
                / {formatBytes(quotaBytes)} Used ({percentage}%)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <div className="rounded-2xl bg-brand-50 p-3 text-center dark:bg-brand-950/60">
              <span className="text-[10px] text-brand-600 dark:text-brand-400 block font-semibold">Available Free</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{formatBytes(availableBytes)}</span>
            </div>
            <div className="rounded-2xl bg-purple-50 p-3 text-center dark:bg-purple-950/60">
              <span className="text-[10px] text-purple-600 dark:text-purple-400 block font-semibold">Total Documents</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{totalFiles}</span>
            </div>
          </div>
        </div>

        {/* Visual Progress Bar */}
        <div className="mt-6">
          <div className="h-4 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800 p-0.5">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                percentage > 90
                  ? 'bg-rose-500'
                  : percentage > 70
                  ? 'bg-amber-500'
                  : 'bg-gradient-to-r from-brand-500 to-indigo-600'
              }`}
              style={{ width: `${Math.max(percentage, 2)}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between text-[11px] text-slate-400">
            <span>0 GB</span>
            <span>10 GB (50%)</span>
            <span>20 GB (Quota Limit)</span>
          </div>
        </div>
      </div>

      {/* Two Column Grid: Storage by Department & Storage by File Type */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Storage by Department */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
            <Building2 className="h-4 w-4 text-brand-600" />
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
              Storage Usage by Department
            </h3>
          </div>

          <div className="mt-4 space-y-3.5">
            {byDept.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No department storage data available.</p>
            ) : (
              byDept.map((dept) => {
                const deptPercent = usedBytes > 0 ? Math.round((dept.storage_bytes / usedBytes) * 100) : 0;
                return (
                  <div key={dept.id} className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {dept.name} ({dept.code})
                      </span>
                      <span className="text-slate-500">
                        {formatBytes(dept.storage_bytes)} ({deptPercent}%)
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className="h-full rounded-full bg-brand-600"
                        style={{ width: `${Math.max(deptPercent, 1)}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Storage by File Category */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
            <PieChart className="h-4 w-4 text-purple-600" />
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
              Storage Breakdown by File Type
            </h3>
          </div>

          <div className="mt-4 space-y-3.5">
            {byType.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No file category data available.</p>
            ) : (
              byType.map((item) => {
                const typePercent = usedBytes > 0 ? Math.round((item.storage_bytes / usedBytes) * 100) : 0;
                return (
                  <div key={item.file_type} className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-800 dark:text-slate-200 uppercase">
                        {item.file_type} ({item.count} files)
                      </span>
                      <span className="text-slate-500">
                        {formatBytes(item.storage_bytes)} ({typePercent}%)
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className="h-full rounded-full bg-purple-600"
                        style={{ width: `${Math.max(typePercent, 1)}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Top 10 Largest Files */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-600" />
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
              Largest Documents in Repository
            </h3>
          </div>
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 dark:border-slate-800">
                <th className="py-2.5">File Name</th>
                <th className="py-2.5">Owner</th>
                <th className="py-2.5">Department</th>
                <th className="py-2.5">Size</th>
                <th className="py-2.5">Uploaded</th>
                <th className="py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {largestFiles.map((file) => (
                <tr key={file.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="py-2.5">
                    <div 
                      onClick={() => setSelectedPreviewFile(file)}
                      className="flex cursor-pointer items-center gap-2 font-semibold text-slate-800 dark:text-slate-200 hover:text-brand-600"
                    >
                      {getFileIcon(file.file_type, "h-4 w-4")}
                      <span className="truncate max-w-xs">{file.name}</span>
                    </div>
                  </td>
                  <td className="py-2.5 text-slate-600 dark:text-slate-400">{file.owner_name}</td>
                  <td className="py-2.5 text-slate-600 dark:text-slate-400">{file.department_name || 'General'}</td>
                  <td className="py-2.5 font-bold text-slate-800 dark:text-slate-200">{formatBytes(file.size)}</td>
                  <td className="py-2.5 text-slate-400">{formatDate(file.created_at)}</td>
                  <td className="py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setSelectedPreviewFile(file)}
                        className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                        title="Preview"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDownload(file)}
                        className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                        title="Download"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <FilePreviewModal
        isOpen={Boolean(selectedPreviewFile)}
        file={selectedPreviewFile}
        onClose={() => setSelectedPreviewFile(null)}
        onDownload={handleDownload}
      />
    </div>
  );
}
