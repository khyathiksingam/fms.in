import React, { useEffect, useRef, useState } from 'react';
import { Download, ExternalLink, X } from 'lucide-react';
import { fetchAuthenticatedPdf, setToken } from '../../utils/api';

export default function SyllabusPreviewModal({ record, onClose, onDownload, downloadError }) {
  const dialogRef = useRef(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!record) return undefined;
    const previousFocus = document.activeElement;
    dialogRef.current?.focus();
    const handleKeyDown = event => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Tab' && dialogRef.current) {
        const focusable = [...dialogRef.current.querySelectorAll('a[href], button:not([disabled])')];
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      previousFocus?.focus?.();
    };
  }, [record, onClose]);

  useEffect(() => {
    if (!record) return undefined;
    let objectUrl = '';
    let active = true;
    fetchAuthenticatedPdf(`/public/syllabus/${record.id}/preview`).then(blob => {
      objectUrl = URL.createObjectURL(blob);
      if (active) setPreviewUrl(objectUrl);
    }).catch(err => {
      if (err.status === 401) setToken(null);
      if (active) setError(err.message);
    });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setPreviewUrl('');
      setError('');
    };
  }, [record]);

  if (!record) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-2 backdrop-blur-sm sm:p-5" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}>
      <section ref={dialogRef} tabIndex="-1" className="flex h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900" role="dialog" aria-modal="true" aria-labelledby="syllabus-preview-title">
        <header className="flex items-center justify-between gap-4 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <div className="min-w-0">
            <h2 id="syllabus-preview-title" className="truncate font-bold text-slate-900 dark:text-white">{record.subject_code} — {record.subject_name}</h2>
            <p className="text-xs text-slate-500">{record.program} · {record.branch_code} · Semester {record.semester} · {record.regulation}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {previewUrl && <a href={previewUrl} target="_blank" rel="noreferrer" className="hidden items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 sm:inline-flex dark:border-slate-700 dark:text-slate-200">
              <ExternalLink className="h-4 w-4" /> Open PDF
            </a>}
            <button type="button" onClick={() => onDownload(record)} className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white">
              <Download className="h-4 w-4" /><span className="hidden sm:inline">Download</span>
            </button>
            <button type="button" onClick={onClose} aria-label="Close PDF preview" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-5 w-5" /></button>
          </div>
        </header>
        {downloadError && <p role="alert" className="border-b border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-200">{downloadError}</p>}
        {error ? <div role="alert" className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-sm text-rose-700 dark:text-rose-300"><p>{error}</p>{error.includes('session expired') && <a href={`/student-login?resourceId=${encodeURIComponent(record.id)}&action=preview`} className="rounded-xl bg-[#16265C] px-4 py-2 font-bold text-white">Sign in again</a>}</div>
          : previewUrl ? <iframe title={`${record.subject_name} PDF preview`} src={previewUrl} className="min-h-0 flex-1 bg-slate-100 dark:bg-slate-950" />
            : <p className="flex flex-1 items-center justify-center text-sm text-slate-500">Loading secure preview…</p>}
      </section>
    </div>
  );
}
