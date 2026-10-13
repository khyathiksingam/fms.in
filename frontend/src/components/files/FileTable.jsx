import React from 'react';
import { 
  Eye, Download, Share2, Star, MoreVertical, Edit3, 
  Trash2, History, Info, Sparkles, FolderInput, ExternalLink,
  Check, CheckSquare, Square, Globe, Lock, BookOpenCheck
} from 'lucide-react';
import { formatBytes, formatDate, formatRelativeTime } from '../../utils/formatters';
import { getFileIcon } from './FileCard';

export default function FileTable({
  files,
  selectedFileIds = [],
  onToggleSelect,
  onSelectAll,
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
  const isAllSelected = files.length > 0 && selectedFileIds.length === files.length;

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <table className="w-full text-left text-xs">
        <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-850 dark:text-slate-400">
          <tr>
            {onToggleSelect && (
              <th className="py-3.5 pl-4 pr-2 w-10">
                <button 
                  onClick={onSelectAll}
                  className="flex items-center text-slate-500 hover:text-indigo-600 cursor-pointer"
                >
                  {isAllSelected ? (
                    <CheckSquare className="h-4 w-4 text-indigo-600" />
                  ) : (
                    <Square className="h-4 w-4" />
                  )}
                </button>
              </th>
            )}
            <th className="py-3.5 pl-4 pr-2">Name</th>
            <th className="px-3 py-3.5">Owner</th>
            <th className="px-3 py-3.5">Visibility</th>
            <th className="px-3 py-3.5">Size</th>
            <th className="px-3 py-3.5">Modified</th>
            <th className="px-3 py-3.5">Drive / OCR</th>
            <th className="py-3.5 pl-3 pr-4 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
          {files.map((file) => {
            const isSelected = selectedFileIds.includes(file.id);
            return (
              <tr
                key={file.id}
                className={`group transition hover:bg-slate-50/80 dark:hover:bg-slate-800/40 ${
                  isSelected ? 'bg-indigo-50/40 dark:bg-indigo-950/20' : ''
                }`}
              >
                {/* Select Checkbox */}
                {onToggleSelect && (
                  <td className="py-3 pl-4 pr-2">
                    <button 
                      onClick={() => onToggleSelect(file.id)}
                      className="flex items-center text-slate-400 hover:text-indigo-600 cursor-pointer"
                    >
                      {isSelected ? (
                        <CheckSquare className="h-4 w-4 text-indigo-600" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )}
                    </button>
                  </td>
                )}

                {/* Name & Star */}
                <td className="py-3 pl-4 pr-2">
                  <div className="flex items-center gap-3">
                    {!isTrash && (
                      <button
                        onClick={() => onToggleStar && onToggleStar(file)}
                        className={`p-1 transition cursor-pointer ${
                          file.is_starred
                            ? 'text-amber-500'
                            : 'text-slate-300 hover:text-amber-500 dark:text-slate-600'
                        }`}
                      >
                        <Star className={`h-3.5 w-3.5 ${file.is_starred ? 'fill-amber-400 text-amber-500' : ''}`} />
                      </button>
                    )}
                    <div 
                      onClick={() => !isTrash && onPreview(file)}
                      className="flex cursor-pointer items-center gap-2.5"
                    >
                      {getFileIcon(file.file_type, "h-5 w-5")}
                      <span className="font-semibold text-slate-800 hover:text-indigo-600 dark:text-slate-200 dark:hover:text-indigo-400 max-w-xs truncate" title={file.name}>
                        {file.name}
                      </span>
                      {file.version > 1 && (
                        <span 
                          onClick={(e) => { e.stopPropagation(); onVersionHistory && onVersionHistory(file); }}
                          className="rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700 hover:underline dark:bg-indigo-950/60 dark:text-indigo-300"
                        >
                          v{file.version}
                        </span>
                      )}
                    </div>
                  </div>
                </td>

                {/* Owner */}
                <td className="px-3 py-3 text-slate-600 dark:text-slate-400">
                  {file.owner_name || 'Mrs. P. Devika'}
                </td>

                {/* Visibility */}
                <td className="px-3 py-3">
                  {file.visibility === 'private' ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 dark:bg-amber-950/60 border border-amber-200/70 dark:border-amber-800/80 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                      <Lock className="h-2.5 w-2.5" /> Private
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/70 dark:border-emerald-800/80 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                      <Globe className="h-2.5 w-2.5" /> Public
                    </span>
                  )}
                </td>

                {/* Size */}
                <td className="px-3 py-3 font-medium text-slate-500">
                  {formatBytes(file.size)}
                </td>

                {/* Modified */}
                <td className="px-3 py-3 text-slate-500">
                  {formatRelativeTime(file.created_at)}
                </td>

                {/* Drive / OCR */}
                <td className="px-3 py-3">
                  <div className="flex items-center gap-1.5">
                    {file.drive_link && (
                      <a
                        href={file.drive_link}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 rounded-md bg-blue-50 dark:bg-blue-950/60 border border-blue-200 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 dark:text-blue-300 hover:bg-blue-100"
                      >
                        <ExternalLink className="h-2.5 w-2.5" />
                        Drive
                      </a>
                    )}
                    {file.ocr_status === 'completed' && (
                      <span className="flex items-center gap-1 rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                        <Sparkles className="h-2.5 w-2.5" />
                        OCR
                      </span>
                    )}
                  </div>
                </td>

                {/* Actions */}
                <td className="py-3 pl-3 pr-4 text-right">
                  <div className="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100">
                    {!isTrash ? (
                      <>
                        <button
                          onClick={() => onPreview(file)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer"
                          title="Preview"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => onDownload(file)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer"
                          title="Download"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                        {file.file_type === 'pdf' && !file.catalogue_id && onCatalogue && (
                          <button
                            type="button"
                            onClick={() => onCatalogue(file)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-indigo-50 hover:text-indigo-700 dark:hover:bg-indigo-950/50 dark:hover:text-indigo-300"
                            title="Add to student resources"
                          >
                            <BookOpenCheck className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => onShare(file)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer"
                          title="Share"
                        >
                          <Share2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => onDelete(file)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50 dark:hover:text-rose-400 cursor-pointer"
                          title="Move to Trash"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => onRestore(file)}
                          className="flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300"
                        >
                          <History className="h-3.5 w-3.5" />
                          Restore
                        </button>
                        <button
                          onClick={() => onPermanentDelete(file)}
                          className="flex items-center gap-1 rounded-lg bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100 dark:bg-rose-950/60 dark:text-rose-300"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
