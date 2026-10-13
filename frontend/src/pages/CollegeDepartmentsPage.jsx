import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Building2, CircleAlert, Users } from 'lucide-react';
import PublicSiteLayout from '../components/public/PublicSiteLayout';
import { api } from '../utils/api';

const groups = ['ENGINEERING', 'CSE & IT', 'SCIENCES & HUMANITIES'];

export default function CollegeDepartmentsPage() {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.publicGet('/public/departments')
      .then(result => setDepartments(result.departments || []))
      .catch(err => setError(err.message || 'Unable to load departments right now.'))
      .finally(() => setLoading(false));
  }, []);

  const grouped = useMemo(() => groups.map(group => ({
    name: group,
    departments: departments.filter(department => department.display_group === group)
  })), [departments]);

  return (
    <PublicSiteLayout activePage="Departments">
      <section className="bg-[#102a4d] text-white">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20">
          <span className="text-xs font-black uppercase tracking-[.2em] text-amber-300">Academic community</span>
          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">Our Departments</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-blue-100/80 sm:text-base">
            Explore the academic departments and discover their areas of teaching, research, and student development.
          </p>
        </div>
      </section>

      <div id="faculty" className="mx-auto max-w-7xl space-y-12 px-4 py-12 sm:px-6 sm:py-16">
        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm font-semibold text-slate-500" role="status">
            Loading department directory…
          </div>
        ) : error ? (
          <div className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm font-semibold text-rose-800" role="alert">
            <CircleAlert className="h-5 w-5 shrink-0" />{error}
          </div>
        ) : departments.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
            No active departments are available yet.
          </div>
        ) : grouped.map(group => group.departments.length > 0 && (
          <section key={group.name} aria-labelledby={`group-${group.name.replace(/\W/g, '-')}`}>
            <div className="mb-5 flex items-end justify-between gap-4 border-b border-slate-200 pb-3">
              <div>
                <span className="text-xs font-black uppercase tracking-[.18em] text-[#b8892c]">Academic divisions</span>
                <h2 id={`group-${group.name.replace(/\W/g, '-')}`} className="mt-1 text-2xl font-black text-[#12305a] dark:text-slate-100">{group.name}</h2>
              </div>
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-extrabold text-[#12305a] dark:bg-blue-950/60 dark:text-blue-100">{group.departments.length} departments</span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {group.departments.map(department => (
                <article key={department.id} className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-[#12305a] dark:bg-blue-950/60 dark:text-blue-200">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <span className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-extrabold tracking-wide text-slate-500">{department.code}</span>
                  </div>
                  <h3 className="mt-5 min-h-12 text-base font-extrabold leading-6 text-[#12305a] dark:text-slate-100">{department.name}</h3>
                  <p className="mt-2 flex min-h-10 items-start gap-2 text-xs leading-5 text-slate-500">
                    <Users className="mt-0.5 h-4 w-4 shrink-0 text-[#b8892c]" />
                    <span>{department.hod_names || 'Department Head information will be updated.'}</span>
                  </p>
                  <div className="mt-auto flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
                    <span className="text-xs font-semibold text-slate-400">{department.faculty_count || 0} faculty</span>
                    <a href={`/college-departments/${department.id}`} className="inline-flex items-center gap-2 rounded-lg bg-[#12305a] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#1b467e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900">
                      View Department <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                    </a>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </PublicSiteLayout>
  );
}
