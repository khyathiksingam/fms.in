import React, { useState, useEffect } from 'react';
import { FolderPlus, X, Plus } from 'lucide-react';
import { api } from '../../utils/api';

export default function NewFolderModal({ isOpen, onClose, onFolderCreated, parentFolderId, departmentId }) {
  const [folderName, setFolderName] = useState('');
  const [folderColor, setFolderColor] = useState('blue');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && !loading) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, loading]);

  if (!isOpen) return null;

  const colors = [
    { id: 'blue', label: 'Blue', bg: 'bg-blue-500' },
    { id: 'purple', label: 'Purple', bg: 'bg-purple-500' },
    { id: 'emerald', label: 'Green', bg: 'bg-emerald-500' },
    { id: 'red', label: 'Red', bg: 'bg-rose-500' },
    { id: 'amber', label: 'Amber', bg: 'bg-amber-500' },
    { id: 'cyan', label: 'Cyan', bg: 'bg-cyan-500' }
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!folderName.trim()) {
      setError('Please enter a folder name.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const data = await api.post('/folders', {
        name: folderName.trim(),
        color: folderColor,
        parent_folder_id: parentFolderId || null,
        department_id: departmentId || null
      });

      if (onFolderCreated) {
        onFolderCreated(data.folder);
      }
      handleClose();
    } catch (err) {
      setError(err.message || 'Failed to create folder.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFolderName('');
    setFolderColor('blue');
    setError('');
    onClose();
  };

  return (
    <div 
      onClick={(e) => { if (e.target === e.currentTarget && !loading) handleClose(); }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md overflow-y-auto"
    >
      <div className="relative w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 text-left transition-colors">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/70 dark:text-indigo-400">
              <FolderPlus className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">Create New Folder</h3>
          </div>
          <button 
            onClick={handleClose} 
            disabled={loading}
            className="rounded-full p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {error && (
            <div className="rounded-xl bg-rose-50 p-2.5 text-xs font-semibold text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Folder Name
            </label>
            <input
              type="text"
              autoFocus
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              placeholder="e.g. Lesson Plans, Question Papers 2026"
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:bg-slate-850"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Folder Color
            </label>
            <div className="flex items-center gap-3">
              {colors.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => setFolderColor(c.id)}
                  className={`h-7 w-7 rounded-full ${c.bg} transition transform cursor-pointer ${
                    folderColor === c.id ? 'ring-2 ring-offset-2 ring-indigo-600 dark:ring-offset-slate-900 scale-110' : 'opacity-70 hover:opacity-100'
                  }`}
                  title={c.label}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 pt-4 dark:border-slate-800">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !folderName.trim()}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-700 via-indigo-600 to-blue-600 px-5 py-2 text-xs font-bold text-white shadow-md shadow-indigo-500/20 hover:from-blue-800 hover:to-indigo-700 transition active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <Plus className="h-4 w-4 stroke-[2.5]" />
              <span>{loading ? 'Creating...' : 'Create Folder'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
