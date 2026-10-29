import React from 'react';
import { BookOpen, CalendarDays, Download, Eye, FileText, Layers3 } from 'lucide-react';

export default function SyllabusSubjectCard({ record, onPreview, onDownload }) {
  const isPdf = record.file_name?.toLowerCase().endsWith('.pdf') || record.mime_type === 'application/pdf';
  return (
    <article className="syllabus-subject-card app-card p-4">
      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-lg bg-blue-50 px-2 py-1 text-xs font-bold text-blue-900 dark:bg-blue-950/60 dark:text-blue-200">{record.subject_code}</span>
            <span className={`rounded-lg px-2 py-1 text-[10px] font-bold uppercase ${record.resource_type === 'faculty_note' ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200' : 'bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200'}`}>{record.resource_type === 'faculty_note' ? 'Faculty Note' : 'Syllabus'}</span>
            {isPdf && <span className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-[10px] font-bold uppercase text-rose-800 shadow-sm dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-200"><FileText className="h-3 w-3" /> PDF</span>}
          </div>
          <h3 className="mt-2 break-words text-base font-bold text-slate-900 dark:text-white">{record.subject_name}</h3>
        </div>
        <div className="flex flex-wrap gap-2 sm:shrink-0">
          {isPdf ? (
            <button type="button" onClick={() => onPreview(record)} className="btn-secondary text-xs min-h-10 flex-1 sm:flex-none">
              <Eye className="h-4 w-4" /> Preview
            </button>
          ) : (
            <span className="self-center text-xs text-slate-500">Preview unavailable</span>
          )}
          <button type="button" onClick={() => onDownload(record)} className="btn-primary text-xs min-h-10 flex-1 sm:flex-none">
            <Download className="h-4 w-4" /> Download
          </button>
        </div>
      </div>
      <div className="mt-4 grid gap-2 text-xs text-slate-600 sm:grid-cols-2 dark:text-slate-400">
        <span className="inline-flex items-center gap-2"><Layers3 className="h-3.5 w-3.5" /> {record.program} · {record.regulation} · Semester {record.semester}</span>
        <span className="inline-flex items-center gap-2"><BookOpen className="h-3.5 w-3.5" /> {record.branch_code}{record.department_name ? ` · ${record.department_name}` : ''}</span>
        <span className="inline-flex items-center gap-2"><CalendarDays className="h-3.5 w-3.5" /> Academic year {record.academic_year}</span>
        <span className="inline-flex items-center gap-2"><CalendarDays className="h-3.5 w-3.5" /> Updated {record.updated_at ? new Date(record.updated_at + 'Z').toLocaleDateString() : '—'}</span>
        {record.resource_type === 'faculty_note' && <span className="inline-flex items-center gap-2 sm:col-span-2"><BookOpen className="h-3.5 w-3.5" /> Uploaded by: {record.faculty_uploader_name || 'Faculty'}</span>}
      </div>
      {!isPdf && <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">This file cannot be previewed in your browser. Use Download to open it with a compatible app.</p>}
    </article>
  );
}
