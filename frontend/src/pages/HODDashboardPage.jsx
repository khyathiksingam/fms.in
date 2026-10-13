import React, { useCallback, useEffect, useState } from 'react';
import { Activity, Bell, Check, CircleAlert, Clock3, FileCheck2, Files, Users, X } from 'lucide-react';
import { api } from '../utils/api';
import { formatBytes, formatDate } from '../utils/formatters';

function StatusBadge({ status }) {
  const styles = {
    pending: 'bg-amber-50 text-amber-800 ring-amber-200',
    approved: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
    rejected: 'bg-rose-50 text-rose-800 ring-rose-200'
  };
  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold capitalize ring-1 ring-inset ${styles[status] || 'bg-slate-100 text-slate-700 ring-slate-200'}`}>{status || 'pending'}</span>;
}

export default function HODDashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reviewingId, setReviewingId] = useState(null);
  const [message, setMessage] = useState('');

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await api.get('/hod/dashboard'));
    } catch (err) {
      setError(err.message || 'Unable to load the department dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  const review = async (submission, status) => {
    setReviewingId(submission.id);
    setMessage('');
    try {
      await api.patch(`/hod/submissions/${submission.id}`, { status });
      setMessage(status === 'approved' ? 'Submission approved.' : 'Submission returned for revision.');
      await loadDashboard();
    } catch (err) {
      setError(err.message || 'Unable to update this submission.');
    } finally {
      setReviewingId(null);
    }
  };

  if (loading && !data) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900" role="status">Loading HOD dashboard…</div>;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-gradient-to-br from-[#12305a] to-[#1e4a7d] p-6 text-white shadow-xl sm:p-8">
        <span className="text-xs font-extrabold uppercase tracking-[.18em] text-amber-300">Department dashboard</span>
        <h1 className="mt-3 text-2xl font-black sm:text-3xl">Welcome, {data?.department?.name || 'HOD'}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100/80">
          Review faculty submissions, track department activity, and support your faculty team.
        </p>
      </section>

      {error && <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800" role="alert"><CircleAlert className="h-4 w-4" />{error}</div>}
      {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800" role="status">{message}</div>}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Department overview">
        {[
          { label: 'Department faculty', value: data?.stats?.faculty || 0, icon: Users, tone: 'text-blue-700 bg-blue-50' },
          { label: 'Pending approvals', value: data?.stats?.pending || 0, icon: Clock3, tone: 'text-amber-700 bg-amber-50' },
          { label: 'Approved files', value: data?.stats?.approved || 0, icon: FileCheck2, tone: 'text-emerald-700 bg-emerald-50' },
          { label: 'Returned files', value: data?.stats?.rejected || 0, icon: Files, tone: 'text-rose-700 bg-rose-50' }
        ].map(item => {
          const Icon = item.icon;
          return (
            <article key={item.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{item.label}</span>
                <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${item.tone}`}><Icon className="h-4 w-4" /></span>
              </div>
              <div className="mt-3 text-2xl font-black text-slate-900 dark:text-white">{item.value}</div>
            </article>
          );
        })}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">Faculty file submissions</h2>
              <p className="mt-1 text-xs text-slate-500">Approve or return files submitted in your selected department.</p>
            </div>
            <button type="button" onClick={loadDashboard} className="rounded-lg px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">Refresh</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px] text-left text-sm">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500 dark:bg-slate-800/70">
                <tr><th className="px-5 py-3">File</th><th className="px-5 py-3">Faculty</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Submitted</th><th className="px-5 py-3">Review</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data?.submissions?.map(item => (
                  <tr key={item.id}>
                    <td className="px-5 py-4">
                      <span className="block max-w-56 truncate font-bold text-slate-800 dark:text-slate-100">{item.original_name}</span>
                      <span className="text-xs text-slate-400">{formatBytes(item.size)}</span>
                    </td>
                    <td className="px-5 py-4 text-slate-600 dark:text-slate-300">{item.uploader_name}</td>
                    <td className="px-5 py-4"><StatusBadge status={item.approval_status} /></td>
                    <td className="px-5 py-4 text-xs text-slate-500">{formatDate(item.created_at)}</td>
                    <td className="px-5 py-4">
                      {item.approval_status === 'pending' ? (
                        <div className="flex gap-2">
                          <button type="button" disabled={reviewingId === item.id} onClick={() => review(item, 'approved')} title="Approve submission" aria-label={`Approve ${item.original_name}`} className="rounded-lg bg-emerald-50 p-2 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"><Check className="h-4 w-4" /></button>
                          <button type="button" disabled={reviewingId === item.id} onClick={() => review(item, 'rejected')} title="Return submission" aria-label={`Return ${item.original_name}`} className="rounded-lg bg-rose-50 p-2 text-rose-700 hover:bg-rose-100 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600"><X className="h-4 w-4" /></button>
                        </div>
                      ) : <span className="text-xs text-slate-400">{item.review_note || 'Reviewed'}</span>}
                    </td>
                  </tr>
                ))}
                {!data?.submissions?.length && <tr><td colSpan="5" className="px-5 py-10 text-center text-sm text-slate-500">No faculty file submissions are available yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </article>

        <div className="space-y-5">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="flex items-center gap-2 text-base font-extrabold text-slate-900 dark:text-white"><Users className="h-4 w-4 text-blue-600" />Department faculty</h2>
            <ul className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
              {data?.faculty?.map(person => (
                <li key={person.id} className="flex items-center justify-between gap-3 py-3">
                  <span className="truncate text-sm font-semibold text-slate-700 dark:text-slate-200">{person.full_name}</span>
                  <span className="shrink-0 text-xs text-slate-400">{person.file_count} files</span>
                </li>
              ))}
              {!data?.faculty?.length && <li className="py-4 text-sm text-slate-500">No faculty records are available in this department.</li>}
            </ul>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="flex items-center gap-2 text-base font-extrabold text-slate-900 dark:text-white"><Bell className="h-4 w-4 text-amber-600" />Notifications</h2>
            <ul className="mt-3 space-y-3">
              {data?.notifications?.map(item => (
                <li key={item.id} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{item.title}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{item.message}</p>
                </li>
              ))}
              {!data?.notifications?.length && <li className="py-3 text-sm text-slate-500">You’re all caught up.</li>}
            </ul>
          </article>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="flex items-center gap-2 text-base font-extrabold text-slate-900 dark:text-white"><Activity className="h-4 w-4 text-blue-600" />Faculty activity overview</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data?.activity?.map(item => (
            <li key={item.id} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
              <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{item.user_name || 'System'} · {item.action}</p>
              <p className="mt-1 truncate text-xs text-slate-500">{item.file_name || 'Department activity'}</p>
              <p className="mt-1 text-[11px] text-slate-400">{formatDate(item.created_at)}</p>
            </li>
          ))}
          {!data?.activity?.length && <li className="text-sm text-slate-500">No recent faculty activity.</li>}
        </ul>
      </section>
    </div>
  );
}
