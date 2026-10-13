import React, { useState, useEffect } from 'react';
import {
  LayoutGrid, List, Filter, ArrowUpDown, Plus, Upload, 
  Search, FolderPlus, Sparkles, ChevronLeft, ChevronRight,
  CheckSquare, Square, Check, Globe, Lock, Trash2, X, RotateCcw
} from 'lucide-react';
import { api, getToken } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import FileCard from '../components/files/FileCard';
import FileTable from '../components/files/FileTable';
import FolderCard from '../components/files/FolderCard';
import Breadcrumbs from '../components/files/Breadcrumbs';
import EmptyState from '../components/common/EmptyState';
import FileUploadModal from '../components/files/FileUploadModal';
import NewFolderModal from '../components/files/NewFolderModal';
import FilePreviewModal from '../components/files/FilePreviewModal';
import FileShareModal from '../components/files/FileShareModal';
import VersionHistoryModal from '../components/files/VersionHistoryModal';
import FileDetailsDrawer from '../components/files/FileDetailsDrawer';
import MoveFileModal from '../components/files/MoveFileModal';
import RenameModal from '../components/files/RenameModal';
import ConfirmDialog from '../components/common/ConfirmDialog';

export default function FilesPage({ scope = 'all', title = 'Files', onUploadTrigger }) {
  const { user, isAdmin, isHOD } = useAuth();

  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'
  const [currentFolder, setCurrentFolder] = useState(null);
  const [breadcrumbs, setBreadcrumbs] = useState([]);
  const [folders, setFolders] = useState([]);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);

  // Multi-Selection State
  const [selectedFileIds, setSelectedFileIds] = useState([]);
  const [showBatchTrashDialog, setShowBatchTrashDialog] = useState(false);
  const [batchActionLoading, setBatchActionLoading] = useState(false);

  // Filters & Sorting
  const [filterType, setFilterType] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [searchFilter, setSearchFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalFilesCount, setTotalFilesCount] = useState(0);

  // Modals state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [selectedFileForPreview, setSelectedFileForPreview] = useState(null);
  const [selectedFileForShare, setSelectedFileForShare] = useState(null);
  const [selectedFileForVersions, setSelectedFileForVersions] = useState(null);
  const [selectedFileForDetails, setSelectedFileForDetails] = useState(null);
  const [itemToMove, setItemToMove] = useState(null);
  const [itemToRename, setItemToRename] = useState(null);
  const [fileToDelete, setFileToDelete] = useState(null);
  const [folderToDelete, setFolderToDelete] = useState(null);

  useEffect(() => {
    loadFolders();
    loadFiles();
  }, [currentFolder, filterType, sortBy, currentPage, scope]);

  useEffect(() => {
    if (currentFolder) {
      loadBreadcrumbs(currentFolder.id);
    } else {
      setBreadcrumbs([]);
    }
  }, [currentFolder]);

  const loadFolders = async () => {
    try {
      const params = {
        parent_folder_id: currentFolder ? currentFolder.id : 'null'
      };
      if (scope === 'my') params.scope = 'my';
      const data = await api.get('/folders', params);
      setFolders(data.folders || []);
    } catch (err) {
      console.warn('Failed to load folders:', err);
    }
  };

  const loadBreadcrumbs = async (folderId) => {
    try {
      const data = await api.get(`/folders/${folderId}/breadcrumbs`);
      setBreadcrumbs(data.breadcrumbs || []);
    } catch (err) {
      console.warn('Breadcrumb load error:', err);
    }
  };

  const loadFiles = async () => {
    setLoading(true);
    setSelectedFileIds([]);
    try {
      const params = {
        scope: scope,
        folder_id: currentFolder ? currentFolder.id : (scope === 'my' || scope === 'all' ? 'all' : 'null'),
        file_type: filterType,
        sort: sortBy,
        search: searchFilter,
        page: currentPage,
        limit: 24
      };

      const data = await api.get('/files', params);
      setFiles(data.files || []);
      setTotalPages(data.pagination?.pages || 1);
      setTotalFilesCount(data.pagination?.total || data.files?.length || 0);
    } catch (err) {
      console.warn('Failed to load files:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = () => {
    if (selectedFileIds.length === files.length) {
      setSelectedFileIds([]);
    } else {
      setSelectedFileIds(files.map(f => f.id));
    }
  };

  const handleToggleSelect = (fileId) => {
    setSelectedFileIds(prev => 
      prev.includes(fileId) ? prev.filter(id => id !== fileId) : [...prev, fileId]
    );
  };

  const handleBatchTrash = async () => {
    if (selectedFileIds.length === 0) return;
    setBatchActionLoading(true);
    try {
      await api.post('/files/batch-trash', { file_ids: selectedFileIds });
      setFiles(prev => prev.filter(f => !selectedFileIds.includes(f.id)));
      setTotalFilesCount(prev => Math.max(0, prev - selectedFileIds.length));
      setSelectedFileIds([]);
      setShowBatchTrashDialog(false);
    } catch (err) {
      alert('Failed to move files to trash: ' + err.message);
    } finally {
      setBatchActionLoading(false);
    }
  };

  const handleBatchVisibility = async (newVisibility) => {
    if (selectedFileIds.length === 0) return;
    try {
      await api.post('/files/batch-visibility', { file_ids: selectedFileIds, visibility: newVisibility });
      setFiles(prev => prev.map(f => selectedFileIds.includes(f.id) ? { ...f, visibility: newVisibility } : f));
      setSelectedFileIds([]);
    } catch (err) {
      alert('Failed to update visibility: ' + err.message);
    }
  };

  const handleToggleStar = async (file) => {
    try {
      const res = await api.post(`/files/${file.id}/star`);
      setFiles(prev => prev.map(f => f.id === file.id ? { ...f, is_starred: res.is_favorite } : f));
    } catch (err) {
      console.warn('Star toggle error:', err);
    }
  };

  const handleDownload = (file) => {
    const token = getToken();
    const link = document.createElement('a');
    link.href = `/api/files/${file.id}/download?token=${token || ''}`;
    link.download = file.name || file.original_name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDeleteFileConfirm = async () => {
    if (!fileToDelete) return;
    try {
      await api.delete(`/files/${fileToDelete.id}`);
      setFiles(prev => prev.filter(f => f.id !== fileToDelete.id));
      setTotalFilesCount(prev => Math.max(0, prev - 1));
      setFileToDelete(null);
    } catch (err) {
      alert('Failed to delete file: ' + err.message);
    }
  };

  const handleDeleteFolderConfirm = async () => {
    if (!folderToDelete) return;
    try {
      await api.delete(`/folders/${folderToDelete.id}`);
      setFolders(prev => prev.filter(f => f.id !== folderToDelete.id));
      setFolderToDelete(null);
      loadFiles();
    } catch (err) {
      alert('Failed to delete folder: ' + err.message);
    }
  };

  const isAllSelected = files.length > 0 && selectedFileIds.length === files.length;

  return (
    <div className="space-y-6 text-left relative pb-20">
      {/* Header & Controls Toolbar */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-slate-200 pb-4 dark:border-slate-800">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
            {title}
          </h2>
          <div className="mt-1">
            <Breadcrumbs
              items={breadcrumbs}
              onNavigate={(folder) => setCurrentFolder(folder)}
              rootLabel="All College Files"
            />
          </div>
        </div>

        {/* Action Buttons & Filters */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Select All Toggle Button */}
          {files.length > 0 && (
            <button
              onClick={handleSelectAll}
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition cursor-pointer ${
                isAllSelected
                  ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:border-indigo-500 dark:bg-indigo-950/60 dark:text-indigo-300 shadow-xs'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-850 dark:text-slate-200'
              }`}
            >
              {isAllSelected ? (
                <CheckSquare className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              ) : (
                <Square className="h-4 w-4" />
              )}
              <span>{isAllSelected ? 'Deselect All' : `Select All (${files.length})`}</span>
            </button>
          )}

          {/* File Type Filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
          >
            <option value="all">All File Types</option>
            <option value="document">Word Documents (.docx)</option>
            <option value="pdf">PDF Documents</option>
            <option value="spreadsheet">Spreadsheets / CSV</option>
            <option value="presentation">Presentations</option>
            <option value="image">Images (OCR)</option>
            <option value="video">Videos</option>
            <option value="audio">Audio</option>
            <option value="archive">ZIP / RAR</option>
          </select>

          {/* Sort Dropdown */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="name_asc">Name (A–Z)</option>
            <option value="name_desc">Name (Z–A)</option>
            <option value="largest">Largest Size</option>
            <option value="smallest">Smallest Size</option>
            <option value="type">File Type</option>
          </select>

          {/* Grid vs List View Toggle */}
          <div className="flex items-center rounded-xl border border-slate-200 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-800">
            <button
              onClick={() => setViewMode('grid')}
              className={`rounded-lg p-1.5 transition cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-slate-100 text-indigo-600 dark:bg-slate-700 dark:text-indigo-400'
                  : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
              title="Grid View"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`rounded-lg p-1.5 transition cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-slate-100 text-indigo-600 dark:bg-slate-700 dark:text-indigo-400'
                  : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
              title="List View"
            >
              <List className="h-4 w-4" />
            </button>
          </div>

          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-700 via-indigo-600 to-blue-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-indigo-500/20 hover:from-blue-800 hover:to-indigo-700 transition active:scale-95 cursor-pointer"
          >
            <Upload className="h-3.5 w-3.5 stroke-[2.5]" />
            <span>Upload Document</span>
          </button>
        </div>
      </div>

      {/* Folders Section (if any folders in current level) */}
      {folders.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Folders ({folders.length})
            </h3>
            <button
              onClick={() => setShowNewFolderModal(true)}
              className="text-xs text-indigo-600 hover:underline dark:text-indigo-400 font-bold cursor-pointer"
            >
              + New Folder
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {folders.map((f) => (
              <FolderCard
                key={f.id}
                folder={f}
                onOpen={(folder) => setCurrentFolder(folder)}
                onRename={(folder) => setItemToRename({ ...folder, isFolder: true })}
                onMove={(folder) => setItemToMove({ ...folder, isFolder: true })}
                onDelete={(folder) => setFolderToDelete(folder)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Files Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Files ({totalFilesCount})
            </h3>
            {selectedFileIds.length > 0 && (
              <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                {selectedFileIds.length} Selected
              </span>
            )}
          </div>
        </div>

        {loading ? (
          <div className="py-20 text-center text-xs text-slate-400 animate-pulse">
            Loading repository files...
          </div>
        ) : files.length === 0 ? (
          <EmptyState
            type="files"
            title={currentFolder ? `No files in "${currentFolder.name}"` : 'No files found'}
            description="Upload your academic documents, scanned papers, or lecture materials."
            actionText="Upload File"
            onAction={() => setShowUploadModal(true)}
          />
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
            {files.map((file) => (
              <FileCard
                key={file.id}
                file={file}
                isSelected={selectedFileIds.includes(file.id)}
                onToggleSelect={handleToggleSelect}
                onPreview={(f) => setSelectedFileForPreview(f)}
                onDownload={handleDownload}
                onShare={(f) => setSelectedFileForShare(f)}
                onToggleStar={handleToggleStar}
                onRename={(f) => setItemToRename(f)}
                onMove={(f) => setItemToMove(f)}
                onDelete={(f) => setFileToDelete(f)}
                onViewDetails={(f) => setSelectedFileForDetails(f)}
                onVersionHistory={(f) => setSelectedFileForVersions(f)}
                onCatalogue={f => { window.location.href = `/syllabus-management?fileId=${encodeURIComponent(f.id)}`; }}
              />
            ))}
          </div>
        ) : (
          <FileTable
            files={files}
            selectedFileIds={selectedFileIds}
            onToggleSelect={handleToggleSelect}
            onSelectAll={handleSelectAll}
            onPreview={(f) => setSelectedFileForPreview(f)}
            onDownload={handleDownload}
            onShare={(f) => setSelectedFileForShare(f)}
            onToggleStar={handleToggleStar}
            onRename={(f) => setItemToRename(f)}
            onMove={(f) => setItemToMove(f)}
            onDelete={(f) => setFileToDelete(f)}
            onViewDetails={(f) => setSelectedFileForDetails(f)}
            onVersionHistory={(f) => setSelectedFileForVersions(f)}
            onCatalogue={f => { window.location.href = `/syllabus-management?fileId=${encodeURIComponent(f.id)}`; }}
          />
        )}

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 pt-4 text-xs dark:border-slate-800">
            <span className="text-slate-400">
              Showing page {currentPage} of {totalPages} ({totalFilesCount} total files)
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage <= 1}
                className="flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" /> Previous
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage >= totalPages}
                className="flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
              >
                Next <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Floating Sticky Bulk Actions Bar */}
      {selectedFileIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 rounded-2xl border border-slate-700 bg-slate-900/95 px-5 py-3 text-white shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-5 duration-200">
          <div className="flex items-center gap-2 pr-3 border-r border-slate-700">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-xs font-black">
              {selectedFileIds.length}
            </span>
            <span className="text-xs font-bold">Selected</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Move to Trash */}
            <button
              onClick={() => setShowBatchTrashDialog(true)}
              className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-rose-700 active:scale-95 transition cursor-pointer"
              title="Move selected to Trash"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Move to Trash</span>
            </button>

            {/* Make Public */}
            <button
              onClick={() => handleBatchVisibility('public')}
              className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-slate-700 active:scale-95 transition cursor-pointer"
              title="Set selected files to Public"
            >
              <Globe className="h-3.5 w-3.5" />
              <span>Make Public</span>
            </button>

            {/* Make Private */}
            <button
              onClick={() => handleBatchVisibility('private')}
              className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-amber-400 hover:bg-slate-700 active:scale-95 transition cursor-pointer"
              title="Set selected files to Private"
            >
              <Lock className="h-3.5 w-3.5" />
              <span>Make Private</span>
            </button>

            {/* Clear Selection */}
            <button
              onClick={() => setSelectedFileIds([])}
              className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition cursor-pointer"
              title="Clear Selection"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Modals & Drawers */}
      <FileUploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        currentFolderId={currentFolder ? currentFolder.id : null}
        onUploadComplete={() => {
          loadFiles();
          loadFolders();
        }}
      />

      <NewFolderModal
        isOpen={showNewFolderModal}
        onClose={() => setShowNewFolderModal(false)}
        parentFolderId={currentFolder ? currentFolder.id : null}
        onFolderCreated={() => {
          loadFolders();
        }}
      />

      <FilePreviewModal
        isOpen={Boolean(selectedFileForPreview)}
        file={selectedFileForPreview}
        onClose={() => setSelectedFileForPreview(null)}
        onShare={(f) => { setSelectedFileForPreview(null); setSelectedFileForShare(f); }}
        onDownload={handleDownload}
      />

      <FileShareModal
        isOpen={Boolean(selectedFileForShare)}
        file={selectedFileForShare}
        onClose={() => setSelectedFileForShare(null)}
        onShareUpdated={() => loadFiles()}
      />

      <VersionHistoryModal
        isOpen={Boolean(selectedFileForVersions)}
        file={selectedFileForVersions}
        onClose={() => setSelectedFileForVersions(null)}
        onVersionUpdated={() => loadFiles()}
      />

      <FileDetailsDrawer
        isOpen={Boolean(selectedFileForDetails)}
        file={selectedFileForDetails}
        onClose={() => setSelectedFileForDetails(null)}
      />

      <MoveFileModal
        isOpen={Boolean(itemToMove)}
        item={itemToMove}
        isFolder={itemToMove?.isFolder}
        onClose={() => setItemToMove(null)}
        onMoved={() => {
          loadFiles();
          loadFolders();
        }}
      />

      <RenameModal
        isOpen={Boolean(itemToRename)}
        item={itemToRename}
        isFolder={itemToRename?.isFolder}
        onClose={() => setItemToRename(null)}
        onRenamed={() => {
          loadFiles();
          loadFolders();
        }}
      />

      {/* Dialog: Batch Move to Trash */}
      <ConfirmDialog
        isOpen={showBatchTrashDialog}
        title="Move Selected Files to Trash"
        message={`Are you sure you want to move ${selectedFileIds.length} selected files to the Trash? You can restore them anytime from the Recycle Bin.`}
        confirmText={batchActionLoading ? "Moving..." : "Move to Trash"}
        isDanger={true}
        onClose={() => setShowBatchTrashDialog(false)}
        onConfirm={handleBatchTrash}
      />

      {/* Dialog: Single File Delete */}
      <ConfirmDialog
        isOpen={Boolean(fileToDelete)}
        title="Move to Trash"
        message={`Are you sure you want to move "${fileToDelete?.name}" to the Trash?`}
        confirmText="Move to Trash"
        isDanger={true}
        onClose={() => setFileToDelete(null)}
        onConfirm={handleDeleteFileConfirm}
      />

      {/* Dialog: Folder Delete */}
      <ConfirmDialog
        isOpen={Boolean(folderToDelete)}
        title="Delete Folder"
        message={`Are you sure you want to delete folder "${folderToDelete?.name}"? All files inside will be moved to Trash.`}
        confirmText="Delete Folder"
        isDanger={true}
        onClose={() => setFolderToDelete(null)}
        onConfirm={handleDeleteFolderConfirm}
      />
    </div>
  );
}
