import React, { useState, useEffect } from 'react';
import { 
  X, Download, Share2, ZoomIn, ZoomOut, RotateCw, 
  FileText, Sparkles, FileSpreadsheet, Eye, Info, Check, 
  ExternalLink, Maximize2, Minimize2, Table, Layers, Copy, FileCode,
  Globe, Lock, AlertCircle, RefreshCw
} from 'lucide-react';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { formatBytes, formatDate } from '../../utils/formatters';
import { getToken } from '../../utils/api';

export default function FilePreviewModal({ isOpen, onClose, file, onShare, onDownload }) {
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTab, setActiveTab] = useState('preview'); // 'preview' | 'ocr' | 'raw'
  
  // Word DOCX state
  const [docxHtml, setDocxHtml] = useState('');
  const [docxLoading, setDocxLoading] = useState(false);
  const [docxError, setDocxError] = useState('');
  
  // Excel XLSX state
  const [excelSheets, setExcelSheets] = useState([]);
  const [activeSheetIndex, setActiveSheetIndex] = useState(0);
  const [excelLoading, setExcelLoading] = useState(false);
  const [excelError, setExcelError] = useState('');

  // Plain Text / Code state
  const [textContent, setTextContent] = useState('');
  const [textLoading, setTextLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Image load error state
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setZoom(100);
    setRotation(0);
    setActiveTab('preview');
    setDocxHtml('');
    setDocxError('');
    setExcelSheets([]);
    setExcelError('');
    setTextContent('');
    setCopied(false);
    setImgError(false);

    if (!file) return;

    const lowerName = file.name.toLowerCase();

    // 1. If Word document (.docx, .doc)
    if (lowerName.endsWith('.docx') || lowerName.endsWith('.doc') || file.mime_type?.includes('wordprocessingml')) {
      loadDocxPreview();
    }
    // 2. If Excel document (.xlsx, .xls, .csv)
    else if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls') || lowerName.endsWith('.csv') || file.file_type === 'spreadsheet') {
      loadExcelPreview();
    }
    // 3. If Text, Markdown, JSON, Code
    else if (
      lowerName.endsWith('.txt') || lowerName.endsWith('.md') || lowerName.endsWith('.json') || 
      lowerName.endsWith('.js') || lowerName.endsWith('.py') || lowerName.endsWith('.sql') || 
      lowerName.endsWith('.html') || lowerName.endsWith('.css') || file.mime_type?.startsWith('text/')
    ) {
      loadTextPreview();
    }
  }, [file]);

  if (!isOpen || !file) return null;

  const token = getToken();
  const previewUrl = `/api/files/${file.id}/preview?token=${token || ''}`;
  const lowerName = file.name.toLowerCase();

  const isDocx = lowerName.endsWith('.docx') || lowerName.endsWith('.doc') || file.mime_type?.includes('wordprocessingml');
  const isExcel = lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls') || lowerName.endsWith('.csv') || file.file_type === 'spreadsheet';
  const isImage = file.file_type === 'image' || file.mime_type?.startsWith('image/');
  const isPdf = file.file_type === 'pdf' || file.mime_type === 'application/pdf' || lowerName.endsWith('.pdf');
  const isVideo = file.file_type === 'video' || file.mime_type?.startsWith('video/') || lowerName.endsWith('.mp4') || lowerName.endsWith('.mov') || lowerName.endsWith('.avi');
  const isAudio = file.file_type === 'audio' || file.mime_type?.startsWith('audio/') || lowerName.endsWith('.mp3') || lowerName.endsWith('.wav');
  const isText = isDocx ? false : (file.mime_type?.startsWith('text/') || lowerName.endsWith('.txt') || lowerName.endsWith('.md') || lowerName.endsWith('.json') || lowerName.endsWith('.js') || lowerName.endsWith('.py') || lowerName.endsWith('.sql'));

  const handleDownloadClick = () => {
    if (onDownload) {
      onDownload(file);
    } else {
      const link = document.createElement('a');
      link.href = `/api/files/${file.id}/download?token=${token || ''}`;
      link.download = file.name || file.original_name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleShareClick = () => {
    if (onShare) {
      onShare(file);
    }
  };

  const loadDocxPreview = async () => {
    setDocxLoading(true);
    setDocxError('');
    try {
      const res = await fetch(previewUrl);
      if (!res.ok) throw new Error('Could not fetch Word file.');
      const arrayBuffer = await res.arrayBuffer();
      
      const result = await mammoth.convertToHtml({ arrayBuffer });
      setDocxHtml(result.value);
    } catch (e) {
      console.warn('Docx conversion error:', e);
      setDocxError('Could not render live preview for this Word file directly.');
    } finally {
      setDocxLoading(false);
    }
  };

  const loadExcelPreview = async () => {
    setExcelLoading(true);
    setExcelError('');
    try {
      const res = await fetch(previewUrl);
      if (!res.ok) throw new Error('Could not fetch Spreadsheet file.');
      const arrayBuffer = await res.arrayBuffer();
      
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const sheetDataList = workbook.SheetNames.map(sheetName => {
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        return {
          name: sheetName,
          data: jsonData
        };
      });

      setExcelSheets(sheetDataList);
      setActiveSheetIndex(0);
    } catch (e) {
      console.warn('Excel conversion error:', e);
      setExcelError('Could not parse spreadsheet data.');
    } finally {
      setExcelLoading(false);
    }
  };

  const loadTextPreview = async () => {
    setTextLoading(true);
    try {
      const res = await fetch(previewUrl);
      const text = await res.text();
      setTextContent(text);
    } catch (e) {
      console.warn('Text preview error:', e);
    } finally {
      setTextLoading(false);
    }
  };

  const handleCopyText = (content) => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleZoomIn = () => setZoom(prev => Math.min(250, prev + 25));
  const handleZoomOut = () => setZoom(prev => Math.max(50, prev - 25));
  const handleRotate = () => setRotation(prev => (prev + 90) % 360);

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md transition-all duration-200 ${
      isFullscreen ? 'p-0' : 'p-2 sm:p-4 md:p-6'
    }`}>
      <div className={`relative flex flex-col border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 transition-all duration-300 overflow-hidden ${
        isFullscreen ? 'h-screen w-screen rounded-none' : 'h-[94vh] w-full max-w-6xl rounded-3xl'
      }`}>
        
        {/* Top Header & Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/90 px-4 sm:px-6 py-3 dark:border-slate-800 dark:bg-slate-850">
          <div className="flex items-center gap-3 min-w-0">
            <div className="min-w-0 text-left">
              <div className="flex items-center gap-2">
                <h3 className="truncate font-extrabold text-sm sm:text-base text-slate-900 dark:text-slate-100" title={file.name}>
                  {file.name}
                </h3>
                {file.visibility === 'private' ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                    <Lock className="h-2.5 w-2.5" /> Private
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    <Globe className="h-2.5 w-2.5" /> Public
                  </span>
                )}
                {isDocx && (
                  <span className="inline-flex items-center rounded-md bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                    Word Doc
                  </span>
                )}
                {isExcel && (
                  <span className="inline-flex items-center rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                    Spreadsheet
                  </span>
                )}
                {isPdf && (
                  <span className="inline-flex items-center rounded-md bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                    PDF
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {formatBytes(file.size)} • Uploaded by {file.owner_name || 'Mrs. P. Devika'} • {formatDate(file.created_at)}
              </p>
            </div>
          </div>

          {/* Center Tabs: Interactive Preview vs OCR Search Text */}
          <div className="flex items-center gap-1 rounded-xl bg-slate-200/60 p-1 dark:bg-slate-800">
            <button
              onClick={() => setActiveTab('preview')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold transition cursor-pointer ${
                activeTab === 'preview'
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              <Eye className="h-3.5 w-3.5" />
              <span>Original Preview</span>
            </button>

            {file.extracted_text && (
              <button
                onClick={() => setActiveTab('ocr')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold transition cursor-pointer ${
                  activeTab === 'ocr'
                    ? 'bg-white text-indigo-900 shadow-sm dark:bg-slate-700 dark:text-indigo-300'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
                <span>Extracted Text</span>
              </button>
            )}
          </div>

          {/* Right Action Tools */}
          <div className="flex items-center gap-2">
            {/* Direct Google Drive/Docs Link */}
            {file.drive_link && (
              <a
                href={file.drive_link}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span>Open in Drive</span>
              </a>
            )}

            {/* Image zoom / rotate toolbar */}
            {isImage && activeTab === 'preview' && (
              <div className="hidden sm:flex items-center gap-1 border-r border-slate-200 pr-2 mr-1 dark:border-slate-800">
                <button
                  onClick={handleZoomOut}
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-800 cursor-pointer"
                  title="Zoom Out"
                >
                  <ZoomOut className="h-4 w-4" />
                </button>
                <span className="text-xs font-mono text-slate-500 px-1">{zoom}%</span>
                <button
                  onClick={handleZoomIn}
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-800 cursor-pointer"
                  title="Zoom In"
                >
                  <ZoomIn className="h-4 w-4" />
                </button>
                <button
                  onClick={handleRotate}
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-800 cursor-pointer"
                  title="Rotate 90°"
                >
                  <RotateCw className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Fullscreen Toggle */}
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="rounded-xl border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>

            {/* Share */}
            {onShare && (
              <button
                onClick={handleShareClick}
                className="rounded-xl border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
                title="Share Document"
              >
                <Share2 className="h-4 w-4" />
              </button>
            )}

            {/* Download */}
            <button
              onClick={handleDownloadClick}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-700 via-indigo-600 to-blue-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-md shadow-indigo-500/20 hover:from-blue-800 hover:to-indigo-700 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download</span>
            </button>

            {/* Close */}
            <button
              onClick={onClose}
              className="rounded-full p-1.5 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content Viewer Body */}
        <div className="relative flex-1 overflow-auto bg-slate-100/80 dark:bg-slate-950 p-3 sm:p-6 flex items-center justify-center">
          
          {/* TAB 1: OCR Text Tab */}
          {activeTab === 'ocr' ? (
            <div className="h-full w-full max-w-4xl rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900 text-left overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/70 dark:text-indigo-400">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                      OCR Extracted & Search-Indexed Content
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      This text was recognized inside the document and is indexed in the global search.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => handleCopyText(file.extracted_text || '')}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy Text'}</span>
                </button>
              </div>

              <pre className="mt-6 whitespace-pre-wrap font-mono text-xs sm:text-sm leading-relaxed text-slate-700 dark:text-slate-300 select-text">
                {file.extracted_text || 'No text could be extracted from this document.'}
              </pre>
            </div>
          ) : (
            /* TAB 2: ORIGINAL NATIVE PREVIEWS */
            <div className="flex h-full w-full items-center justify-center">

              {/* 1. WORD DOCUMENT (.DOCX, .DOC) LIVE FORMATTED PREVIEW */}
              {isDocx ? (
                docxLoading ? (
                  <div className="flex flex-col items-center gap-3 text-slate-400 animate-pulse">
                    <FileText className="h-10 w-10 text-indigo-500" />
                    <p className="text-xs font-bold">Rendering Word Document...</p>
                  </div>
                ) : docxHtml ? (
                  <div className="h-full w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-6 sm:p-12 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-left">
                    <div 
                      className="prose dark:prose-invert max-w-none text-slate-900 dark:text-slate-100 text-sm leading-relaxed 
                        [&_h1]:text-2xl [&_h1]:font-extrabold [&_h1]:mb-4 [&_h1]:text-slate-900 dark:[&_h1]:text-white
                        [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-6 [&_h2]:mb-3
                        [&_p]:my-2.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5
                        [&_table]:w-full [&_table]:border-collapse [&_table]:my-4
                        [&_td]:border [&_td]:border-slate-300 dark:[&_td]:border-slate-700 [&_td]:p-2
                        [&_th]:border [&_th]:border-slate-300 dark:[&_th]:border-slate-700 [&_th]:p-2 [&_th]:bg-slate-100 dark:[&_th]:bg-slate-800"
                      dangerouslySetInnerHTML={{ __html: docxHtml }}
                    />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-lg dark:border-slate-800 dark:bg-slate-900 max-w-md">
                    <FileText className="h-12 w-12 text-blue-500" />
                    <h4 className="mt-3 font-bold text-base">{file.name}</h4>
                    <p className="mt-1 text-xs text-slate-400">Microsoft Word Document</p>
                    <button
                      onClick={handleDownloadClick}
                      className="mt-4 flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-blue-700 cursor-pointer"
                    >
                      <Download className="h-4 w-4" />
                      <span>Download Document</span>
                    </button>
                  </div>
                )
              ) : isExcel ? (
                /* 2. EXCEL SPREADSHEET (.XLSX, .XLS, .CSV) INTERACTIVE TABULAR GRID */
                excelLoading ? (
                  <div className="flex flex-col items-center gap-3 text-slate-400 animate-pulse">
                    <FileSpreadsheet className="h-10 w-10 text-emerald-500" />
                    <p className="text-xs font-bold">Parsing Spreadsheet...</p>
                  </div>
                ) : excelSheets.length > 0 ? (
                  <div className="flex h-full w-full flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 overflow-hidden text-left">
                    {/* Sheet Tabs */}
                    {excelSheets.length > 1 && (
                      <div className="flex items-center gap-1 border-b border-slate-200 bg-slate-50 px-4 py-2 dark:border-slate-800 dark:bg-slate-850 overflow-x-auto">
                        <Layers className="h-4 w-4 text-slate-400 mr-2" />
                        {excelSheets.map((sheet, sIdx) => (
                          <button
                            key={sIdx}
                            onClick={() => setActiveSheetIndex(sIdx)}
                            className={`rounded-lg px-3 py-1 text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                              activeSheetIndex === sIdx
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'text-slate-600 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-800'
                            }`}
                          >
                            {sheet.name}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Table Grid */}
                    <div className="flex-1 overflow-auto">
                      <table className="w-full text-left text-xs border-collapse font-mono">
                        <tbody>
                          {excelSheets[activeSheetIndex]?.data.map((row, rIdx) => (
                            <tr 
                              key={rIdx} 
                              className={`border-b border-slate-100 dark:border-slate-800/80 ${
                                rIdx === 0 
                                  ? 'bg-slate-100 font-bold text-slate-800 dark:bg-slate-800 dark:text-slate-100 sticky top-0 z-10' 
                                  : 'hover:bg-slate-50/80 dark:hover:bg-slate-850/60'
                              }`}
                            >
                              <td className="w-12 border-r border-slate-200 bg-slate-100/70 p-2 text-center text-[10px] text-slate-400 dark:border-slate-800 dark:bg-slate-850">
                                {rIdx + 1}
                              </td>
                              {row.map((cell, cIdx) => (
                                <td 
                                  key={cIdx} 
                                  className="border-r border-slate-100 px-3 py-2 text-slate-700 dark:border-slate-800/60 dark:text-slate-300 whitespace-nowrap"
                                >
                                  {cell !== null && cell !== undefined ? String(cell) : ''}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-lg dark:border-slate-800 dark:bg-slate-900 max-w-md">
                    <FileSpreadsheet className="h-12 w-12 text-emerald-500" />
                    <h4 className="mt-3 font-bold text-base">{file.name}</h4>
                    <p className="mt-1 text-xs text-slate-400">Spreadsheet Document</p>
                    <button
                      onClick={handleDownloadClick}
                      className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-emerald-700 cursor-pointer"
                    >
                      <Download className="h-4 w-4" />
                      <span>Download Spreadsheet</span>
                    </button>
                  </div>
                )
              ) : isPdf ? (
                /* 3. PDF DOCUMENT PREVIEW */
                <iframe
                  src={`${previewUrl}#toolbar=1&navpanes=1`}
                  title={file.name}
                  className="h-full w-full rounded-2xl border-0 bg-white shadow-md"
                />
              ) : isImage ? (
                /* 4. IMAGE HD VIEWER */
                <div className="overflow-auto max-h-full max-w-full flex items-center justify-center p-4">
                  {!imgError ? (
                    <img
                      src={previewUrl}
                      alt={file.name}
                      onError={() => setImgError(true)}
                      style={{
                        transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                        transition: 'transform 0.2s ease-in-out'
                      }}
                      className="max-h-[78vh] max-w-full rounded-2xl object-contain shadow-2xl ring-1 ring-black/10"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl dark:border-slate-800 dark:bg-slate-900 max-w-md">
                      <AlertCircle className="h-12 w-12 text-amber-500 mb-2" />
                      <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">
                        Image Preview Restricted or Processing
                      </h4>
                      <p className="text-xs text-slate-400 mt-1 mb-4">
                        This image may be private or saved in a secure departmental format.
                      </p>
                      <button
                        onClick={handleDownloadClick}
                        className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-indigo-700 cursor-pointer"
                      >
                        <Download className="h-4 w-4" />
                        <span>Download Image</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : isVideo ? (
                /* 5. HTML5 VIDEO PLAYER */
                <div className="flex h-full w-full items-center justify-center p-4">
                  <video
                    controls
                    autoPlay
                    src={previewUrl}
                    className="max-h-[78vh] max-w-full rounded-3xl shadow-2xl ring-1 ring-black/20"
                  >
                    Your browser does not support HTML5 video.
                  </video>
                </div>
              ) : isAudio ? (
                /* 6. HTML5 AUDIO PLAYER */
                <div className="flex flex-col items-center justify-center rounded-3xl border border-slate-200 bg-white p-10 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
                  <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/70 dark:text-indigo-400 shadow-inner">
                    <FileText className="h-10 w-10" />
                  </div>
                  <h4 className="font-bold text-base text-slate-900 dark:text-slate-100 mb-2">
                    {file.name}
                  </h4>
                  <audio controls src={previewUrl} className="w-80 mt-3" />
                </div>
              ) : isText ? (
                /* 7. PLAIN TEXT / CODE VIEWER */
                <div className="flex h-full w-full flex-col rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900 overflow-hidden text-left">
                  <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-2 dark:border-slate-800 dark:bg-slate-850">
                    <span className="font-mono text-xs text-slate-500">Source Document</span>
                    <button
                      onClick={() => handleCopyText(textContent)}
                      className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                    >
                      {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                      <span>{copied ? 'Copied' : 'Copy Content'}</span>
                    </button>
                  </div>
                  <pre className="flex-1 overflow-auto p-4 font-mono text-xs text-slate-800 dark:text-slate-200 leading-relaxed select-text">
                    {textLoading ? 'Loading content...' : textContent || 'Empty document.'}
                  </pre>
                </div>
              ) : (
                /* 8. ARCHIVE / GENERIC FILE DOWNLOAD */
                <div className="flex flex-col items-center justify-center rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-xl dark:border-slate-800 dark:bg-slate-900 max-w-md">
                  <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-orange-50 text-orange-600 dark:bg-orange-950/70 dark:text-orange-400 shadow-inner">
                    <FileText className="h-10 w-10" />
                  </div>
                  <h4 className="font-bold text-base text-slate-900 dark:text-slate-100">
                    {file.name}
                  </h4>
                  <p className="mt-1 text-xs text-slate-400">
                    {formatBytes(file.size)} • {file.mime_type || 'Binary Package / Archive'}
                  </p>
                  <p className="mt-2 text-xs text-slate-500 max-w-xs">
                    This file format is packaged for download. Click below to save it to your device.
                  </p>
                  <button
                    onClick={handleDownloadClick}
                    className="mt-6 flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-700 via-indigo-600 to-blue-600 px-6 py-2.5 text-xs font-bold text-white shadow-md shadow-indigo-500/25 hover:from-blue-800 hover:to-indigo-700 cursor-pointer active:scale-95"
                  >
                    <Download className="h-4 w-4" />
                    <span>Download File ({formatBytes(file.size)})</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
