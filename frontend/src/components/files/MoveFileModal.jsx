import React, { useState, useEffect } from 'react';
import { FolderInput, X, Folder, Home, Check } from 'lucide-react';
import { api } from '../../utils/api';

export default function MoveFileModal({ isOpen, onClose, item, isFolder = false, onMoved }) {
  const [folders, setFolders] = useState([]);
  const [selectedFolderId, setSelectedFolderId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && item) {
      loadFolders();
      setSelectedFolderId(isFolder ? item.parent_folder_id : item.folder_id);
    }
  }, [isOpen, item, isFolder]);

  const loadFolders = async () => {
    setLoading(true);
    try {
      const data = await api.get('/folders/tree');
      setFolders(data.folders || []);
    } catch (err) {
      setError('Failed to load destination folders.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !item) return null;

  const handleMoveSubmit = async (e) => {
    e.preventDefault();
    setMoving(true);
    setError('');

    try {
      if (isFolder) {
        await api.put(`/folders/${item.id}/move`, { new_parent_id: selectedFolderId });
      } else {
        await api.put(`/files/${item.id}/move`, { folder_id: selectedFolderId });
      }

      onMoved && onMoved();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to move item.');
    } finally {
      setMoving(false);
    }
  };

  // Filter out the folder itself and its descendants if moving a folder
  const availableFolders = isFolder
    ? folders.filter(f => f.id !== item.id && f.parent_folder_id !== item.id)
    : folders;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 text-left">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-100 text-brand-600 dark:bg-brand-950 dark:text-brand-400">
              <FolderInput className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                Move {isFolder ? 'Folder' : 'File'}
              </h3>
              <p className="text-[11px] text-slate-400 truncate max-w-xs">{item.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mt-3 rounded-xl bg-rose-50 p-2.5 text-xs text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
            {error}
          </div>
        )}

        <form onSubmit={handleMoveSubmit} className="mt-4 space-y-4">
          <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Select Destination Folder
          </div>

          <div className="max-h-60 overflow-y-auto space-y-1 rounded-2xl border border-slate-200 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-850">
            {/* Root Option */}
            <div
              onClick={() => setSelectedFolderId(null)}
              className={`flex cursor-pointer items-center justify-between rounded-xl p-2 text-xs transition ${
                selectedFolderId === null
                  ? 'bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300 font-semibold'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Home className="h-4 w-4 text-brand-600" />
                <span>Root (Home / No Parent)</span>
              </div>
              {selectedFolderId === null && <Check className="h-4 w-4 text-brand-600" />}
            </div>

            {availableFolders.map((f) => {
              const isSelected = selectedFolderId === f.id;
              return (
                <div
                  key={f.id}
                  onClick={() => setSelectedFolderId(f.id)}
                  className={`flex cursor-pointer items-center justify-between rounded-xl p-2 text-xs transition ${
                    isSelected
                      ? 'bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300 font-semibold'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <Folder className="h-4 w-4 text-slate-400" />
                    <span className="truncate">{f.name}</span>
                    {f.department_code && (
                      <span className="text-[10px] text-slate-400">({f.department_code})</span>
                    )}
                  </div>
                  {isSelected && <Check className="h-4 w-4 text-brand-600" />}
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 pt-4 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={moving}
              className="rounded-xl bg-gradient-to-r from-blue-700 via-indigo-600 to-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-indigo-500/20 hover:from-blue-800 hover:to-indigo-700 transition active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {moving ? 'Moving...' : 'Move Here'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
