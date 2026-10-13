import React, { useState, useEffect } from 'react';
import { Folder, FolderPlus, Plus, ChevronRight, Files } from 'lucide-react';
import { api } from '../utils/api';
import FolderCard from '../components/files/FolderCard';
import NewFolderModal from '../components/files/NewFolderModal';
import MoveFileModal from '../components/files/MoveFileModal';
import RenameModal from '../components/files/RenameModal';
import ConfirmDialog from '../components/common/ConfirmDialog';
import EmptyState from '../components/common/EmptyState';

export default function FoldersPage({ onOpenFolder }) {
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [itemToRename, setItemToRename] = useState(null);
  const [itemToMove, setItemToMove] = useState(null);
  const [folderToDelete, setFolderToDelete] = useState(null);

  useEffect(() => {
    loadAllFolders();
  }, []);

  const loadAllFolders = async () => {
    setLoading(true);
    try {
      const data = await api.get('/folders', { parent_folder_id: 'all' });
      setFolders(data.folders || []);
    } catch (err) {
      console.warn('Failed to load folders:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteFolderConfirm = async () => {
    if (!folderToDelete) return;
    try {
      await api.delete(`/folders/${folderToDelete.id}`);
      setFolders(prev => prev.filter(f => f.id !== folderToDelete.id));
      setFolderToDelete(null);
    } catch (err) {
      alert('Failed to delete folder: ' + err.message);
    }
  };

  return (
    <div className="space-y-5 text-left">
      <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Folder className="h-5 w-5 text-brand-600" />
            Folder Directory
          </h2>
          <p className="text-xs text-slate-400">
            Browse all college academic, research, and administrative folders.
          </p>
        </div>

        <button
          onClick={() => setShowNewFolderModal(true)}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-700 via-indigo-600 to-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-indigo-500/20 hover:from-blue-800 hover:to-indigo-700 transition active:scale-95 cursor-pointer"
        >
          <Plus className="h-4 w-4 stroke-[2.5]" />
          <span>New Folder</span>
        </button>
      </div>

      {loading ? (
        <div className="py-20 text-center text-xs text-slate-400 animate-pulse">
          Loading folder tree...
        </div>
      ) : folders.length === 0 ? (
        <EmptyState
          type="folders"
          title="No folders created yet"
          description="Organize your files by creating departmental and category folders."
          actionText="Create Folder"
          onAction={() => setShowNewFolderModal(true)}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {folders.map((folder) => (
            <FolderCard
              key={folder.id}
              folder={folder}
              onOpen={(f) => onOpenFolder && onOpenFolder(f)}
              onRename={(f) => setItemToRename({ ...f, isFolder: true })}
              onMove={(f) => setItemToMove({ ...f, isFolder: true })}
              onDelete={(f) => setFolderToDelete(f)}
            />
          ))}
        </div>
      )}

      <NewFolderModal
        isOpen={showNewFolderModal}
        onClose={() => setShowNewFolderModal(false)}
        onFolderCreated={() => loadAllFolders()}
      />

      <MoveFileModal
        isOpen={Boolean(itemToMove)}
        item={itemToMove}
        isFolder={true}
        onClose={() => setItemToMove(null)}
        onMoved={() => loadAllFolders()}
      />

      <RenameModal
        isOpen={Boolean(itemToRename)}
        item={itemToRename}
        isFolder={true}
        onClose={() => setItemToRename(null)}
        onRenamed={() => loadAllFolders()}
      />

      <ConfirmDialog
        isOpen={Boolean(folderToDelete)}
        title="Delete Folder"
        message={`Are you sure you want to delete folder "${folderToDelete?.name}"? All files within will be moved to Trash.`}
        confirmText="Delete Folder"
        isDanger={true}
        onClose={() => setFolderToDelete(null)}
        onConfirm={handleDeleteFolderConfirm}
      />
    </div>
  );
}
