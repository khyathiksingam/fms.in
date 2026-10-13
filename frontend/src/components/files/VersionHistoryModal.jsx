import React, { useState, useEffect, useRef } from 'react';
import { History, X, Upload, Download, RotateCcw, File, CheckCircle2 } from 'lucide-react';
import { api, getToken } from '../../utils/api';
import { formatBytes, formatDate } from '../../utils/formatters';

export default function VersionHistoryModal({ isOpen, onClose, file, onVersionUpdated }) {
  const [versions, setVersions] = useState([]);
  const [currentVersion, setCurrentVersion] = useState(1);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [note, setNote] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const fileInputRef = useRef(null);

  useEffect(() => {
    if (isOpen && file) {
      loadVersions();
    }
  }, [isOpen, file]);

  const loadVersions = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.get(`/files/${file.id}/versions`);
      setVersions(data.versions || []);
      setCurrentVersion(data.currentVersion || 1);
    } catch (err) {
      setError('Failed to load version history.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !file) return null;

  const handleUploadNewVersion = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      setError('Please select a file to upload as the new version.');
      return;
    }

    setUploading(true);
    setError('');
    setMessage('');

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      if (note.trim()) formData.append('note', note.trim());

      const token = getToken();
      const res = await fetch(`/api/files/${file.id}/versions`, {
        method: 'POST',
        headers: {
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: formData
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to upload version.');

      setMessage(`Version ${data.version} uploaded successfully!`);
      setSelectedFile(null);
      setNote('');
      await loadVersions();
      onVersionUpdated && onVersionUpdated();
    } catch (err) {
      setError(err.message || 'Failed to upload new version.');
    } finally {
      setUploading(false);
    }
  };

  const handleRestoreVersion = async (versionNumber) => {
    try {
      const data = await api.post(`/files/${file.id}/versions/${versionNumber}/restore`);
      setMessage(data.message || `Restored to version ${versionNumber}.`);
      await loadVersions();
      onVersionUpdated && onVersionUpdated();
    } catch (err) {
      setError(err.message || 'Failed to restore version.');
    }
  };

  const handleDownloadVersion = (versionNumber) => {
    const token = getToken();
    window.open(`/api/files/${file.id}/versions/${versionNumber}/download?token=${token || ''}`, '_blank');
  };

  const handleClose = () => {
    setSelectedFile(null);
    setNote('');
    setMessage('');
    setError('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 text-left">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
              <History className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                Version History
              </h3>
              <p className="text-[11px] text-slate-400 truncate max-w-sm">
                {file.name} (Active: v{currentVersion})
              </p>
            </div>
          </div>
          <button onClick={handleClose} className="rounded-full p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="h-5 w-5" />
          </button>
        </div>

        {message && (
          <div className="mt-3 rounded-xl bg-emerald-50 p-2.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
            ✓ {message}
          </div>
        )}

        {error && (
          <div className="mt-3 rounded-xl bg-rose-50 p-2.5 text-xs text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
            {error}
          </div>
        )}

        {/* Upload New Version Form */}
        <form onSubmit={handleUploadNewVersion} className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-850">
          <div className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-2 flex items-center gap-1.5">
            <Upload className="h-3.5 w-3.5 text-brand-600" />
            Upload New Version (v{currentVersion + 1})
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              ref={fileInputRef}
              type="file"
              onChange={(e) => setSelectedFile(e.target.files[0] || null)}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 rounded-xl border border-dashed border-slate-300 bg-white p-2 text-xs font-medium text-slate-700 hover:border-brand-500 hover:bg-brand-50/50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 truncate text-left"
            >
              {selectedFile ? selectedFile.name : '+ Select replacement document file...'}
            </button>

            <input
              type="text"
              placeholder="Revision notes (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:w-48"
            />

            <button
              type="submit"
              disabled={uploading || !selectedFile}
              className="rounded-xl bg-gradient-to-r from-blue-700 via-indigo-600 to-blue-600 px-5 py-2 text-xs font-bold text-white shadow-md shadow-indigo-500/20 hover:from-blue-800 hover:to-indigo-700 transition active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {uploading ? 'Uploading...' : 'Upload'}
            </button>
          </div>
        </form>

        {/* Versions Timeline List */}
        <div className="mt-4 max-h-56 space-y-2 overflow-y-auto pr-1">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            All Preserved Versions ({versions.length})
          </div>

          {versions.map((ver) => {
            const isCurrent = ver.version_number === currentVersion;
            return (
              <div
                key={ver.id}
                className={`flex items-center justify-between rounded-xl p-3 text-xs transition ${
                  isCurrent
                    ? 'border-2 border-brand-500/60 bg-brand-50/60 dark:border-brand-500/40 dark:bg-brand-950/40'
                    : 'border border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-850'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg font-bold ${
                    isCurrent 
                      ? 'bg-brand-600 text-white' 
                      : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                  }`}>
                    v{ver.version_number}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {ver.note || `Version ${ver.version_number}`}
                      </span>
                      {isCurrent && (
                        <span className="rounded-md bg-brand-100 px-1.5 py-0.2 text-[10px] font-bold text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                          CURRENT
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400">
                      Uploaded by {ver.uploader_name} • {formatBytes(ver.size)} • {formatDate(ver.created_at)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleDownloadVersion(ver.version_number)}
                    className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    title="Download this version"
                  >
                    <Download className="h-3 w-3" />
                    Download
                  </button>

                  {!isCurrent && (
                    <button
                      onClick={() => handleRestoreVersion(ver.version_number)}
                      className="flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900"
                      title="Make this the active version"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Restore
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-5 flex justify-end border-t border-slate-100 pt-3 dark:border-slate-800">
          <button
            onClick={handleClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
