import React, { useState } from 'react';
import { HelpCircle, AlertCircle, Lock, Send, X, CheckCircle2 } from 'lucide-react';
import { apiRequest } from '../../utils/api';

export default function AskDoubtModal({ file, initialType = 'doubt', onClose, onSuccess }) {
  const [messageType, setMessageType] = useState(initialType);
  const [subject, setSubject] = useState('');
  const [messageBody, setMessageBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  if (!file) return null;

  const fileId = file.file_id || file.id;
  const fileName = file.file_name || file.name || file.original_name || 'Document';
  const facultyName = file.faculty_uploader_name || file.owner_name || 'Faculty Uploader';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!messageBody.trim()) {
      setError('Please provide your doubt or question details.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await apiRequest('/discussions', {
        method: 'POST',
        body: {
          fileId: Number(fileId),
          subject: subject.trim() || `${messageType === 'important_question' ? 'Important Question' : 'Doubt'} regarding ${fileName}`,
          messageType,
          messageBody: messageBody.trim()
        }
      });

      setSubmitted(true);
      if (onSuccess) onSuccess(res);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      setError(err.message || 'Failed to submit your question.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-3 sm:p-5 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div 
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ask-doubt-title"
      >
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
              <HelpCircle className="h-5 w-5" />
            </div>
            <div>
              <h2 id="ask-doubt-title" className="text-base font-bold text-slate-900 dark:text-white">
                {messageType === 'important_question' ? 'Ask an Important Question' : 'Ask a Doubt'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Private discussion with the faculty uploader
              </p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {submitted ? (
          <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Message Sent Successfully!</h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-xs">
              Your message was sent to {facultyName}. You will be notified when they reply.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {/* Privacy notice banner */}
            <div className="flex items-start gap-2.5 rounded-xl border border-indigo-100 bg-indigo-50/70 p-3 text-xs text-indigo-900 dark:border-indigo-900/40 dark:bg-indigo-950/30 dark:text-indigo-200">
              <Lock className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400 mt-0.5" />
              <div>
                <span className="font-bold">Strictly Private Discussion:</span> Only you and <strong>{facultyName}</strong> can view or reply to this conversation. Unrelated students, other faculty, and administrators have no access.
              </div>
            </div>

            {/* Target file info */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-800 dark:bg-slate-800/40">
              <span className="text-slate-400 uppercase tracking-wider text-[10px] font-semibold block">Attached Resource</span>
              <p className="font-semibold text-slate-800 dark:text-slate-200 truncate mt-0.5">{fileName}</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Faculty Uploader: {facultyName}</p>
            </div>

            {/* Message type selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Category
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMessageType('doubt')}
                  className={`flex items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-semibold transition ${
                    messageType === 'doubt'
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:border-indigo-500 dark:bg-indigo-950/60 dark:text-indigo-300 shadow-xs'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  <HelpCircle className="h-4 w-4" /> Academic Doubt
                </button>
                <button
                  type="button"
                  onClick={() => setMessageType('important_question')}
                  className={`flex items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-semibold transition ${
                    messageType === 'important_question'
                      ? 'border-amber-600 bg-amber-50 text-amber-700 dark:border-amber-500 dark:bg-amber-950/60 dark:text-amber-300 shadow-xs'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  <AlertCircle className="h-4 w-4" /> Important Question
                </button>
              </div>
            </div>

            {/* Subject */}
            <div>
              <label htmlFor="doubt-subject" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Topic / Subject (Optional)
              </label>
              <input
                id="doubt-subject"
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={255}
                placeholder="e.g., Query on Chapter 3, Theorem 2.1"
                className="app-input w-full text-xs"
              />
            </div>

            {/* Message Body */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="doubt-body" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Your Question / Doubt <span className="text-rose-500">*</span>
                </label>
                <span className="text-[10px] text-slate-400">{messageBody.length} / 5000</span>
              </div>
              <textarea
                id="doubt-body"
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                maxLength={5000}
                rows={4}
                required
                placeholder="Explain what concept or step you'd like clarification on..."
                className="app-input w-full text-xs py-2 resize-none"
              />
            </div>

            {error && (
              <p role="alert" className="text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 p-2.5 rounded-xl border border-rose-200 dark:border-rose-900">
                {error}
              </p>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="btn-secondary text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !messageBody.trim()}
                className="btn-primary text-xs inline-flex items-center gap-1.5"
              >
                <Send className="h-3.5 w-3.5" />
                {loading ? 'Sending…' : 'Send Question'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
