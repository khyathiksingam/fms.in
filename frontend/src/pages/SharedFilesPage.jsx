import React, { useState, useEffect } from 'react';
import { Share2, Users, Building2, Eye, Download, Info } from 'lucide-react';
import { api, getToken } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { formatBytes, formatDate, formatRelativeTime } from '../utils/formatters';
import { getFileIcon } from '../components/files/FileCard';
import FilePreviewModal from '../components/files/FilePreviewModal';
import FileDetailsDrawer from '../components/files/FileDetailsDrawer';
import EmptyState from '../components/common/EmptyState';

export default function SharedFilesPage() {
  const { user } = useAuth();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPreviewFile, setSelectedPreviewFile] = useState(null);
  const [selectedDetailsFile, setSelectedDetailsFile] = useState(null);

  useEffect(() => {
    loadSharedFiles();
  }, []);

  const loadSharedFiles = async () => {
    setLoading(true);
    try {
      const data = await api.get('/shared-with-me');
      setFiles(data.files || []);
    } catch (err) {
      console.warn('Failed to load shared files:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = (file) => {
    const token = getToken();
    window.open(`/api/files/${file.id}/download?token=${token || ''}`, '_blank');
  };

  return (
    <div className="space-y-5 text-left">
      <div className="border-b border-slate-200 pb-3 dark:border-slate-800">
        <h2 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Share2 className="h-5 w-5 text-brand-600" />
          Shared With Me
        </h2>
        <p className="text-xs text-slate-400">
          Documents shared directly with you or shared across your department.
        </p>
      </div>

      {loading ? (
        <div className="py-20 text-center text-xs text-slate-400 animate-pulse">
          Loading shared files...
        </div>
      ) : files.length === 0 ? (
        <EmptyState
          type="files"
          title="No shared files yet"
          description="When faculty members or department heads share files with you, they will appear here."
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-850 dark:text-slate-400">
              <tr>
                <th className="py-3.5 pl-4 pr-2">File Name</th>
                <th className="px-3 py-3.5">Shared By</th>
                <th className="px-3 py-3.5">Department</th>
                <th className="px-3 py-3.5">Permission</th>
                <th className="px-3 py-3.5">Size</th>
                <th className="px-3 py-3.5">Date Shared</th>
                <th className="py-3.5 pl-3 pr-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {files.map((file) => (
                <tr key={file.id} className="transition hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                  <td className="py-3 pl-4 pr-2">
                    <div 
                      onClick={() => setSelectedPreviewFile(file)}
                      className="flex cursor-pointer items-center gap-2.5 max-w-sm truncate"
                    >
                      {getFileIcon(file.file_type, "h-5 w-5")}
                      <span className="font-semibold text-slate-800 hover:text-brand-600 dark:text-slate-200 dark:hover:text-brand-400 truncate">
                        {file.name}
                      </span>
                    </div>
                  </td>

                  <td className="px-3 py-3 text-slate-600 dark:text-slate-400">
                    {file.shared_by_name || file.owner_name}
                  </td>

                  <td className="px-3 py-3">
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      {file.department_code || file.department_name || 'General'}
                    </span>
                  </td>

                  <td className="px-3 py-3">
                    <span className="inline-block rounded-md bg-brand-100 px-2 py-0.5 text-[10px] font-bold text-brand-700 dark:bg-brand-950 dark:text-brand-300 capitalize">
                      {file.shared_permission === 'view_download' ? 'View & Download' : file.shared_permission}
                    </span>
                  </td>

                  <td className="px-3 py-3 text-slate-500">
                    {formatBytes(file.size)}
                  </td>

                  <td className="px-3 py-3 text-slate-500">
                    {formatRelativeTime(file.shared_at || file.created_at)}
                  </td>

                  <td className="py-3 pl-3 pr-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setSelectedPreviewFile(file)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                        title="Preview"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDownload(file)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                        title="Download"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setSelectedDetailsFile(file)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                        title="Details"
                      >
                        <Info className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <FilePreviewModal
        isOpen={Boolean(selectedPreviewFile)}
        file={selectedPreviewFile}
        onClose={() => setSelectedPreviewFile(null)}
        onDownload={handleDownload}
      />

      <FileDetailsDrawer
        isOpen={Boolean(selectedDetailsFile)}
        file={selectedDetailsFile}
        onClose={() => setSelectedDetailsFile(null)}
      />
    </div>
  );
}
