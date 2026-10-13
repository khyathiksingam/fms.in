import React, { useState, useEffect } from 'react';
import { Trash2, RotateCcw, AlertTriangle, CheckCircle2, CheckSquare, Square } from 'lucide-react';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { formatBytes, formatDate, formatRelativeTime } from '../utils/formatters';
import { getFileIcon } from '../components/files/FileCard';
import ConfirmDialog from '../components/common/ConfirmDialog';
import EmptyState from '../components/common/EmptyState';

export default function TrashPage() {
  const { user, isAdmin } = useAuth();
  const [files, setFiles] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [restoringAll, setRestoringAll] = useState(false);
  const [fileToPermanentDelete, setFileToPermanentDelete] = useState(null);
  const [showEmptyTrashDialog, setShowEmptyTrashDialog] = useState(false);
  const [showRestoreAllDialog, setShowRestoreAllDialog] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadTrash();
  }, []);

  const loadTrash = async () => {
    setLoading(true);
    setSelectedIds([]);
    try {
      const data = await api.get('/files', { scope: 'trash' });
      setFiles(data.files || []);
    } catch (err) {
      console.warn('Failed to load trash:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.length === files.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(files.map(f => f.id));
    }
  };

  const handleToggleSelect = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleRestore = async (file) => {
    try {
      const res = await api.post(`/files/${file.id}/restore`);
      setMessage(res.message || `File "${file.name}" restored successfully.`);
      setFiles(prev => prev.filter(f => f.id !== file.id));
      setSelectedIds(prev => prev.filter(id => id !== file.id));
    } catch (err) {
      alert('Failed to restore file: ' + err.message);
    }
  };

  const handleRestoreAllConfirm = async () => {
    setRestoringAll(true);
    try {
      const res = await api.post('/trash/restore-all');
      setMessage(res.message || `All files successfully restored to College Files.`);
      setFiles([]);
      setSelectedIds([]);
      setShowRestoreAllDialog(false);
    } catch (err) {
      alert('Failed to restore all files: ' + err.message);
    } finally {
      setRestoringAll(false);
    }
  };

  const handleRestoreSelected = async () => {
    if (selectedIds.length === 0) return;
    try {
      const res = await api.post('/trash/restore-selected', { file_ids: selectedIds });
      setMessage(res.message || `${selectedIds.length} files restored successfully.`);
      setFiles(prev => prev.filter(f => !selectedIds.includes(f.id)));
      setSelectedIds([]);
    } catch (err) {
      alert('Failed to restore selected files: ' + err.message);
    }
  };

  const handlePermanentDeleteConfirm = async () => {
    if (!fileToPermanentDelete) return;
    try {
      await api.delete(`/files/${fileToPermanentDelete.id}/permanent`);
      setFiles(prev => prev.filter(f => f.id !== fileToPermanentDelete.id));
      setSelectedIds(prev => prev.filter(id => id !== fileToPermanentDelete.id));
      setFileToPermanentDelete(null);
      setMessage('File permanently deleted.');
    } catch (err) {
      alert('Failed to permanently delete: ' + err.message);
    }
  };

  const handleEmptyTrashConfirm = async () => {
    try {
      const res = await api.delete('/trash/empty');
      setFiles([]);
      setSelectedIds([]);
      setShowEmptyTrashDialog(false);
      setMessage(res.message || 'Trash emptied.');
    } catch (err) {
      alert('Failed to empty trash: ' + err.message);
    }
  };

  return (
    <div className="space-y-5 text-left">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4 dark:border-slate-800">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-rose-500" />
            Trash / Recycle Bin
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Deleted files are preserved here. You can restore them with 1-click or permanently purge them.
          </p>
        </div>

        {files.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {/* 1-Click Restore All Button */}
            <button
              onClick={() => setShowRestoreAllDialog(true)}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm shadow-emerald-500/25 hover:bg-emerald-700 active:scale-95 transition cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Restore All ({files.length})</span>
            </button>

            {/* Restore Selected Button */}
            {selectedIds.length > 0 && (
              <button
                onClick={handleRestoreSelected}
                className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm shadow-indigo-500/25 hover:bg-indigo-700 active:scale-95 transition cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Restore Selected ({selectedIds.length})</span>
              </button>
            )}

            {/* Empty Trash Button */}
            <button
              onClick={() => setShowEmptyTrashDialog(true)}
              className="flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/70 dark:text-rose-300 transition cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Empty Trash</span>
            </button>
          </div>
        )}
      </div>

      {/* Status Message */}
      {message && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 shadow-xs border border-emerald-200/60 dark:border-emerald-800">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {/* Main Table / Empty State */}
      {loading ? (
        <div className="py-20 text-center text-xs text-slate-400 animate-pulse">
          Loading trash items...
        </div>
      ) : files.length === 0 ? (
        <EmptyState
          type="trash"
          title="Recycle bin is empty"
          description="Deleted documents will appear here with 1-click restoration options before permanent deletion."
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-850 dark:text-slate-400">
              <tr>
                <th className="py-3.5 pl-4 pr-2 w-10">
                  <button 
                    onClick={handleSelectAll}
                    className="flex items-center text-slate-500 hover:text-indigo-600 cursor-pointer"
                  >
                    {selectedIds.length === files.length ? (
                      <CheckSquare className="h-4 w-4 text-indigo-600" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                  </button>
                </th>
                <th className="py-3.5 px-3">File Name</th>
                <th className="px-3 py-3.5">Owner</th>
                <th className="px-3 py-3.5">Original Folder</th>
                <th className="px-3 py-3.5">Size</th>
                <th className="px-3 py-3.5">Deleted Date</th>
                <th className="py-3.5 pl-3 pr-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {files.map((file) => {
                const isSelected = selectedIds.includes(file.id);
                return (
                  <tr 
                    key={file.id} 
                    className={`transition hover:bg-slate-50/80 dark:hover:bg-slate-800/40 ${
                      isSelected ? 'bg-indigo-50/40 dark:bg-indigo-950/20' : ''
                    }`}
                  >
                    <td className="py-3 pl-4 pr-2">
                      <button 
                        onClick={() => handleToggleSelect(file.id)}
                        className="flex items-center text-slate-400 hover:text-indigo-600 cursor-pointer"
                      >
                        {isSelected ? (
                          <CheckSquare className="h-4 w-4 text-indigo-600" />
                        ) : (
                          <Square className="h-4 w-4" />
                        )}
                      </button>
                    </td>

                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2.5 max-w-sm truncate">
                        {getFileIcon(file.file_type, "h-5 w-5")}
                        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate" title={file.name}>
                          {file.name}
                        </span>
                      </div>
                    </td>

                    <td className="px-3 py-3 text-slate-600 dark:text-slate-400">
                      {file.owner_name || 'Mrs. P. Devika'}
                    </td>

                    <td className="px-3 py-3">
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {file.folder_name || 'Root Repository'}
                      </span>
                    </td>

                    <td className="px-3 py-3 text-slate-500 font-medium">
                      {formatBytes(file.size)}
                    </td>

                    <td className="px-3 py-3 text-slate-500">
                      {formatDate(file.deleted_at)}
                    </td>

                    <td className="py-3 pl-3 pr-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleRestore(file)}
                          className="flex items-center gap-1 rounded-xl bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300 cursor-pointer transition"
                          title="Restore File"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          <span>Restore</span>
                        </button>
                        <button
                          onClick={() => setFileToPermanentDelete(file)}
                          className="flex items-center gap-1 rounded-xl bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 dark:bg-rose-950/60 dark:text-rose-300 cursor-pointer transition"
                          title="Permanent Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Dialog: Restore All Files */}
      <ConfirmDialog
        isOpen={showRestoreAllDialog}
        title="Restore All Files"
        message={`Are you sure you want to restore all ${files.length} files back to the College Files repository in 1 click?`}
        confirmText={restoringAll ? "Restoring..." : "Restore All Files"}
        isDanger={false}
        onClose={() => setShowRestoreAllDialog(false)}
        onConfirm={handleRestoreAllConfirm}
      />

      {/* Dialog: Delete Single File */}
      <ConfirmDialog
        isOpen={Boolean(fileToPermanentDelete)}
        title="Permanently Delete File"
        message={`Are you sure you want to permanently erase "${fileToPermanentDelete?.name}"? This action cannot be undone and will delete all versions from physical storage.`}
        confirmText="Permanently Delete"
        isDanger={true}
        onClose={() => setFileToPermanentDelete(null)}
        onConfirm={handlePermanentDeleteConfirm}
      />

      {/* Dialog: Empty All Trash */}
      <ConfirmDialog
        isOpen={showEmptyTrashDialog}
        title="Empty Trash Bin"
        message="Are you sure you want to permanently delete all items in the Trash? All physical storage binaries will be purged."
        confirmText="Empty All Trash"
        isDanger={true}
        onClose={() => setShowEmptyTrashDialog(false)}
        onConfirm={handleEmptyTrashConfirm}
      />
    </div>
  );
}
