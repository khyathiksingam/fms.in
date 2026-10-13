import React, { useState, useEffect } from 'react';
import { X, FileText, Sparkles, Share2, Shield, Calendar, User, Building2, HardDrive, Hash, Check, ExternalLink } from 'lucide-react';
import { formatBytes, formatDate } from '../../utils/formatters';
import { api } from '../../utils/api';
import { getFileIcon } from './FileCard';

export default function FileDetailsDrawer({ isOpen, onClose, file }) {
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && file) {
      loadDetails();
    }
  }, [isOpen, file]);

  const loadDetails = async () => {
    setLoading(true);
    try {
      const data = await api.get(`/files/${file.id}`);
      setDetails(data);
    } catch (err) {
      console.warn('Failed to load file details:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !file) return null;

  const f = details?.file || file;
  const shares = details?.shares || [];
  const versions = details?.versions || [];

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 text-left">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 p-4 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-400">
            {getFileIcon(f.file_type, "h-4 w-4")}
          </div>
          <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate max-w-[240px]">
            File Details
          </h3>
        </div>
        <button
          onClick={onClose}
          className="rounded-full p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Drawer Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {/* Name & Basic Badge */}
        <div>
          <h4 className="font-bold text-base text-slate-900 dark:text-slate-100 break-words">
            {f.name}
          </h4>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="rounded-md bg-brand-50 px-2 py-0.5 text-[11px] font-semibold uppercase text-brand-700 dark:bg-brand-950 dark:text-brand-300">
              {f.file_type}
            </span>
            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              v{f.version || 1}
            </span>
            {f.ocr_status === 'completed' && (
              <span className="flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                <Sparkles className="h-3 w-3" />
                OCR Indexed
              </span>
            )}
          </div>
        </div>

        {/* Google Drive / Docs Direct Link */}
        {f.drive_link && (
          <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4 dark:border-blue-900/60 dark:bg-blue-950/40">
            <div className="flex items-center justify-between">
              <div>
                <h5 className="font-bold text-xs text-blue-900 dark:text-blue-200">
                  Google Drive / Docs Document
                </h5>
                <p className="text-[11px] text-blue-700 dark:text-blue-400 mt-0.5">
                  Official synced cloud document
                </p>
              </div>
              <a
                href={f.drive_link}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition active:scale-95"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span>Open Doc</span>
              </a>
            </div>
          </div>
        )}

        {/* Metadata Properties Grid */}
        <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-850 space-y-2.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 flex items-center gap-1.5">
              <HardDrive className="h-3.5 w-3.5" /> File Size
            </span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {formatBytes(f.size)}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-400 flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" /> Uploaded By
            </span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {f.owner_name || 'Mrs. P. Devika'}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5" /> Department
            </span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {f.department_name || f.department_code || 'CSE'}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" /> Upload Date
            </span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {formatDate(f.created_at)}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Hash className="h-3.5 w-3.5" /> MIME Type
            </span>
            <span className="font-mono text-[11px] text-slate-600 dark:text-slate-400">
              {f.mime_type}
            </span>
          </div>
        </div>

        {/* Sharing Information */}
        <div>
          <h5 className="font-bold text-xs text-slate-900 dark:text-slate-100 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Share2 className="h-3.5 w-3.5 text-brand-600" />
            Sharing Details
          </h5>
          {shares.length === 0 ? (
            <p className="text-xs text-slate-400 italic">Not shared with any external departments.</p>
          ) : (
            <div className="space-y-1.5">
              {shares.map(s => (
                <div key={s.id} className="flex items-center justify-between rounded-xl bg-slate-50 p-2 text-xs dark:bg-slate-800">
                  <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                    {s.shared_with_department_name ? `${s.shared_with_department_name} Dept` : s.shared_with_user_name}
                  </span>
                  <span className="rounded bg-brand-100 px-1.5 py-0.2 text-[10px] font-bold text-brand-700 dark:bg-brand-950 dark:text-brand-300 capitalize">
                    {s.permission === 'view_download' ? 'View & Download' : s.permission}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* OCR Extracted Text Preview Section */}
        {f.extracted_text && (
          <div>
            <h5 className="font-bold text-xs text-slate-900 dark:text-slate-100 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
              OCR Text Content
            </h5>
            <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono text-[11px] leading-relaxed text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 whitespace-pre-wrap">
              {f.extracted_text}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
