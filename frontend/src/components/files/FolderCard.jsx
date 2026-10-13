import React, { useState, useRef, useEffect } from 'react';
import { Folder, MoreVertical, Edit3, Trash2, FolderInput, ArrowRight, ExternalLink } from 'lucide-react';

export default function FolderCard({ folder, onOpen, onRename, onMove, onDelete }) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getColorClasses = (color) => {
    switch (color) {
      case 'purple':
        return 'text-purple-600 bg-purple-50 dark:bg-purple-950/50 border-purple-200 dark:border-purple-800/50';
      case 'emerald':
        return 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800/50';
      case 'red':
        return 'text-rose-600 bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800/50';
      case 'amber':
      case 'orange':
        return 'text-amber-600 bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800/50';
      case 'cyan':
        return 'text-cyan-600 bg-cyan-50 dark:bg-cyan-950/50 border-cyan-200 dark:border-cyan-800/50';
      case 'blue':
      default:
        return 'text-blue-600 bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800/50';
    }
  };

  const colorStyle = getColorClasses(folder.color);

  return (
    <div className="group relative flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-4 transition-all duration-200 hover:-translate-y-1 hover:border-indigo-300 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-700 min-h-[140px] text-left">
      {/* Top Bar: Icon and Actions */}
      <div className="flex items-start justify-between gap-2">
        <div 
          onClick={() => onOpen(folder)}
          className={`flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl border ${colorStyle} transition-transform group-hover:scale-105`}
        >
          <Folder className="h-6 w-6 fill-current/25" />
        </div>

        <div className="flex items-center gap-1">
          {folder.drive_link && (
            <a
              href={folder.drive_link}
              target="_blank"
              rel="noreferrer"
              title="Open in Google Drive"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 rounded-lg bg-blue-50 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-800/80 px-2 py-1 text-[10px] font-bold text-blue-700 dark:text-blue-300 hover:bg-blue-100 transition"
            >
              <ExternalLink className="h-3 w-3" />
              <span>Drive</span>
            </a>
          )}

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer"
              title="Folder Options"
            >
              <MoreVertical className="h-4 w-4" />
            </button>

            {showMenu && (
              <div className="absolute right-0 z-20 mt-1 w-48 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-2xl dark:border-slate-700 dark:bg-slate-900 text-left">
                <button
                  onClick={() => { setShowMenu(false); onOpen(folder); }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                  Open Folder
                </button>
                {folder.drive_link && (
                  <a
                    href={folder.drive_link}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => setShowMenu(false)}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/60"
                  >
                    <ExternalLink className="h-3.5 w-3.5 text-blue-500" />
                    Open in Google Drive
                  </a>
                )}
                <button
                  onClick={() => { setShowMenu(false); onRename(folder); }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <Edit3 className="h-3.5 w-3.5 text-slate-400" />
                  Rename
                </button>
                <button
                  onClick={() => { setShowMenu(false); onMove(folder); }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <FolderInput className="h-3.5 w-3.5 text-slate-400" />
                  Move Folder
                </button>
                <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
                <button
                  onClick={() => { setShowMenu(false); onDelete(folder); }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/50 cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete Folder
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Middle: Full Clear Folder Name */}
      <div 
        onClick={() => onOpen(folder)}
        className="my-3 cursor-pointer"
      >
        <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 leading-snug group-hover:text-indigo-600 dark:group-hover:text-indigo-400 break-words">
          {folder.name}
        </h4>
      </div>

      {/* Bottom Row: File Count Badge */}
      <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800/80 pt-2 text-[11px] text-slate-400">
        <span className="font-medium text-slate-500 dark:text-slate-400">
          {folder.file_count || 0} files
        </span>
        <button
          onClick={() => onOpen(folder)}
          className="flex items-center gap-1 font-bold text-indigo-600 dark:text-indigo-400 hover:underline text-[11px] cursor-pointer"
        >
          <span>Open</span>
          <ArrowRight className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
