import React, { useState, useEffect } from 'react';
import { 
  Search, Sparkles, Filter, FileText, ArrowRight, 
  Download, Eye, Calendar, User, Building2
} from 'lucide-react';
import { api, getToken } from '../utils/api';
import { formatBytes, formatDate, formatRelativeTime } from '../utils/formatters';
import { getFileIcon } from '../components/files/FileCard';
import FilePreviewModal from '../components/files/FilePreviewModal';
import FileShareModal from '../components/files/FileShareModal';
import EmptyState from '../components/common/EmptyState';

export default function SearchResultsPage({ query = '', onPreviewFile }) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fileTypeFilter, setFileTypeFilter] = useState('all');
  const [selectedPreviewFile, setSelectedPreviewFile] = useState(null);
  const [selectedShareFile, setSelectedShareFile] = useState(null);

  useEffect(() => {
    if (query && query.trim()) {
      executeSearch();
    } else {
      setResults([]);
    }
  }, [query, fileTypeFilter]);

  const executeSearch = async () => {
    setLoading(true);
    try {
      const data = await api.get('/search', {
        q: query.trim(),
        file_type: fileTypeFilter
      });
      setResults(data.results || []);
    } catch (err) {
      console.warn('Search execution error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = (file) => {
    const token = getToken();
    window.open(`/api/files/${file.id}/download?token=${token || ''}`, '_blank');
  };

  // Helper to highlight query inside text
  const highlightMatch = (text, q) => {
    if (!text || !q) return text;
    const parts = text.split(new RegExp(`(${q.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === q.toLowerCase() ? (
        <mark key={i} className="bg-amber-200 dark:bg-amber-900/60 dark:text-amber-200 px-0.5 rounded font-bold">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  return (
    <div className="space-y-5 text-left">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3 dark:border-slate-800">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Search className="h-5 w-5 text-brand-600" />
            Search Results for "{query}"
          </h2>
          <p className="text-xs text-slate-400">
            Searched across document filenames, department folders, and scanned OCR contents.
          </p>
        </div>

        {/* Filter Type Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {['all', 'pdf', 'image', 'document', 'spreadsheet'].map(type => (
            <button
              key={type}
              onClick={() => setFileTypeFilter(type)}
              className={`rounded-xl px-3 py-1 text-xs font-semibold uppercase transition ${
                fileTypeFilter === type
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Results List */}
      {loading ? (
        <div className="py-20 text-center text-xs text-slate-400 animate-pulse">
          Searching document contents & OCR index...
        </div>
      ) : results.length === 0 ? (
        <EmptyState
          type="search"
          title={`No files found for "${query}"`}
          description="Try searching with different keywords, course codes, topics, or reset the file type filter."
        />
      ) : (
        <div className="space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Found {results.length} matching document(s)
          </div>

          <div className="grid grid-cols-1 gap-3">
            {results.map((file) => (
              <div
                key={file.id}
                className="group rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-brand-400 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3.5">
                    <div 
                      onClick={() => setSelectedPreviewFile(file)}
                      className="cursor-pointer flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800"
                    >
                      {getFileIcon(file.file_type, "h-6 w-6")}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 
                          onClick={() => setSelectedPreviewFile(file)}
                          className="cursor-pointer font-bold text-sm text-slate-900 hover:text-brand-600 dark:text-slate-100 dark:hover:text-brand-400"
                        >
                          {highlightMatch(file.name, query)}
                        </h4>
                        
                        {/* Match Reason Badge */}
                        {file.ocr_matched ? (
                          <span className="flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                            <Sparkles className="h-3 w-3" />
                            Matched Inside Scanned Document (OCR)
                          </span>
                        ) : (
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            Filename / Metadata Match
                          </span>
                        )}
                      </div>

                      {/* OCR Content Snippet Preview */}
                      {file.snippet && (
                        <div className="mt-2 rounded-xl bg-slate-50 p-2.5 font-mono text-xs text-slate-600 dark:bg-slate-850 dark:text-slate-300">
                          <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">
                            OCR Snippet Match:
                          </span>
                          "{highlightMatch(file.snippet, query)}"
                        </div>
                      )}

                      <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3 w-3" /> {file.department_name || 'General'}
                        </span>
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" /> {file.owner_name || 'Faculty'}
                        </span>
                        <span>{formatBytes(file.size)}</span>
                        <span>{formatDate(file.created_at)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => setSelectedPreviewFile(file)}
                      className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Preview
                    </button>
                    <button
                      onClick={() => handleDownload(file)}
                      className="flex items-center gap-1 rounded-xl bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <FilePreviewModal
        isOpen={Boolean(selectedPreviewFile)}
        file={selectedPreviewFile}
        onClose={() => setSelectedPreviewFile(null)}
        onShare={(f) => { setSelectedPreviewFile(null); setSelectedShareFile(f); }}
        onDownload={handleDownload}
      />

      <FileShareModal
        isOpen={Boolean(selectedShareFile)}
        file={selectedShareFile}
        onClose={() => setSelectedShareFile(null)}
      />
    </div>
  );
}
