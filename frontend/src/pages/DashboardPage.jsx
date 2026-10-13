import React, { useState, useEffect } from 'react';
import { 
  Files, Folder, Users, Building2, HardDrive, Star, Clock, 
  Upload, ArrowRight, Shield, Activity, FileText, CheckCircle2, TrendingUp, ExternalLink
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { api, getToken } from '../utils/api';
import { formatBytes, formatDate, formatRelativeTime } from '../utils/formatters';
import { getFileIcon } from '../components/files/FileCard';

export default function DashboardPage({ onNavigate, onUploadClick, onPreviewFile }) {
  const { user, isAdmin, isHOD, isFaculty } = useAuth();
  const { isDark } = useTheme();
  const [data, setData] = useState(null);
  const [fallbackFiles, setFallbackFiles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/analytics/dashboard');
      setData(res);

      if (!res?.recentFiles || res.recentFiles.length === 0) {
        const filesRes = await api.get('/files', { limit: 8, sort: 'newest' });
        setFallbackFiles(filesRes?.files || []);
      }
    } catch (err) {
      console.warn('Dashboard fetch error:', err);
      try {
        const filesRes = await api.get('/files', { limit: 8, sort: 'newest' });
        setFallbackFiles(filesRes?.files || []);
      } catch (e) {}
    } finally {
      setLoading(false);
    }
  };

  const stats = data?.stats || {};
  const recentFiles = (data?.recentFiles && data.recentFiles.length > 0) 
    ? data.recentFiles 
    : (data?.recentUploads && data.recentUploads.length > 0)
    ? data.recentUploads
    : fallbackFiles;
  const recentActivity = data?.recentActivity || data?.deptActivity || [];

  return (
    <div className="space-y-6 text-left">
      {/* Welcome Hero Banner - Adaptive Dark/Light Mode */}
      <div className={`relative overflow-hidden rounded-3xl p-6 sm:p-8 text-white transition-all duration-300 ${
        isDark 
          ? 'bg-slate-900 border border-slate-800 shadow-2xl shadow-black/60 ring-1 ring-white/5' 
          : 'bg-linear-to-r from-blue-700 via-indigo-600 to-blue-600 shadow-xl shadow-indigo-500/20'
      }`}>
        <div className="relative z-10">
          <div className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1 text-xs font-bold border transition ${
            isDark 
              ? 'bg-slate-800/90 text-indigo-300 border-slate-700' 
              : 'bg-white/20 text-white border-white/20 backdrop-blur-md'
          }`}>
            <Shield className={`h-3.5 w-3.5 ${isDark ? 'text-indigo-400' : 'text-white'}`} />
            <span className="uppercase tracking-wider">{user?.role_name || 'FACULTY'} PORTAL</span>
            {user?.department_name && <span>• {user.department_name}</span>}
          </div>

          <h2 className="mt-3 text-2xl sm:text-3xl font-black tracking-tight text-white drop-shadow-sm">
            Welcome, {user?.full_name}
          </h2>

          <p className={`mt-1 max-w-xl text-xs sm:text-sm leading-relaxed font-normal ${
            isDark ? 'text-slate-300' : 'text-blue-100'
          }`}>
            {isAdmin 
              ? 'Complete administrative authority over college documents, departments, faculty accounts, and storage analytics.'
              : isHOD 
              ? `Manage academic files, folders, and faculty repository for the ${user?.department_name || 'department'}.`
              : 'Upload, organize, search inside scanned papers with OCR, and manage academic documents.'}
          </p>

          {/* Action Buttons */}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              onClick={onUploadClick}
              className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-extrabold shadow-lg transition active:scale-95 cursor-pointer ${
                isDark
                  ? 'bg-linear-to-r from-blue-600 via-indigo-600 to-blue-600 text-white border border-indigo-500/40 shadow-indigo-600/25 hover:from-blue-500 hover:to-indigo-500'
                  : 'bg-white text-indigo-950 border border-white hover:bg-blue-50'
              }`}
            >
              <Upload className={`h-4 w-4 stroke-[2.5] ${isDark ? 'text-white' : 'text-indigo-700'}`} />
              <span className="font-bold">+ Upload File</span>
            </button>
            <button
              onClick={() => onNavigate('/files')}
              className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold transition active:scale-95 cursor-pointer border ${
                isDark
                  ? 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-750 hover:text-white'
                  : 'bg-white/20 text-white border-white/30 hover:bg-white/30 backdrop-blur-md'
              }`}
            >
              <span>Browse Files</span>
              <ArrowRight className="h-3.5 w-3.5 text-white" />
            </button>
          </div>
        </div>

        {/* Decorative background accents */}
        <div className={`absolute -right-12 -top-12 h-64 w-64 rounded-full blur-3xl pointer-events-none ${
          isDark ? 'bg-indigo-600/10' : 'bg-white/10'
        }`} />
        <div className={`absolute right-32 -bottom-16 h-48 w-48 rounded-full blur-2xl pointer-events-none ${
          isDark ? 'bg-blue-600/10' : 'bg-indigo-400/20'
        }`} />
      </div>

      {/* KPI Statistic Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {isAdmin ? (
          <>
            <div className="rounded-2xl border border-slate-200/80 bg-white dark:bg-slate-900 dark:border-slate-800 p-5 shadow-xs transition hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-800">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Faculty</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
                  <Users className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3 text-2xl font-black text-slate-900 dark:text-white">
                {stats.totalFaculty || 0}
              </div>
              <p className="mt-1 text-[11px] font-medium text-slate-400 dark:text-slate-500">Active teaching staff</p>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white dark:bg-slate-900 dark:border-slate-800 p-5 shadow-xs transition hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-800">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Departments</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400">
                  <Building2 className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3 text-2xl font-black text-slate-900 dark:text-white">
                {stats.totalDepartments || 0}
              </div>
              <p className="mt-1 text-[11px] font-medium text-slate-400 dark:text-slate-500">With assigned HODs</p>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white dark:bg-slate-900 dark:border-slate-800 p-5 shadow-xs transition hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-800">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">College Files</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
                  <Files className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3 text-2xl font-black text-slate-900 dark:text-white">
                {stats.totalFiles || 0}
              </div>
              <p className="mt-1 text-[11px] font-medium text-slate-400 dark:text-slate-500">Total documents stored</p>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white dark:bg-slate-900 dark:border-slate-800 p-5 shadow-xs transition hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-800">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Storage Used</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
                  <HardDrive className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3 text-2xl font-black text-slate-900 dark:text-white">
                {formatBytes(stats.totalStorageBytes || 0)}
              </div>
              <p className="mt-1 text-[11px] font-medium text-slate-400 dark:text-slate-500">of 100 GB allocated</p>
            </div>
          </>
        ) : isHOD ? (
          <>
            <div className="rounded-2xl border border-slate-200/80 bg-white dark:bg-slate-900 dark:border-slate-800 p-5 shadow-xs transition hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-800">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Dept Faculty</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
                  <Users className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3 text-2xl font-black text-slate-900 dark:text-white">
                {stats.departmentFaculty || 0}
              </div>
              <p className="mt-1 text-[11px] font-medium text-slate-400 dark:text-slate-500">Members in {user?.department_code}</p>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white dark:bg-slate-900 dark:border-slate-800 p-5 shadow-xs transition hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-800">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Dept Documents</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
                  <Files className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3 text-2xl font-black text-slate-900 dark:text-white">
                {stats.departmentFiles || 0}
              </div>
              <p className="mt-1 text-[11px] font-medium text-slate-400 dark:text-slate-500">Academic & exam files</p>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white dark:bg-slate-900 dark:border-slate-800 p-5 shadow-xs transition hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-800">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Dept Storage</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
                  <HardDrive className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3 text-2xl font-black text-slate-900 dark:text-white">
                {formatBytes(stats.departmentStorageBytes || 0)}
              </div>
              <p className="mt-1 text-[11px] font-medium text-slate-400 dark:text-slate-500">Quota usage</p>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white dark:bg-slate-900 dark:border-slate-800 p-5 shadow-xs transition hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-800">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Shared Files</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400">
                  <Star className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3 text-2xl font-black text-slate-900 dark:text-white">
                {stats.sharedFilesCount || 0}
              </div>
              <p className="mt-1 text-[11px] font-medium text-slate-400 dark:text-slate-500">Accessible files</p>
            </div>
          </>
        ) : (
          <>
            <div className="rounded-2xl border border-slate-200/80 bg-white dark:bg-slate-900 dark:border-slate-800 p-5 shadow-xs transition hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-800">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">My Files</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
                  <Files className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3 text-2xl font-black text-slate-900 dark:text-white">
                {stats.myFilesCount || 0}
              </div>
              <p className="mt-1 text-[11px] font-medium text-slate-400 dark:text-slate-500">Uploaded documents</p>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white dark:bg-slate-900 dark:border-slate-800 p-5 shadow-xs transition hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-800">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">My Storage</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
                  <HardDrive className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3 text-2xl font-black text-slate-900 dark:text-white">
                {formatBytes(stats.storageUsedBytes || 0)}
              </div>
              <p className="mt-1 text-[11px] font-medium text-slate-400 dark:text-slate-500">Total used</p>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white dark:bg-slate-900 dark:border-slate-800 p-5 shadow-xs transition hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-800">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Folders</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
                  <Folder className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3 text-2xl font-black text-slate-900 dark:text-white">
                {stats.myFoldersCount || 0}
              </div>
              <p className="mt-1 text-[11px] font-medium text-slate-400 dark:text-slate-500">Organized categories</p>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white dark:bg-slate-900 dark:border-slate-800 p-5 shadow-xs transition hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-800">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Starred</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-yellow-50 text-yellow-600 dark:bg-yellow-950/60 dark:text-yellow-400">
                  <Star className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3 text-2xl font-black text-slate-900 dark:text-white">
                {stats.starredCount || 0}
              </div>
              <p className="mt-1 text-[11px] font-medium text-slate-400 dark:text-slate-500">Priority documents</p>
            </div>
          </>
        )}
      </div>

      {/* Two Column Layout: Recent Files & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Files (2 cols) */}
        <div className="lg:col-span-2 rounded-3xl border border-slate-200/80 bg-white dark:bg-slate-900 dark:border-slate-800 p-6 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                Recent Documents
              </h3>
            </div>
            <button
              onClick={() => onNavigate('/files')}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 transition cursor-pointer"
            >
              View all →
            </button>
          </div>

          <div className="mt-4 space-y-2">
            {recentFiles.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400 dark:text-slate-500">
                No recent files found. Upload a file to get started.
              </div>
            ) : (
              recentFiles.slice(0, 6).map((file) => (
                <div
                  key={file.id}
                  onClick={() => onPreviewFile && onPreviewFile(file)}
                  className="flex cursor-pointer items-center justify-between rounded-xl p-2.5 transition hover:bg-slate-50 dark:hover:bg-slate-800/70 border border-transparent hover:border-slate-100 dark:hover:border-slate-800"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
                      {getFileIcon(file.file_type, "h-5 w-5")}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-800 dark:text-slate-200 truncate">
                          {file.name}
                        </span>
                        {file.drive_link && (
                          <a
                            href={file.drive_link}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-1.5 py-0.5 text-[9px] font-bold text-blue-700 hover:bg-blue-100 dark:bg-blue-950/70 dark:text-blue-300"
                            title="Open in Google Docs / Drive"
                          >
                            <ExternalLink className="h-2.5 w-2.5" />
                            <span>Drive</span>
                          </a>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-2 mt-0.5">
                        <span>{file.owner_name || user?.full_name || 'Mrs. P. Devika'}</span>
                        <span>•</span>
                        <span>{formatBytes(file.size)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-[11px] font-medium text-slate-400 dark:text-slate-500 whitespace-nowrap ml-2">
                    {formatRelativeTime(file.created_at)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Live Activity Stream (1 col) */}
        <div className="rounded-3xl border border-slate-200/80 bg-white dark:bg-slate-900 dark:border-slate-800 p-6 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                Activity Stream
              </h3>
            </div>
            {isAdmin && (
              <button
                onClick={() => onNavigate('/activity')}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 transition cursor-pointer"
              >
                Full Audit →
              </button>
            )}
          </div>

          <div className="mt-4 space-y-3">
            {recentActivity.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400 dark:text-slate-500">
                No recent activity logged.
              </div>
            ) : (
              recentActivity.slice(0, 6).map((log) => (
                <div key={log.id} className="flex items-start gap-2.5 text-xs text-left">
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    <CheckCircle2 className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-700 dark:text-slate-300">
                      <span className="font-bold text-slate-900 dark:text-white">{log.user_name || 'User'}</span> {log.action.toLowerCase()}
                      {log.metadata?.session_duration && (
                        <span className="ml-1 font-semibold text-indigo-600 dark:text-indigo-400">· session {log.metadata.session_duration}</span>
                      )}
                    </p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500">{formatRelativeTime(log.created_at)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
