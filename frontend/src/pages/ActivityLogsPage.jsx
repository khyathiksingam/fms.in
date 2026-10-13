import React, { useState, useEffect } from 'react';
import { Activity, Search, Filter, Calendar, User, Building2, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { formatDate, formatRelativeTime } from '../utils/formatters';

export default function ActivityLogsPage() {
  const { user, isAdmin, isHOD } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    loadLogs();
  }, [actionFilter, currentPage]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await api.get('/activity', {
        action: actionFilter,
        search: searchQuery,
        page: currentPage,
        limit: 30
      });
      setLogs(data.logs || []);
      if (data.pagination) {
        setTotalPages(data.pagination.totalPages || 1);
      }
    } catch (err) {
      console.warn('Failed to load activity logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    loadLogs();
  };

  return (
    <div className="space-y-5 text-left">
      <div className="border-b border-slate-200 pb-3 dark:border-slate-800">
        <h2 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Activity className="h-5 w-5 text-purple-600" />
          System Activity & Audit Trail
        </h2>
        <p className="text-xs text-slate-400">
          Track file uploads, downloads, sharing events, permission changes, and user management events.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2.5">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search activity by action or user..."
            className="w-full rounded-xl border border-slate-200 bg-white py-1.5 pl-9 pr-3 text-xs text-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </form>

        <select
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setCurrentPage(1); }}
          className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
        >
          <option value="">All Actions</option>
          <option value="File Uploaded">File Uploaded</option>
          <option value="File Downloaded">File Downloaded</option>
          <option value="File Previewed">File Previewed</option>
          <option value="Faculty Login">Faculty Login</option>
          <option value="Faculty Logout">Faculty Logout</option>
          <option value="Faculty Session Expired">Faculty Session Expired</option>
          <option value="Syllabus Updated">Syllabus Updated</option>
          <option value="Syllabus Published">Syllabus Published</option>
          <option value="Syllabus Unpublished">Syllabus Unpublished</option>
          <option value="File Shared">File Shared</option>
          <option value="File Moved to Trash">File Moved to Trash</option>
          <option value="File Restored">File Restored</option>
          <option value="Folder Created">Folder Created</option>
          <option value="User Login">User Login</option>
          <option value="User Created">User Created</option>
        </select>
      </div>

      {/* Logs Table */}
      {loading ? (
        <div className="py-20 text-center text-xs text-slate-400 animate-pulse">
          Loading audit trail...
        </div>
      ) : logs.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center text-xs text-slate-400 dark:border-slate-800 dark:bg-slate-900">
          No activity logs recorded for this query.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-850 dark:text-slate-400">
              <tr>
                <th className="py-3.5 pl-4 pr-2">Action</th>
                <th className="px-3 py-3.5">User</th>
                <th className="px-3 py-3.5">Department</th>
                <th className="px-3 py-3.5">Target Item / Details</th>
                <th className="py-3.5 pl-3 pr-4 text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {logs.map((log) => (
                <tr key={log.id} className="transition hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                  <td className="py-3 pl-4 pr-2">
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {log.action}
                    </span>
                  </td>

                  <td className="px-3 py-3 text-slate-700 dark:text-slate-300">
                    <span className="font-medium">{log.user_name || 'System'}</span>
                    {log.username && (
                      <span className="text-[10px] text-slate-400 block">@{log.username}</span>
                    )}
                  </td>

                  <td className="px-3 py-3">
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      {log.department_code || log.department_name || '—'}
                    </span>
                  </td>

                  <td className="px-3 py-3 text-slate-500 max-w-xs">
                    {log.file_name ? (
                      <span className="font-medium text-slate-700 dark:text-slate-300">{log.file_name}</span>
                    ) : log.folder_name ? (
                      <span>Folder: {log.folder_name}</span>
                    ) : (
                      <span className="font-mono text-[11px]">
                        {JSON.stringify(log.metadata || {})}
                      </span>
                    )}
                    {log.session_id && (
                      <span className="mt-1 block text-[10px] text-slate-400">
                        {log.session_duration_seconds !== null && log.session_duration_seconds !== undefined
                          ? `Session duration: ${formatSessionDuration(log.session_duration_seconds)}`
                          : 'No session end recorded'}
                        {log.session_logout_at && ` · Signed out ${formatDate(log.session_logout_at)}`}
                        {log.session_expired_at && ` · Expired ${formatDate(log.session_expired_at)}`}
                        {!log.session_logout_at && !log.session_expired_at && log.session_last_seen_at &&
                          ` · Last seen ${formatRelativeTime(log.session_last_seen_at)}`}
                      </span>
                    )}
                  </td>

                  <td className="py-3 pl-3 pr-4 text-right text-slate-500 whitespace-nowrap">
                    {formatDate(log.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs dark:border-slate-800">
          <span className="text-slate-400">Page {currentPage} of {totalPages}</span>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="rounded-lg border border-slate-200 px-3 py-1 text-slate-700 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="rounded-lg border border-slate-200 px-3 py-1 text-slate-700 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function formatSessionDuration(value) {
  const seconds = Math.max(0, Number(value) || 0);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  if (hours) return `${hours}h ${minutes}m`;
  if (minutes) return `${minutes}m ${remainingSeconds}s`;
  return `${remainingSeconds}s`;
}
