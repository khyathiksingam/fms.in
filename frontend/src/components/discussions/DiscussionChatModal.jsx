import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, Lock, X, CheckCircle, Clock, 
  HelpCircle, AlertCircle, RefreshCw 
} from 'lucide-react';
import { apiRequest } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

export default function DiscussionChatModal({ conversation, onClose, onStatusChange }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [replyText, setReplyText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState(conversation?.status || 'open');
  const messagesEndRef = useRef(null);

  const conversationId = conversation?.id;

  const loadMessages = async () => {
    if (!conversationId) return;
    try {
      const data = await apiRequest(`/discussions/${conversationId}/messages`);
      setMessages(Array.isArray(data) ? data : []);
      setError('');
    } catch (err) {
      setError(err.message || 'Could not load messages.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMessages();
    const interval = setInterval(loadMessages, 10000); // 10s polling
    return () => clearInterval(interval);
  }, [conversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendReply = async (e) => {
    e.preventDefault();
    if (!replyText.trim() || sending) return;

    setSending(true);
    setError('');

    try {
      const newMsg = await apiRequest(`/discussions/${conversationId}/reply`, {
        method: 'POST',
        body: { messageBody: replyText.trim() }
      });
      setMessages((prev) => [...prev, newMsg]);
      setReplyText('');
    } catch (err) {
      setError(err.message || 'Failed to send reply.');
    } finally {
      setSending(false);
    }
  };

  const handleToggleStatus = async () => {
    const nextStatus = status === 'resolved' ? 'open' : 'resolved';
    try {
      await apiRequest(`/discussions/${conversationId}/status`, {
        method: 'PATCH',
        body: { status: nextStatus }
      });
      setStatus(nextStatus);
      if (onStatusChange) onStatusChange(conversationId, nextStatus);
    } catch (err) {
      setError(err.message || 'Failed to update status.');
    }
  };

  if (!conversation) return null;

  const isStudent = user?.id === conversation?.student?.id;
  const otherPartyName = isStudent ? conversation?.faculty?.fullName : conversation?.student?.fullName;
  const fileName = conversation?.file?.name || 'Attached File';

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-2 sm:p-5 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div 
        className="flex h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
        role="dialog"
        aria-modal="true"
        aria-labelledby="chat-title"
      >
        {/* Header */}
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="min-w-0 flex-1 mr-3">
            <div className="flex items-center gap-2 mb-0.5">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                status === 'resolved'
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                  : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300'
              }`}>
                {status === 'resolved' ? <CheckCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                {status}
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                with {otherPartyName}
              </span>
            </div>
            <h2 id="chat-title" className="text-sm font-bold text-slate-900 dark:text-white truncate">
              {conversation.subject || 'Student Discussion'}
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              File: {fileName}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleToggleStatus}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold border transition ${
                status === 'resolved'
                  ? 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
              }`}
            >
              {status === 'resolved' ? 'Reopen' : 'Mark Resolved'}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300 transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        {/* Privacy reminder */}
        <div className="flex items-center gap-2 bg-indigo-50/60 dark:bg-indigo-950/30 px-4 py-2 border-b border-indigo-100/50 dark:border-indigo-900/30 text-[11px] text-indigo-900 dark:text-indigo-300">
          <Lock className="h-3.5 w-3.5 shrink-0 text-indigo-600 dark:text-indigo-400" />
          <span>Private discussion · Only you and {otherPartyName} can view or reply.</span>
        </div>

        {/* Message Thread Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/30 dark:bg-slate-950/20">
          {loading ? (
            <div className="flex h-full items-center justify-center text-xs text-slate-400">
              <RefreshCw className="h-4 w-4 animate-spin mr-1.5" /> Loading messages…
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-xs text-slate-400">
              <p>No messages yet.</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMine = msg.sender?.id === user?.id;
              const isFacultyMsg = msg.sender?.role?.name === 'faculty' || msg.sender?.role?.name === 'hod';

              return (
                <div 
                  key={msg.id}
                  className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                >
                  <div className="flex items-center gap-1.5 mb-1 px-1">
                    <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                      {isMine ? 'You' : msg.sender?.fullName || 'Participant'}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {isFacultyMsg ? '· Faculty' : '· Student'}
                    </span>
                    {msg.messageType && msg.messageType !== 'reply' && (
                      <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                        msg.messageType === 'important_question'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                          : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300'
                      }`}>
                        {msg.messageType === 'important_question' ? 'Important Question' : 'Doubt'}
                      </span>
                    )}
                  </div>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs shadow-xs leading-relaxed ${
                    isMine
                      ? 'bg-indigo-600 text-white rounded-tr-xs'
                      : 'bg-white text-slate-900 border border-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100 rounded-tl-xs'
                  }`}>
                    <p className="whitespace-pre-wrap">{msg.messageBody}</p>
                  </div>
                  <span className="text-[9px] text-slate-400 mt-1 px-1">
                    {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Reply input */}
        <form onSubmit={handleSendReply} className="border-t border-slate-200 p-3 bg-white dark:border-slate-800 dark:bg-slate-900">
          {error && (
            <p role="alert" className="mb-2 text-xs text-rose-600 dark:text-rose-400">
              {error}
            </p>
          )}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder={`Reply to ${otherPartyName}…`}
              className="app-input flex-1 text-xs"
              disabled={sending}
              maxLength={5000}
            />
            <button
              type="submit"
              disabled={sending || !replyText.trim()}
              className="btn-primary text-xs shrink-0 inline-flex items-center gap-1.5"
            >
              <Send className="h-3.5 w-3.5" />
              {sending ? 'Sending…' : 'Reply'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
