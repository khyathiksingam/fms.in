import React, { useState, useRef } from 'react';
import { Upload, X, File, CheckCircle2, AlertCircle, Trash2, Globe, Lock } from 'lucide-react';
import { formatBytes } from '../../utils/formatters';
import { getToken } from '../../utils/api';

export default function FileUploadModal({ isOpen, onClose, onUploadComplete, currentFolderId, currentDeptId }) {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [visibility, setVisibility] = useState('public'); // 'public' | 'private'
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState(null); // 'success' | 'error' | null
  const [errorMessage, setErrorMessage] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);

  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleFileSelection = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setSelectedFiles(prev => [...prev, ...files]);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length > 0) {
      setSelectedFiles(prev => [...prev, ...files]);
    }
  };

  const removeSelectedFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUploadSubmit = async () => {
    if (selectedFiles.length === 0) return;

    // Check individual file size against 1GB limit (1024 * 1024 * 1024)
    const MAX_SIZE = 1024 * 1024 * 1024;
    const oversizedFile = selectedFiles.find(f => f.size > MAX_SIZE);
    if (oversizedFile) {
      setErrorMessage(`File "${oversizedFile.name}" exceeds the maximum upload limit of 1 GB.`);
      setUploadStatus('error');
      return;
    }

    setUploading(true);
    setProgress(15);
    setErrorMessage('');

    try {
      const formData = new FormData();
      selectedFiles.forEach(file => {
        formData.append('files', file);
      });

      formData.append('visibility', visibility);

      if (currentFolderId) {
        formData.append('folder_id', currentFolderId);
      }
      if (currentDeptId) {
        formData.append('department_id', currentDeptId);
      }

      // Progress animation
      const progressTimer = setInterval(() => {
        setProgress(prev => {
          if (prev >= 85) {
            clearInterval(progressTimer);
            return prev;
          }
          return prev + 15;
        });
      }, 150);

      const token = getToken();
      const res = await fetch('/api/files/upload', {
        method: 'POST',
        headers: {
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: formData
      });

      clearInterval(progressTimer);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Upload failed.');
      }

      setProgress(100);
      setUploadStatus('success');

      setTimeout(() => {
        onUploadComplete && onUploadComplete(data.files);
        handleClose();
      }, 800);
    } catch (err) {
      setErrorMessage(err.message || 'An error occurred during file upload.');
      setUploadStatus('error');
      setUploading(false);
      setProgress(0);
    }
  };

  const handleClose = () => {
    if (uploading) return;
    setSelectedFiles([]);
    setVisibility('public');
    setUploading(false);
    setProgress(0);
    setUploadStatus(null);
    setErrorMessage('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
        onClick={handleClose}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl transition-all dark:border-slate-800 dark:bg-slate-900 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Upload Documents
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Upload syllabi, exam papers, research files, or media (Up to 1 GB)
            </p>
          </div>
          <button
            onClick={handleClose}
            disabled={uploading}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Dropzone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current && fileInputRef.current.click()}
          className={`mt-4 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition-colors cursor-pointer ${
            isDragOver
              ? 'border-indigo-500 bg-indigo-50/60 dark:border-indigo-500 dark:bg-indigo-950/30'
              : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50/60 dark:border-slate-700 dark:hover:border-indigo-600 dark:hover:bg-slate-850'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileSelection}
            className="hidden"
          />
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/70 dark:text-indigo-400">
            <Upload className="h-7 w-7" />
          </div>
          <p className="mt-3 font-semibold text-sm text-slate-800 dark:text-slate-200">
            Drag and drop files here, or <span className="text-indigo-600 dark:text-indigo-400 underline font-bold">Browse</span>
          </p>
          <p className="mt-1 text-xs font-medium text-slate-400 dark:text-slate-500">
            PDF, DOCX, XLSX, PPTX, JPG, PNG, CSV, MP4, MP3, ZIP up to 1 GB
          </p>
        </div>

        {/* Visibility Permission Selector */}
        <div className="mt-4 space-y-1.5">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
            Document Privacy & Visibility:
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Public Option */}
            <div
              onClick={() => !uploading && setVisibility('public')}
              className={`cursor-pointer rounded-2xl border p-3 transition-all ${
                visibility === 'public'
                  ? 'border-indigo-600 bg-indigo-50/80 shadow-xs ring-2 ring-indigo-500/40 dark:border-indigo-500 dark:bg-indigo-950/50'
                  : 'border-slate-200 bg-slate-50/60 hover:bg-slate-100/80 dark:border-slate-800 dark:bg-slate-850/60 dark:hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                  visibility === 'public' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                }`}>
                  <Globe className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-extrabold text-slate-800 dark:text-slate-200">
                    Public (Shared)
                  </div>
                  <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400 leading-tight">
                    Visible to all college faculty
                  </div>
                </div>
              </div>
            </div>

            {/* Private Option */}
            <div
              onClick={() => !uploading && setVisibility('private')}
              className={`cursor-pointer rounded-2xl border p-3 transition-all ${
                visibility === 'private'
                  ? 'border-amber-500 bg-amber-50/80 shadow-xs ring-2 ring-amber-500/40 dark:border-amber-500 dark:bg-amber-950/50'
                  : 'border-slate-200 bg-slate-50/60 hover:bg-slate-100/80 dark:border-slate-800 dark:bg-slate-850/60 dark:hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                  visibility === 'private' ? 'bg-amber-500 text-white shadow-sm' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                }`}>
                  <Lock className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-extrabold text-slate-800 dark:text-slate-200">
                    Private (Confidential)
                  </div>
                  <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400 leading-tight">
                    Visible only to you & Admin
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Selected Files List */}
        {selectedFiles.length > 0 && (
          <div className="mt-4 max-h-40 space-y-2 overflow-y-auto pr-1">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Selected Files ({selectedFiles.length})
            </div>
            {selectedFiles.map((file, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between rounded-xl bg-slate-50 p-2.5 text-xs dark:bg-slate-800/70"
              >
                <div className="flex items-center gap-2 truncate">
                  <File className="h-4 w-4 text-slate-400 flex-shrink-0" />
                  <span className="truncate font-medium text-slate-700 dark:text-slate-300">
                    {file.name}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    ({formatBytes(file.size)})
                  </span>
                </div>
                {!uploading && (
                  <button
                    onClick={(e) => { e.stopPropagation(); removeSelectedFile(idx); }}
                    className="text-slate-400 hover:text-rose-500 cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Upload Progress Bar */}
        {uploading && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-xs font-medium text-slate-700 dark:text-slate-300">
              <span>Uploading {selectedFiles.length} file(s)...</span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full bg-gradient-to-r from-blue-700 via-indigo-600 to-blue-600 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Status Messages */}
        {uploadStatus === 'success' && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            Upload complete! Processing files...
          </div>
        )}

        {uploadStatus === 'error' && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-xs font-medium text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
            <AlertCircle className="h-4 w-4 text-rose-600 flex-shrink-0" />
            {errorMessage}
          </div>
        )}

        {/* Footer Actions */}
        <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
          <button
            onClick={handleClose}
            disabled={uploading}
            className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleUploadSubmit}
            disabled={selectedFiles.length === 0 || uploading}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-700 via-indigo-600 to-blue-600 px-5 py-2 text-xs font-bold text-white shadow-md shadow-indigo-500/25 hover:from-blue-800 hover:to-indigo-700 active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <Upload className="h-4 w-4" />
            <span>{uploading ? 'Uploading...' : `Upload ${selectedFiles.length > 0 ? `(${selectedFiles.length})` : ''}`}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
