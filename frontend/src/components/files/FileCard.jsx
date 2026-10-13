import React, { useState, useRef, useEffect } from 'react';
import {
  FileText, Image as ImageIcon, Video, Music, Archive,
  FileSpreadsheet, Presentation, Star, MoreVertical,
  Download, Eye, Share2, History, Trash2, Edit3, FolderInput,
  Info, Sparkles, CheckCircle2, AlertCircle, Clock, ExternalLink, BookOpenCheck,
  Globe, Lock, Check
} from 'lucide-react';
import { formatBytes, formatRelativeTime, getFileCategoryColor } from '../../utils/formatters';

export function getFileIcon(type, className = "h-8 w-8") {
  switch (type?.toLowerCase()) {
    case 'pdf':
      return <FileText className={`${className} text-red-500`} />;
    case 'image':
      return <ImageIcon className={`${className} text-purple-500`} />;
    case 'video':
      return <Video className={`${className} text-rose-500`} />;
    case 'audio':
      return <Music className={`${className} text-violet-500`} />;
    case 'spreadsheet':
      return <FileSpreadsheet className={`${className} text-emerald-500`} />;
    case 'presentation':
      return <Presentation className={`${className} text-amber-500`} />;
    case 'archive':
      return <Archive className={`${className} text-orange-500`} />;
    case 'document':
    default:
      return <FileText className={`${className} text-blue-500`} />;
  }
}

export default function FileCard({
  file,
  isSelected = false,
  onToggleSelect,
  onPreview,
  onDownload,
  onShare,
  onToggleStar,
  onRename,
  onMove,
  onDelete,
  onRestore,
  onPermanentDelete,
  onViewDetails,
  onVersionHistory,
  onCatalogue,
  isTrash = false
}) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const colors = getFileCategoryColor(file.file_type);

  return (
    <div className={`group relative flex flex-col justify-between rounded-2xl border bg-white p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg dark:bg-slate-900 ${
      isSelected 
        ? 'border-indigo-600 bg-indigo-50/40 ring-2 ring-indigo-500/30 dark:border-indigo-500 dark:bg-indigo-950/30' 
        : 'border-slate-200 hover:border-indigo-300 dark:border-slate-800 dark:hover:border-indigo-700'
    } ${showMenu ? 'z-40' : 'z-0'}`}>
      
      {/* Top Section */}
      <div>
        {/* Top Row: File Icon + Selection Checkbox (Left) | Star + Menu (Right) */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            {onToggleSelect && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleSelect(file.id);
                }}
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border transition-all cursor-pointer ${
                  isSelected 
                    ? 'border-indigo-600 bg-indigo-600 text-white shadow-xs' 
                    : 'border-slate-300 bg-white/80 text-transparent hover:border-indigo-400 dark:border-slate-700 dark:bg-slate-800'
                }`}
                title={isSelected ? "Deselect File" : "Select File"}
              >
                <Check className="h-3.5 w-3.5" />
              </button>
            )}

            <div 
              onClick={() => !isTrash && onPreview(file)}
              className={`flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border ${colors.bg} transition-transform group-hover:scale-105`}
            >
              {getFileIcon(file.file_type, "h-6 w-6")}
            </div>
          </div>

          {/* Right Action Icons: Star & 3-dots Menu */}
          <div className="flex items-center gap-1">
            {!isTrash && (
              <button
                onClick={() => onToggleStar && onToggleStar(file)}
                className={`rounded-lg p-1.5 transition cursor-pointer ${
                  file.is_starred
                    ? 'text-amber-500 hover:text-amber-600'
                    : 'text-slate-300 hover:text-amber-500 dark:text-slate-600'
                }`}
                title={file.is_starred ? 'Remove Star' : 'Star File'}
              >
                <Star className={`h-4 w-4 ${file.is_starred ? 'fill-amber-400 text-amber-500' : ''}`} />
              </button>
            )}

            {/* Action Menu Dropdown */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer"
                title="File Actions"
              >
                <MoreVertical className="h-4 w-4" />
              </button>

              {showMenu && (
                <div className="absolute right-0 z-50 mt-1 w-52 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-2xl dark:border-slate-700 dark:bg-slate-900 text-left">
                  {!isTrash ? (
                    <>
                      <button
                        onClick={() => { setShowMenu(false); onPreview(file); }}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        <Eye className="h-3.5 w-3.5 text-slate-400" />
                        Preview
                      </button>
                      {file.drive_link && (
                        <a
                          href={file.drive_link}
                          target="_blank"
                          rel="noreferrer"
                          onClick={() => setShowMenu(false)}
                          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/60"
                        >
                          <ExternalLink className="h-3.5 w-3.5 text-blue-500" />
                          Open in Google Docs / Drive
                        </a>
                      )}
                      <button
                        onClick={() => { setShowMenu(false); onDownload(file); }}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        <Download className="h-3.5 w-3.5 text-slate-400" />
                        Download
                      </button>
                      {file.file_type === 'pdf' && !file.catalogue_id && onCatalogue && (
                        <button
                          onClick={() => { setShowMenu(false); onCatalogue(file); }}
                          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
                        >
                          <BookOpenCheck className="h-3.5 w-3.5 text-indigo-500" />
                          Add to student resources
                        </button>
                      )}
                      <button
                        onClick={() => { setShowMenu(false); onShare(file); }}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        <Share2 className="h-3.5 w-3.5 text-slate-400" />
                        Share...
                      </button>
                      <button
                        onClick={() => { setShowMenu(false); onRename(file); }}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        <Edit3 className="h-3.5 w-3.5 text-slate-400" />
                        Rename
                      </button>
                      <button
                        onClick={() => { setShowMenu(false); onMove(file); }}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        <FolderInput className="h-3.5 w-3.5 text-slate-400" />
                        Move to Folder
                      </button>
                      <button
                        onClick={() => { setShowMenu(false); onVersionHistory(file); }}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        <History className="h-3.5 w-3.5 text-slate-400" />
                        Version History
                      </button>
                      <button
                        onClick={() => { setShowMenu(false); onViewDetails(file); }}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        <Info className="h-3.5 w-3.5 text-slate-400" />
                        File Details
                      </button>
                      <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
                      <button
                        onClick={() => { setShowMenu(false); onDelete(file); }}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/60 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Move to Trash
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => { setShowMenu(false); onRestore(file); }}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/50 cursor-pointer"
                      >
                        <History className="h-3.5 w-3.5" />
                        Restore File
                      </button>
                      <button
                        onClick={() => { setShowMenu(false); onPermanentDelete(file); }}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/60 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Permanently Delete
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Badges Row: Dedicated flex-wrap container */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {/* Public / Private Badge */}
          {file.visibility === 'private' ? (
            <span
              title="Private file (Visible only to you & Admin)"
              className="inline-flex items-center gap-1 rounded-md bg-amber-50 dark:bg-amber-950/60 border border-amber-200/70 dark:border-amber-800/80 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300"
            >
              <Lock className="h-2.5 w-2.5" />
              <span>Private</span>
            </span>
          ) : (
            <span
              title="Public file (Visible to all college faculty)"
              className="inline-flex items-center gap-1 rounded-md bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/70 dark:border-emerald-800/80 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300"
            >
              <Globe className="h-2.5 w-2.5" />
              <span>Public</span>
            </span>
          )}

          {/* Google Docs / Drive direct link badge */}
          {file.drive_link && (
            <a
              href={file.drive_link}
              target="_blank"
              rel="noreferrer"
              title="Open directly in Google Docs / Drive"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 rounded-md bg-blue-50 dark:bg-blue-950/70 border border-blue-200/80 dark:border-blue-800 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900 transition"
            >
              <ExternalLink className="h-2.5 w-2.5" />
              <span>Drive</span>
            </a>
          )}

          {/* OCR Status Badge */}
          {file.ocr_status === 'completed' && (
            <span 
              title="OCR Indexed: Text inside document is searchable" 
              className="inline-flex items-center gap-1 rounded-md bg-indigo-50 border border-indigo-200/70 dark:border-indigo-800/70 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300"
            >
              <Sparkles className="h-2.5 w-2.5" />
              <span>OCR</span>
            </span>
          )}

          {file.version > 1 && (
            <span 
              onClick={() => onVersionHistory && onVersionHistory(file)}
              title={`Version ${file.version} (Click to view history)`}
              className="cursor-pointer rounded-md bg-indigo-50 border border-indigo-200/70 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700 hover:underline dark:bg-indigo-950/60 dark:text-indigo-300"
            >
              v{file.version}
            </span>
          )}
        </div>

        {/* Middle: File Name */}
        <div 
          onClick={() => !isTrash && onPreview(file)}
          className="mt-2.5 cursor-pointer text-left"
        >
          <h4 className="font-bold text-xs text-slate-800 dark:text-slate-100 line-clamp-2 hover:text-indigo-600 dark:hover:text-indigo-400 break-words leading-snug" title={file.name}>
            {file.name}
          </h4>
          <p className="mt-1 text-[11px] text-slate-400 truncate">
            {file.department_code ? `${file.department_code} • ` : ''}{file.owner_name || 'Mrs. P. Devika'}
          </p>
        </div>
      </div>

      {/* Bottom Row: Size and Date */}
      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-[11px] text-slate-400 dark:border-slate-800">
        <span className="font-medium text-slate-500 dark:text-slate-400">{formatBytes(file.size)}</span>
        <span className="font-medium text-slate-500 dark:text-slate-400">{formatRelativeTime(file.created_at)}</span>
      </div>
    </div>
  );
}
