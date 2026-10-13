import React, { useEffect, useState } from 'react';
import { ArrowLeft, Building2, CircleAlert, UserRound, Users } from 'lucide-react';
import PublicSiteLayout from '../components/public/PublicSiteLayout';
import { api } from '../utils/api';

export default function CollegeDepartmentDetailPage({ departmentId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.publicGet(`/public/departments/${encodeURIComponent(departmentId)}`)
      .then(result => { if (active) setData(result); })
      .catch(err => { if (active) setError(err.message || 'Unable to load department details.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [departmentId]);

  return (
    <PublicSiteLayout activePage="Departments">
      {loading ? (
        <div className="mx-auto max-w-5xl px-4 py-20 text-center text-sm font-semibold text-slate-500" role="status">Loading department information…</div>
      ) : error ? (
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-20 text-sm font-semibold text-rose-700" role="alert">
          <CircleAlert className="h-5 w-5" />{error}
        </div>
      ) : (
        <>
          <section className="bg-[#102a4d] text-white">
            <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
              <a href="/college-departments" className="inline-flex items-center gap-2 text-xs font-bold text-blue-100 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
                <ArrowLeft className="h-4 w-4" /> All Departments
              </a>
              <div className="mt-8 flex flex-col gap-5 sm:flex-row sm:items-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-amber-300">
                  <Building2 className="h-8 w-8" />
                </div>
                <div>
                  <span className="text-xs font-black uppercase tracking-[.2em] text-amber-300">{data.department.display_group}</span>
                  <h1 className="mt-2 text-3xl font-black sm:text-4xl">{data.department.name}</h1>
                  <span className="mt-3 inline-flex rounded-lg border border-white/20 px-2.5 py-1 text-xs font-bold text-blue-100">{data.department.code}</span>
                </div>
              </div>
            </div>
          </section>

          <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[.8fr_1.2fr]">
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-black text-[#12305a] dark:text-slate-100">Department information</h2>
              <div className="mt-5 flex items-start gap-3 rounded-xl bg-blue-50 p-4 dark:bg-blue-950/50">
                <Users className="mt-0.5 h-5 w-5 shrink-0 text-[#12305a] dark:text-blue-200" />
                <div>
                  <h3 className="text-xs font-extrabold uppercase tracking-wide text-slate-500">Head of Department</h3>
                  <p className="mt-1 text-sm font-bold text-[#12305a] dark:text-blue-100">{data.department.hod_names || 'Information will be updated.'}</p>
                </div>
              </div>
              <p className="mt-5 text-sm leading-6 text-slate-600">
                The department supports teaching, learning, and academic development within {data.department.name}.
              </p>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-black text-[#12305a] dark:text-slate-100">Faculty</h2>
                  <p className="mt-1 text-xs text-slate-500">Active faculty listed for this department.</p>
                </div>
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-extrabold text-[#12305a] dark:bg-blue-950/60 dark:text-blue-100">{data.faculty.length}</span>
              </div>
              {data.faculty.length ? (
                <ul className="mt-5 divide-y divide-slate-100">
                  {data.faculty.map(person => (
                    <li key={person.id} className="flex items-center gap-3 py-3">
                      {person.avatar_url
                        ? <img src={person.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" />
                        : <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500"><UserRound className="h-4 w-4" /></div>}
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{person.full_name}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Faculty information is not available yet.</p>
              )}
            </section>
          </div>
        </>
      )}
    </PublicSiteLayout>
  );
}
