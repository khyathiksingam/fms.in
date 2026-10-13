import React from 'react';
import { Files, Search, Star, Bell, Trash2, Folder, Plus, Upload, Share2 } from 'lucide-react';

export default function EmptyState({ type = 'files', title, description, actionText, onAction }) {
  const getIcon = () => {
    switch (type) {
      case 'search':
        return <Search className="h-10 w-10 text-slate-400 dark:text-slate-500" />;
      case 'favorites':
        return <Star className="h-10 w-10 text-amber-500" />;
      case 'notifications':
        return <Bell className="h-10 w-10 text-slate-400 dark:text-slate-500" />;
      case 'trash':
        return <Trash2 className="h-10 w-10 text-rose-500" />;
      case 'folders':
        return <Folder className="h-10 w-10 text-indigo-500 dark:text-indigo-400" />;
      case 'shared':
        return <Share2 className="h-10 w-10 text-indigo-500 dark:text-indigo-400" />;
      case 'files':
      default:
        return <Files className="h-10 w-10 text-indigo-500 dark:text-indigo-400" />;
    }
  };

  const getDefaults = () => {
    switch (type) {
      case 'search':
        return {
          title: title || 'No documents match your query',
          description: description || 'Try searching by document title, author name, or OCR content keywords.'
        };
      case 'favorites':
        return {
          title: title || 'No starred files',
          description: description || 'Star important documents to access them quickly here.'
        };
      case 'trash':
        return {
          title: title || 'Recycle bin is empty',
          description: description || 'Deleted items will appear here before permanent deletion.'
        };
      case 'folders':
        return {
          title: title || 'No folders created yet',
          description: description || 'Organize your files by creating departmental and category folders.'
        };
      case 'shared':
        return {
          title: title || 'No shared files yet',
          description: description || 'When faculty members or department heads share files with you, they will appear here.'
        };
      case 'files':
      default:
        return {
          title: title || 'No files found',
          description: description || 'Upload your academic documents, scanned papers, or lecture materials.'
        };
    }
  };

  const defaults = getDefaults();

  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-12 text-center shadow-xs transition-colors duration-200">
      <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-indigo-50 dark:bg-slate-800 shadow-xs mb-4">
        {getIcon()}
      </div>
      <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
        {defaults.title}
      </h3>
      <p className="mt-1 max-w-sm text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
        {defaults.description}
      </p>
      {actionText && onAction && (
        <button
          onClick={onAction}
          className="mt-5 flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-700 via-indigo-600 to-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-indigo-500/25 hover:from-blue-800 hover:to-indigo-700 transition active:scale-95 cursor-pointer"
        >
          {type === 'folders' ? <Plus className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
          <span>{actionText}</span>
        </button>
      )}
    </div>
  );
}
