import React, { useState, useEffect } from 'react';
import { Clock, LayoutGrid, List } from 'lucide-react';
import { api, getToken } from '../utils/api';
import FileCard from '../components/files/FileCard';
import FileTable from '../components/files/FileTable';
import FilePreviewModal from '../components/files/FilePreviewModal';
import FileShareModal from '../components/files/FileShareModal';
import FileDetailsDrawer from '../components/files/FileDetailsDrawer';
import EmptyState from '../components/common/EmptyState';

export default function RecentFilesPage() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('grid');
  const [selectedPreviewFile, setSelectedPreviewFile] = useState(null);
  const [selectedShareFile, setSelectedShareFile] = useState(null);
  const [selectedDetailsFile, setSelectedDetailsFile] = useState(null);

  useEffect(() => {
    loadRecentFiles();
  }, []);

  const loadRecentFiles = async () => {
    setLoading(true);
    try {
      const data = await api.get('/files', { scope: 'recent', sort: 'newest', limit: 40 });
      setFiles(data.files || []);
    } catch (err) {
      console.warn('Failed to load recent files:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = (file) => {
    const token = getToken();
    window.open(`/api/files/${file.id}/download?token=${token || ''}`, '_blank');
  };

  const handleToggleStar = async (file) => {
    try {
      const res = await api.post(`/files/${file.id}/star`);
      setFiles(prev =>
        prev.map(f => (f.id === file.id ? { ...f, is_starred: res.is_starred ? 1 : 0 } : f))
      );
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-5 text-left">
      <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Clock className="h-5 w-5 text-brand-600" />
            Recent Files
          </h2>
          <p className="text-xs text-slate-400">
            Recently uploaded, edited, or modified college files.
          </p>
        </div>

        <div className="flex items-center rounded-xl border border-slate-200 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-800">
          <button
            onClick={() => setViewMode('grid')}
            className={`rounded-lg p-1.5 transition ${
              viewMode === 'grid'
                ? 'bg-slate-100 text-brand-600 dark:bg-slate-700 dark:text-brand-400'
                : 'text-slate-400'
            }`}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`rounded-lg p-1.5 transition ${
              viewMode === 'table'
                ? 'bg-slate-100 text-brand-600 dark:bg-slate-700 dark:text-brand-400'
                : 'text-slate-400'
            }`}
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-xs text-slate-400 animate-pulse">
          Loading recent files...
        </div>
      ) : files.length === 0 ? (
        <EmptyState
          type="files"
          title="No recent files"
          description="Your recently uploaded or modified documents will be shown here."
        />
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
          {files.map(file => (
            <FileCard
              key={file.id}
              file={file}
              onPreview={(f) => setSelectedPreviewFile(f)}
              onDownload={handleDownload}
              onShare={(f) => setSelectedShareFile(f)}
              onToggleStar={handleToggleStar}
              onViewDetails={(f) => setSelectedDetailsFile(f)}
            />
          ))}
        </div>
      ) : (
        <FileTable
          files={files}
          onPreview={(f) => setSelectedPreviewFile(f)}
          onDownload={handleDownload}
          onShare={(f) => setSelectedShareFile(f)}
          onToggleStar={handleToggleStar}
          onViewDetails={(f) => setSelectedDetailsFile(f)}
        />
      )}

      <FilePreviewModal
        isOpen={Boolean(selectedPreviewFile)}
        file={selectedPreviewFile}
        onClose={() => setSelectedPreviewFile(null)}
        onDownload={handleDownload}
      />

      <FileShareModal
        isOpen={Boolean(selectedShareFile)}
        file={selectedShareFile}
        onClose={() => setSelectedShareFile(null)}
      />

      <FileDetailsDrawer
        isOpen={Boolean(selectedDetailsFile)}
        file={selectedDetailsFile}
        onClose={() => setSelectedDetailsFile(null)}
      />
    </div>
  );
}
