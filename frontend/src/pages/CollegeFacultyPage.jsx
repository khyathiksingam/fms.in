import React, { useEffect, useMemo, useState } from 'react';
import { CircleAlert, Search, UserRound } from 'lucide-react';
import PublicSiteLayout from '../components/public/PublicSiteLayout';
import { api } from '../utils/api';

export default function CollegeFacultyPage() {
  const [faculty, setFaculty] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.publicGet('/public/faculty')
      .then(result => setFaculty(result.faculty || []))
      .catch(err => setError(err.message || 'Unable to load faculty information.'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return faculty;
    return faculty.filter(person =>
      `${person.full_name} ${person.department_name} ${person.department_code}`.toLowerCase().includes(query)
    );
  }, [faculty, search]);

  return (
    <PublicSiteLayout activePage="Faculty">
      <section className="bg-[#102a4d] text-white">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20">
          <span className="text-xs font-black uppercase tracking-[.2em] text-amber-300">Our people</span>
          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">Faculty Directory</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-blue-100/80 sm:text-base">
            Explore the active faculty directory by name or academic department.
          </p>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
        <label className="relative block max-w-xl">
          <span className="sr-only">Search faculty by name or department</span>
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search name or department" className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-11 pr-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400" />
        </label>
        {loading ? (
          <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500" role="status">Loading faculty directory…</div>
        ) : error ? (
          <div className="mt-8 flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm font-semibold text-rose-800" role="alert"><CircleAlert className="h-5 w-5" />{error}</div>
        ) : filtered.length ? (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map(person => (
              <article key={person.id} className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#12305a] dark:bg-blue-950/60 dark:text-blue-200"><UserRound className="h-5 w-5" /></div>
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-extrabold text-[#12305a] dark:text-slate-100">{person.full_name}</h2>
                  <a href={`/college-departments/${person.department_id}`} className="mt-1 block truncate text-xs font-semibold text-slate-500 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:text-slate-400 dark:hover:text-blue-300">
                    {person.department_name} ({person.department_code})
                  </a>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-8 rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
            {search ? 'No faculty members match this search.' : 'Faculty information is not available yet.'}
          </p>
        )}
      </section>
    </PublicSiteLayout>
  );
}
