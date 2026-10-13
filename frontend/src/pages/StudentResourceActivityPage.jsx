import React, { useEffect, useState } from 'react';
import { Activity, Download, Eye, LoaderCircle, LogIn } from 'lucide-react';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';

const EMPTY_FILTERS = {
  student: '',
  roll_number: '',
  department_id: '',
  faculty_uploader_id: '',
  resource_type: '',
  subject: '',
  regulation: '',
  action: '',
  from: '',
  to: ''
};

const ACTION_LABELS = {
  student_login: 'Login',
  student_logout: 'Logout',
  student_resource_opened: 'Opened',
  student_resource_previewed: 'Previewed',
  student_resource_downloaded: 'Downloaded',
  student_resource_searched: 'Searched',
  student_resource_filtered: 'Filtered'
};

export default function StudentResourceActivityPage() {
  const { isAdmin, isHOD } = useAuth();
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [departments, setDepartments] = useState([]);
  const [data, setData] = useState({ activity: [], pagination: { page: 1, totalPages: 1, total: 0 } });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!isAdmin) api.get('/departments').then(result => setDepartments(result.departments || [])).catch(err => setError(err.message));
  }, [isAdmin]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const endpoint = isAdmin ? '/student/activity/monitor' : '/student/activity/mine';
    api.get(endpoint, { ...filters, page, limit: 25 })
      .then(result => { if (active) { setData(result); setError(''); } })
      .catch(err => { if (active) setError(err.message || 'Unable to load student resource activity.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [filters, page, isAdmin]);

  const update = (key, value) => {
    setFilters(current => ({ ...current, [key]: value }));
    setPage(1);
  };

  const summaryCards = isAdmin ? [
    ['login_history', 'Recent student logins', row => `${row.student_name || 'Student'} · ${row.last_login || ''}`],
    ['most_accessed_subjects', 'Most accessed subjects', row => `${row.subject_code || '—'} · ${row.access_count}`],
    ['most_accessed_faculty_notes', 'Popular faculty notes', row => `${row.subject_code || '—'} · ${row.access_count}`],
    ['most_active_students', 'Most active students', row => `${row.student_name || 'Student'} · ${row.activity_count}`],
    ['activity_by_department', 'Activity by department', row => `${row.department_name || '—'} · ${row.activity_count}`],
    ['activity_by_regulation', 'Activity by regulation', row => `${row.regulation || '—'} · ${row.activity_count}`],
    ['activity_by_faculty', 'Activity by faculty uploader', row => `${row.faculty_name || '—'} · ${row.activity_count}`]
  ] : [];

  return (
    <div className="space-y-5">
      <header>
        <h1 className="flex items-center gap-2 text-xl font-extrabold text-slate-900 dark:text-white"><Activity className="h-5 w-5 text-[#2846C7]" />{isAdmin ? 'Student Academic Activity Monitor' : 'My Student Resource Activity'}</h1>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{isAdmin ? 'Student login and published resource access activity.' : isHOD ? 'Student access activity for published resources in your department.' : 'Student access activity for resources you uploaded or own.'}</p>
      </header>

      {isAdmin && data && <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map(([key, title, format]) => <section key={key} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-xs font-bold text-[#16265C] dark:text-white">{title}</h2>
          <ul className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-300">
            {(data[key] || []).slice(0, 4).map((row, index) => <li key={`${row.student_id || row.subject_code || row.department_name || row.regulation || row.faculty_name}-${index}`} className="truncate">{format(row)}</li>)}
            {!data[key]?.length && <li className="text-slate-400">No activity yet</li>}
          </ul>
        </section>)}
      </div>}

      <section className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4 dark:border-slate-800 dark:bg-slate-900" aria-label="Activity filters">
        {isAdmin && <input aria-label="Student name or ID" value={filters.student} onChange={event => update('student', event.target.value)} placeholder="Student name or ID" className="rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-xs dark:border-slate-700" />}
        <input aria-label="Roll number" value={filters.roll_number} onChange={event => update('roll_number', event.target.value)} placeholder="Roll number" className="rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-xs dark:border-slate-700" />
        <select aria-label="Department" value={filters.department_id} onChange={event => update('department_id', event.target.value)} className="rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900">
          <option value="">All departments</option>{departments.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        {isAdmin && <input aria-label="Faculty uploader ID" value={filters.faculty_uploader_id} onChange={event => update('faculty_uploader_id', event.target.value)} placeholder="Faculty uploader ID" className="rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-xs dark:border-slate-700" />}
        <select aria-label="Resource type" value={filters.resource_type} onChange={event => update('resource_type', event.target.value)} className="rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900"><option value="">All resource types</option><option value="syllabus">Syllabus</option><option value="faculty_note">Faculty Note</option></select>
        <input aria-label="Subject" value={filters.subject} onChange={event => update('subject', event.target.value)} placeholder="Subject code or name" className="rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-xs dark:border-slate-700" />
        <input aria-label="Regulation" value={filters.regulation} onChange={event => update('regulation', event.target.value)} placeholder="Regulation" className="rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-xs dark:border-slate-700" />
        <select aria-label="Action" value={filters.action} onChange={event => update('action', event.target.value)} className="rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900"><option value="">All actions</option>{Object.entries(ACTION_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <label className="text-[10px] font-semibold text-slate-500">From<input type="date" value={filters.from} onChange={event => update('from', event.target.value)} className="mt-1 block w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-xs dark:border-slate-700" /></label>
        <label className="text-[10px] font-semibold text-slate-500">To<input type="date" value={filters.to} onChange={event => update('to', event.target.value)} className="mt-1 block w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-xs dark:border-slate-700" /></label>
      </section>

      {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800 dark:bg-rose-950/50 dark:text-rose-200">{error}</p>}
      <section className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" aria-label="Student access activity">
        {loading ? <div className="flex min-h-36 items-center justify-center gap-2 text-sm text-slate-500"><LoaderCircle className="h-4 w-4 animate-spin" />Loading activity…</div>
          : data.activity?.length ? <table className="w-full min-w-[900px] text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300"><tr>{['Student', 'Roll Number', 'Department', 'Resource Type', 'Subject', 'Regulation', 'Action', 'Date and Time'].map(title => <th key={title} className="px-3 py-3 font-bold">{title}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">{data.activity.map(row => <tr key={row.id} className="text-slate-700 dark:text-slate-200">
              <td className="px-3 py-3">{row.student_name || 'Student'}</td><td className="px-3 py-3">{row.roll_number || '—'}</td><td className="px-3 py-3">{row.department_name || '—'}</td><td className="px-3 py-3">{row.resource_type === 'faculty_note' ? 'Faculty Note' : row.resource_type === 'syllabus' ? 'Syllabus' : '—'}</td><td className="px-3 py-3">{row.subject_code ? `${row.subject_code} · ${row.subject_name || ''}` : '—'}</td><td className="px-3 py-3">{row.regulation || '—'}</td><td className="px-3 py-3"><span className="inline-flex items-center gap-1">{row.action === 'student_resource_downloaded' ? <Download className="h-3 w-3" /> : row.action === 'student_login' ? <LogIn className="h-3 w-3" /> : <Eye className="h-3 w-3" />}{ACTION_LABELS[row.action] || row.action}</span></td><td className="px-3 py-3">{row.created_at}</td>
            </tr>)}</tbody>
          </table> : <div className="p-10 text-center text-sm text-slate-500">No student resource activity matches these filters.</div>}
      </section>
      {data.pagination?.totalPages > 1 && <div className="flex items-center justify-center gap-4"><button type="button" disabled={page <= 1} onClick={() => setPage(value => value - 1)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold disabled:opacity-40 dark:border-slate-700">Previous</button><span className="text-xs text-slate-500">Page {page} of {data.pagination.totalPages} · {data.pagination.total} events</span><button type="button" disabled={page >= data.pagination.totalPages} onClick={() => setPage(value => value + 1)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold disabled:opacity-40 dark:border-slate-700">Next</button></div>}
    </div>
  );
}
