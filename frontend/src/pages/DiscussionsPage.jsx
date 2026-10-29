import React, { useState, useEffect } from 'react';
import { 
  HelpCircle, AlertCircle, MessageSquare, CheckCircle, 
  Clock, Search, Lock, User, FileText, ChevronRight, RefreshCw 
} from 'lucide-react';
import { apiRequest } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import DiscussionChatModal from '../components/discussions/DiscussionChatModal';

export default function DiscussionsPage() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // 'all', 'open', 'resolved'
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [error, setError] = useState('');

  const isStudent = user?.role_name === 'student';
  const pageTitle = isStudent ? 'My Doubts & Questions' : 'Student Questions & Doubts';
  const pageSubtitle = isStudent
    ? 'Private discussions with your faculty on uploaded study resources and question papers'
    : 'Direct confidential inquiries from students regarding files and syllabi you uploaded';

  const loadConversations = async () => {
    setLoading(true);
    try {
      const data = await apiRequest('/discussions/mine');
      setConversations(Array.isArray(data) ? data : []);
      setError('');
    } catch (err) {
      setError(err.message || 'Could not load discussions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConversations();
  }, []);

  const filteredConversations = conversations.filter((c) => {
    if (filter === 'open' && c.status !== 'open') return false;
    if (filter === 'resolved' && c.status !== 'resolved') return false;
    if (search.trim()) {
      const term = search.toLowerCase();
      const subject = (c.subject || '').toLowerCase();
      const file = (c.file?.name || '').toLowerCase();
      const student = (c.student?.fullName || '').toLowerCase();
      const faculty = (c.faculty?.fullName || '').toLowerCase();
      return subject.includes(term) || file.includes(term) || student.includes(term) || faculty.includes(term);
    }
    return true;
  });

  const openCount = conversations.filter((c) => c.status === 'open').length;

  return (
    <div className="space-y-6">
      {/* Header section with theme styling */}
      <div className="app-hero">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-300">
                <Lock className="h-3.5 w-3.5" />
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">
                Confidential Communication
              </span>
            </div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">{pageTitle}</h1>
            <p className="text-xs text-blue-100/80 mt-1 max-w-2xl">{pageSubtitle}</p>
          </div>
          <button
            type="button"
            onClick={loadConversations}
            disabled={loading}
            className="btn-secondary text-xs inline-flex items-center gap-1.5 self-start sm:self-auto"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Controls Bar: Search & Status Filter */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search discussions by topic, file, or name…"
            className="app-input w-full pl-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
              filter === 'all'
                ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:border-indigo-500 dark:bg-indigo-950/60 dark:text-indigo-300'
                : 'border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            All ({conversations.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('open')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
              filter === 'open'
                ? 'border-amber-600 bg-amber-50 text-amber-700 dark:border-amber-500 dark:bg-amber-950/60 dark:text-amber-300'
                : 'border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            Open ({openCount})
          </button>
          <button
            type="button"
            onClick={() => setFilter('resolved')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
              filter === 'resolved'
                ? 'border-emerald-600 bg-emerald-50 text-emerald-700 dark:border-emerald-500 dark:bg-emerald-950/60 dark:text-emerald-300'
                : 'border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            Resolved ({conversations.length - openCount})
          </button>
        </div>
      </div>

      {/* Discussions List */}
      {error && (
        <div role="alert" className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex h-48 items-center justify-center text-xs text-slate-400">
          <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Loading discussions…
        </div>
      ) : filteredConversations.length === 0 ? (
        <div className="app-card flex flex-col items-center justify-center p-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 mb-3">
            <MessageSquare className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">No discussions found</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
            {isStudent 
              ? 'You have not asked any doubts yet. Open any study material or syllabus and click "Ask a Doubt" to consult the faculty.'
              : 'You have no student questions waiting. Questions asked by students on files you uploaded will appear here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredConversations.map((conv) => {
            const isResolved = conv.status === 'resolved';
            const otherParty = isStudent ? conv.faculty : conv.student;

            return (
              <div
                key={conv.id}
                onClick={() => setSelectedConversation(conv)}
                className="app-card p-4 hover:border-indigo-400 dark:hover:border-indigo-500 cursor-pointer transition flex items-center justify-between gap-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      isResolved
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                    }`}>
                      {isResolved ? <CheckCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                      {conv.status}
                    </span>
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">
                      {isStudent ? `Faculty: ${otherParty?.fullName}` : `Student: ${otherParty?.fullName} (${otherParty?.rollNumber || 'Student'})`}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                    {conv.subject}
                  </h3>

                  <div className="flex items-center gap-4 text-[11px] text-slate-500 dark:text-slate-400 mt-1 truncate">
                    <span className="flex items-center gap-1 truncate">
                      <FileText className="h-3.5 w-3.5 shrink-0" />
                      {conv.file?.name || 'File'}
                    </span>
                    <span>
                      Updated {conv.updatedAt ? new Date(conv.updatedAt).toLocaleDateString() : ''}
                    </span>
                  </div>
                </div>

                <div className="shrink-0 flex items-center text-slate-400">
                  <ChevronRight className="h-5 w-5" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Discussion Chat Modal */}
      {selectedConversation && (
        <DiscussionChatModal
          conversation={selectedConversation}
          onClose={() => setSelectedConversation(null)}
          onStatusChange={(id, newStatus) => {
            setConversations((prev) =>
              prev.map((c) => (c.id === id ? { ...c, status: newStatus } : c))
            );
          }}
        />
      )}
    </div>
  );
}
