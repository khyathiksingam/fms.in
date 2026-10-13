import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, BookOpen, GraduationCap, LibraryBig, LoaderCircle, Menu, Moon, Search, Sun, X } from 'lucide-react';
import { api, fetchAuthenticatedPdf, getToken, setToken } from '../utils/api';
import { useTheme } from '../context/ThemeContext';
import './SyllabusPage.css';
import SyllabusFilters from '../components/syllabus/SyllabusFilters';
import SyllabusBrowseControls from '../components/syllabus/SyllabusBrowseControls';
import SyllabusSubjectCard from '../components/syllabus/SyllabusSubjectCard';
import SyllabusPreviewModal from '../components/syllabus/SyllabusPreviewModal';
import { VNRVJIET_DARK_EMBLEM } from '../utils/branding';

const EMPTY_FILTERS = {
  program: '',
  regulation: '',
  department_id: '',
  department_ids: '',
  semester: '',
  subject_id: ''
};

function groupByRegulationAndYear(records) {
  const groups = new Map();
  records.forEach(record => {
    const key = `${record.regulation}\u0000${record.academic_year}`;
    if (!groups.has(key)) groups.set(key, { regulation: record.regulation, year: record.academic_year, branches: new Map() });
    const group = groups.get(key);
    const branchKey = `${record.branch_code}\u0000${record.department_name || ''}`;
    if (!group.branches.has(branchKey)) {
      group.branches.set(branchKey, { branch: record.branch_code, department: record.department_name, departmentId: record.department_id, records: [] });
    }
    group.branches.get(branchKey).records.push(record);
  });
  return [...groups.values()].map(group => ({ ...group, branches: [...group.branches.values()] }));
}

export default function SyllabusPage({ studentView = false, departmentBrowserView = false }) {
  const { isDark, toggleTheme } = useTheme();
  const [catalogFilters, setCatalogFilters] = useState(null);
  const [masterData, setMasterData] = useState(null);
  const [masterDataError, setMasterDataError] = useState('');
  const [selected, setSelected] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return studentView && params.has('resourceId')
      ? { ...EMPTY_FILTERS, subject_id: params.get('resourceId') }
      : EMPTY_FILTERS;
  });
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [records, setRecords] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);
  const [downloadError, setDownloadError] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [studentSession, setStudentSession] = useState(null);
  const [studentSessionLoading, setStudentSessionLoading] = useState(true);
  const [resourceTab, setResourceTab] = useState('all');
  const [catalogueRevision, setCatalogueRevision] = useState(0);
  const resultsRef = useRef(null);
  const handledResourceRef = useRef('');
  const closePreview = useCallback(() => setPreview(null), []);
  const selectedRegulation = masterData?.regulations?.find(item => item.code === selected.regulation);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setStudentSessionLoading(false);
      return;
    }
    api.get('/auth/me')
      .then(data => setStudentSession(data.user?.role_name === 'student' ? data.user : null))
      .catch(() => setStudentSession(null))
      .finally(() => setStudentSessionLoading(false));
  }, []);

  useEffect(() => {
    const handleCatalogueUpdate = () => setCatalogueRevision(revision => revision + 1);
    window.addEventListener('syllabus-catalogue-updated', handleCatalogueUpdate);
    return () => window.removeEventListener('syllabus-catalogue-updated', handleCatalogueUpdate);
  }, []);

  useEffect(() => {
    if (!studentView || studentSessionLoading || studentSession) return;
    const query = new URLSearchParams(window.location.search);
    const resourceId = query.get('resourceId');
    const action = query.get('action') === 'download' ? 'download' : 'preview';
    const redirect = new URLSearchParams();
    if (resourceId) {
      redirect.set('resourceId', resourceId);
      redirect.set('action', action);
    }
    window.location.replace(`/student-login${redirect.size ? `?${redirect}` : ''}`);
  }, [studentView, studentSessionLoading, studentSession]);

  useEffect(() => {
    api.publicGet('/public/syllabus/filters')
      .then(setCatalogFilters)
      .catch(err => setError(err.status === 404
        ? 'The academic resources API endpoint was not found. Please check the backend route.'
        : [502, 503, 504].includes(err.status) || !err.status
          ? 'Unable to load academic resources. Please refresh or try again later.'
          : err.message || 'Unable to load academic resources.'));
    api.publicGet('/public/syllabus/master-data')
      .then(setMasterData)
      .catch(err => setMasterDataError(err.status === 404
        ? 'The academic resources API endpoint was not found. Please check the backend route.'
        : [502, 503, 504].includes(err.status) || !err.status
          ? 'Unable to load academic resources. Please refresh or try again later.'
          : err.message || 'Unable to load regulations and departments.'));
  }, [catalogueRevision]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let active = true;
    const params = { ...selected, q: debouncedSearch, page, limit: 20 };
    if (resourceTab !== 'all') params.resource_type = resourceTab === 'notes' ? 'faculty_note' : 'syllabus';
    if (params.program.startsWith('__program_')) {
      params.program_group = params.program.slice('__program_'.length, -2);
      delete params.program;
    } else if (params.program === '__other__') {
      delete params.program;
      params.program_group = 'other';
    }
    api.publicGet('/public/syllabus', params)
      .then(data => {
        if (!active) return;
        setRecords(data.syllabus || []);
        setPagination(data.pagination || { total: 0, totalPages: 0 });
        setError('');
      })
      .catch(err => {
        if (active) setError([502, 503, 504].includes(err.status) || !err.status
          ? 'Unable to load academic resources. Please refresh or try again later.'
          : err.status === 404
            ? 'The academic resources API endpoint was not found. Please check the backend route.'
            : err.message || 'Unable to load academic resources.');
      })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [selected, debouncedSearch, page, resourceTab, catalogueRevision]);

  useEffect(() => {
    if (studentSession && debouncedSearch) {
      api.post('/student/activity', { action: 'student_resource_searched' }).catch(err => console.warn('Student search activity was not recorded:', err.message));
    }
  }, [studentSession, debouncedSearch]);

  useEffect(() => {
    if (studentSession && Object.values(selected).some(Boolean)) {
      api.post('/student/activity', { action: 'student_resource_filtered' }).catch(err => console.warn('Student filter activity was not recorded:', err.message));
    }
  }, [studentSession, selected, resourceTab]);

  const groups = useMemo(() => groupByRegulationAndYear(records), [records]);
  const handleFilterChange = (key, value) => {
    const resetAfter = {
      program: ['regulation', 'department_id', 'department_ids', 'semester', 'subject_id'],
      regulation: ['department_id', 'department_ids', 'semester', 'subject_id'],
      department_id: ['department_ids', 'semester', 'subject_id'],
      department_ids: ['department_id', 'semester', 'subject_id'],
      semester: ['subject_id']
    };
    setSelected(previous => {
      const next = { ...previous, [key]: value };
      (resetAfter[key] || []).forEach(field => { next[field] = ''; });
      return next;
    });
    if (['program', 'regulation', 'department_id', 'department_ids'].includes(key)) {
      setSelectedDepartment('');
    }
    setLoading(true);
    setPage(1);
  };

  const handleDepartmentSelect = department => {
    setSelected(previous => ({
      ...previous,
      department_id: '',
      department_ids: department.department_ids.join(','),
      semester: '',
      subject_id: ''
    }));
    setSelectedDepartment(department.name);
    setLoading(true);
    setPage(1);
  };

  useEffect(() => {
    if (!selectedDepartment || loading || !resultsRef.current) return;
    const branches = [...resultsRef.current.querySelectorAll('[data-department-id]')];
    const selectedDepartmentIds = selected.department_ids
      ? selected.department_ids.split(',')
      : [selected.department_id];
    const target = branches.find(branch => selectedDepartmentIds.includes(branch.dataset.departmentId));
    if (target) {
      let ancestor = target.parentElement;
      while (ancestor && ancestor !== resultsRef.current) {
        if (ancestor instanceof HTMLDetailsElement) ancestor.open = true;
        ancestor = ancestor.parentElement;
      }
    }
    const scrollTarget = target || resultsRef.current;
    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
    scrollTarget.scrollIntoView({ behavior, block: 'start' });
  }, [loading, selectedDepartment, selected.department_id, selected.department_ids, records]);

  const navigate = useCallback((path) => {
    window.history.pushState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, []);

  const downloadRecord = record => {
    if (!studentSession) {
      navigate(`/student-login?resourceId=${encodeURIComponent(record.id)}&action=download`);
      return;
    }
    setDownloadError('');
    fetchAuthenticatedPdf(`/public/syllabus/${record.id}/download`).then(blob => {
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = record.file_name || `${record.subject_code}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    }).catch(err => {
      if (err.status === 401) {
        setToken(null);
        navigate(`/student-login?resourceId=${encodeURIComponent(record.id)}&action=download`);
      } else if (preview?.id === record.id) {
        setDownloadError(err.message);
      } else {
        setError(err.message);
      }
    });
  };

  const requestResource = record => {
    if (!studentSession) {
      navigate(`/student-login?resourceId=${encodeURIComponent(record.id)}&action=preview`);
      return;
    }
    setDownloadError('');
    setPreview(record);
  };

  const logoutStudent = async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setToken(null);
      setStudentSession(null);
      window.location.assign('/syllabus');
    }
  };

  useEffect(() => {
    if (!studentView || !studentSession || !records.length) return;
    const params = new URLSearchParams(window.location.search);
    const resourceId = params.get('resourceId');
    const action = params.get('action');
    if (!resourceId || handledResourceRef.current === resourceId) return;
    const record = records.find(row => String(row.id) === resourceId);
    if (!record) return;
    handledResourceRef.current = resourceId;
    if (action === 'download') downloadRecord(record);
    else requestResource(record);
    window.history.replaceState({}, '', '/student-syllabus');
  }, [studentView, studentSession, records]);

  if (studentView && (studentSessionLoading || !studentSession)) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-slate-600 dark:text-slate-300">Opening Student Syllabus Library…</div>;
  }

  return (
    <div className="syllabus-page min-h-screen bg-[#f4f6fb] text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="syllabus-header sticky top-0 z-30 border-b border-[#dbe2f0] bg-white/95 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/95">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <a href="/syllabus" className="flex min-w-0 items-center gap-3" aria-label="VNRVJIET Syllabus Library">
            <img src={isDark ? VNRVJIET_DARK_EMBLEM : '/branding/vnrvjiet-emblem.png'} alt="VNRVJIET emblem" className="h-11 w-11 shrink-0 object-contain sm:h-12 sm:w-12" />
            <span className="min-w-0">
              <span className="block text-[10px] font-extrabold tracking-wide text-[#16265C] dark:text-white sm:text-sm">VNRVJIET</span>
              <span className="block truncate text-sm font-bold text-[#16265C] dark:text-white sm:text-xs sm:font-semibold sm:text-slate-600 sm:dark:text-slate-300">Syllabus Library</span>
            </span>
          </a>
          <div className="flex items-center gap-2">
            <button type="button" onClick={toggleTheme} aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'} className="syllabus-icon-button" title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}>
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            {studentSession ? (
              <>
                <span title={studentSession.full_name || studentSession.name || 'Student'} aria-label={`Welcome, ${studentSession.full_name || studentSession.name || 'Student'}`} className="max-w-[38vw] break-words rounded-xl border border-[#dbe2f0] bg-[#f6f8ff] px-2 py-1.5 text-right text-[10px] font-bold leading-tight text-[#16265C] dark:border-slate-700 dark:bg-slate-800 dark:text-white sm:max-w-none sm:whitespace-nowrap sm:px-3 sm:text-xs">
                  Welcome, {studentSession.full_name || studentSession.name || 'Student'}
                </span>
                <button type="button" onClick={logoutStudent} className="syllabus-portal-button cursor-pointer">Sign out</button>
              </>
            ) : <button type="button" onClick={() => navigate('/student-login')} className="syllabus-portal-button cursor-pointer">Student Login</button>}
            {!studentView && !studentSession && <a href="/faculty-portal" className="syllabus-portal-button syllabus-desktop-portal">Faculty Portal <ArrowRight className="h-4 w-4" /></a>}
            {!studentView && <button type="button" className="syllabus-icon-button syllabus-mobile-menu" aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'} aria-expanded={mobileMenuOpen} onClick={() => setMobileMenuOpen(open => !open)}>
              {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>}
          </div>
        </div>
        {mobileMenuOpen && !studentView && (
          <div className="syllabus-mobile-menu-panel border-t border-slate-200 px-4 py-3 dark:border-slate-800">
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  navigate(studentSession ? '/student-syllabus' : '/student-login');
                }}
                className="syllabus-portal-button w-full cursor-pointer text-center"
              >
                {studentSession ? 'Student Library' : 'Student Login'}
              </button>
              {!studentSession && <a href="/faculty-portal" className="syllabus-portal-button w-full text-center">Faculty Portal <ArrowRight className="h-4 w-4 inline" /></a>}
            </div>
          </div>
        )}
      </header>

      <main className={`mx-auto max-w-7xl px-4 sm:px-6 ${studentView ? 'space-y-5 py-5 sm:py-7' : 'space-y-8 py-7 sm:py-10'}`}>
        {!studentView && <section className="syllabus-hero relative overflow-hidden rounded-[30px] px-5 py-10 text-white sm:px-10 sm:py-14">
          <div className="syllabus-hero-plane" aria-hidden="true" />
          <div className="syllabus-hero-grid" aria-hidden="true" />
          <div className="relative z-10 max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#F4B64E]/60 bg-white/10 px-3 py-1 text-xs font-bold text-[#ffe1a4]"><LibraryBig className="h-4 w-4" /> ACADEMIC DOCUMENTS</span>
            <h1 className="mt-5 text-3xl font-extrabold tracking-tight sm:text-5xl">Find your syllabus</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-blue-100 sm:text-base">Search published course syllabi by subject, code, branch, regulation, or semester.</p>
            <label className="syllabus-search mt-7 flex items-center gap-3 rounded-2xl p-2.5 text-slate-800">
              <Search className="ml-2 h-5 w-5 shrink-0 text-[#2846C7]" />
              <input aria-label="Search syllabi" type="search" value={search} onChange={event => { setSearch(event.target.value); setPage(1); setLoading(true); }} placeholder="Subject name, code, branch, regulation, semester..." className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-slate-500 sm:text-base" />
              {search && <button type="button" onClick={() => { setSearch(''); setLoading(true); }} className="rounded-lg px-3 py-2 text-xs font-bold text-[#16265C] hover:bg-[#fff7e9] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2846C7]">Clear</button>}
            </label>
          </div>
          <GraduationCap className="syllabus-cap absolute -bottom-12 -right-8 h-64 w-64 text-[#F4B64E]/15" aria-hidden="true" />
        </section>}

        {!studentView && !departmentBrowserView && (
          <a
            href="/syllabus/departments"
            className="group flex items-center justify-between gap-4 rounded-2xl border border-[#dbe2f0] bg-white p-4 shadow-sm transition hover:border-[#9aaeea] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2846C7] dark:border-slate-800 dark:bg-slate-900 sm:p-5"
          >
            <span className="min-w-0">
              <span className="block text-base font-extrabold text-[#16265C] dark:text-white">Browse Departments</span>
              <span className="mt-1 block text-sm text-slate-600 dark:text-slate-300">Explore published resources by department.</span>
            </span>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#edf2ff] text-[#2846C7] transition group-hover:translate-x-0.5 dark:bg-slate-800 dark:text-[#aebfff]">
              <ArrowRight className="h-5 w-5" />
            </span>
          </a>
        )}

        {!studentView && (
          <section className="syllabus-filter-panel space-y-4 rounded-3xl p-4 sm:p-6" aria-labelledby="filters-heading">
            <div className="flex flex-wrap items-start justify-between gap-3">
              {!departmentBrowserView && <div>
                <h2 id="filters-heading" className="font-extrabold text-[#16265C] dark:text-white">
                  Browse by curriculum
                </h2>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                  Choose each level in order to narrow the available documents.
                </p>
              </div>}
              {departmentBrowserView && (
                <a href="/syllabus" className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-[#16265C] transition hover:border-[#2846C7] hover:bg-[#f4f6ff] dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                  <ArrowRight className="h-4 w-4 rotate-180" /> Syllabus Library
                </a>
              )}
            </div>
            {departmentBrowserView ? (
              masterData ? (
                <SyllabusBrowseControls
                  subjects={catalogFilters?.subjects || []}
                  masterData={masterData}
                  selected={selected}
                  onFilterChange={handleFilterChange}
                  onDepartmentSelect={handleDepartmentSelect}
                  departmentBrowserOnly
                />
              ) : masterDataError ? (
                <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-200">{masterDataError}</div>
              ) : (
                <div className="flex items-center gap-2 py-4 text-sm text-slate-500"><LoaderCircle className="h-4 w-4 animate-spin" /> Loading departments…</div>
              )
            ) : (
              <>
            {catalogFilters && masterData ? (
              <SyllabusBrowseControls
                subjects={catalogFilters.subjects || []}
                masterData={masterData}
                selected={selected}
                onFilterChange={handleFilterChange}
                onDepartmentSelect={handleDepartmentSelect}
                hideDepartmentDirectory
              />
            ) : masterDataError ? (
              <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-200">{masterDataError}</div>
            ) : (
              <div className="flex items-center gap-2 py-4 text-sm text-slate-500"><LoaderCircle className="h-4 w-4 animate-spin" /> Loading available filters?</div>
            )}
            {catalogFilters && (
              <div className="border-t border-slate-200 pt-4 dark:border-slate-700">
                <h3 className="mb-3 text-sm font-bold text-[#16265C] dark:text-white">Refine by semester and subject</h3>
                <SyllabusFilters value={selected} onChange={handleFilterChange} subjects={catalogFilters.subjects || []} />
              </div>
            )}
              </>
            )}
            {selectedRegulation && (
              <aside className="rounded-2xl border border-[#F4B64E]/70 bg-white/80 p-4 shadow-sm dark:border-amber-800 dark:bg-slate-900/80" aria-live="polite">
                <p className="text-xs font-bold uppercase tracking-wider text-[#2846C7] dark:text-blue-300">{selectedRegulation.code} ? Academic Regulation</p>
                <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">Effective from: {selectedRegulation.effective_from || 'See regulation details'}</p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{selectedRegulation.description || 'Regulation details are maintained by the college.'}</p>
                <p className="mt-2 text-xs font-bold text-slate-500 dark:text-slate-400">{selectedRegulation.document_count || 0} published resources</p>
              </aside>
            )}
          </section>
        )}

        <section ref={resultsRef} aria-live="polite" aria-busy={loading} className="scroll-mt-24">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <div><h2 className="text-lg font-bold">Published academic resources</h2><p className="text-xs text-slate-500 dark:text-slate-400">{loading ? 'Searching…' : `${pagination.total || 0} result${pagination.total === 1 ? '' : 's'}`}</p></div>
          </div>
          <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Academic resource type">
            {[
              ['all', 'All Academic Resources'],
              ['syllabus', 'Syllabus Books'],
              ['notes', 'Faculty Notes']
            ].map(([tab, label]) => (
              <button key={tab} type="button" role="tab" aria-selected={resourceTab === tab} onClick={() => { setResourceTab(tab); setPage(1); setLoading(true); }} className={`rounded-full border px-4 py-2 text-xs font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2846C7] ${resourceTab === tab ? 'border-[#16265C] bg-[#16265C] text-white' : 'border-slate-300 bg-white text-[#16265C] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100'}`}>{label}</button>
            ))}
          </div>
          {error && <div role="alert" className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-200">{error}</div>}
          {loading ? (
            <div className="syllabus-state flex min-h-48 items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"><LoaderCircle className="h-5 w-5 animate-spin text-[#2846C7]" /> Loading published syllabi…</div>
          ) : records.length ? (
            <div className="space-y-3">
              {groups.map((group, index) => (
                <details key={`${group.regulation}-${group.year}`} open={index === 0 || group.branches.some(branch => String(branch.departmentId) === String(selected.department_id))} className="syllabus-result-group group rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 sm:p-4">
                  <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                    <span className="flex items-center justify-between gap-3">
                      <span><span className="block font-bold text-[#16265C] dark:text-white">{group.regulation} · Academic Year {group.year}</span><span className="text-xs text-slate-600 dark:text-slate-300">{group.branches.reduce((total, branch) => total + branch.records.length, 0)} subjects · {group.branches.length} branches</span></span>
                      <span className="syllabus-expand-pill rounded-full px-3 py-1 text-xs font-semibold">Expand</span>
                    </span>
                  </summary>
                  <div className="mt-4 space-y-3">
                    {group.branches.map((branch, branchIndex) => (
                      <details key={`${branch.branch}-${branch.department || ''}`} data-department-id={branch.departmentId} open={branchIndex === 0 || String(branch.departmentId) === String(selected.department_id)} className="syllabus-branch-group rounded-2xl border border-slate-200 p-3 dark:border-slate-700 sm:p-4">
                        <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                          <span className="flex items-center justify-between gap-3">
                            <span className="font-bold text-[#16265C] dark:text-white">{branch.branch}{branch.department ? ` · ${branch.department}` : ''}<span className="ml-2 text-xs font-medium text-slate-600 dark:text-slate-300">{branch.records.length} subject{branch.records.length === 1 ? '' : 's'}</span></span>
                            <span className="text-xs font-semibold text-[#2846C7] dark:text-[#aebfff]">Branch</span>
                          </span>
                        </summary>
                        <div className="mt-3 grid gap-3 lg:grid-cols-2">
                          {branch.records.map(record => <SyllabusSubjectCard key={record.id} record={record} onPreview={requestResource} onDownload={downloadRecord} />)}
                        </div>
                      </details>
                    ))}
                  </div>
                </details>
              ))}
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-center gap-4 pt-3">
                  <button type="button" disabled={page <= 1} onClick={() => { setLoading(true); setPage(value => value - 1); }} className="syllabus-page-button rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold disabled:opacity-40 dark:border-slate-700">Previous</button>
                  <span className="text-xs text-slate-600 dark:text-slate-300">Page {page} of {pagination.totalPages}</span>
                  <button type="button" disabled={page >= pagination.totalPages} onClick={() => { setLoading(true); setPage(value => value + 1); }} className="syllabus-page-button rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold disabled:opacity-40 dark:border-slate-700">Next</button>
                </div>
              )}
            </div>
          ) : (
            <div className="syllabus-empty rounded-3xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center dark:border-slate-700 dark:bg-slate-900">
              <BookOpen className="mx-auto h-9 w-9 text-slate-400" />
              <h3 className="mt-3 font-bold">No published resources found</h3>
              <p className="mx-auto mt-1 max-w-lg text-sm text-slate-500 dark:text-slate-400">{selectedDepartment || Object.values(selected).some(Boolean) ? 'No published resources are available for this selection yet.' : search ? 'Try another search or clear some filters.' : 'Published course resources will appear here when they are added to the library.'}</p>
              {(search || Object.values(selected).some(Boolean)) && <button type="button" onClick={() => { setSelected(EMPTY_FILTERS); setSelectedDepartment(''); setSearch(''); setPage(1); setLoading(true); }} className="syllabus-portal-button mt-4">Clear search and filters</button>}
            </div>
          )}
        </section>
      </main>
      <footer className="border-t border-[#dbe2f0] bg-white px-4 py-5 text-center text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
        <span className="font-semibold text-[#16265C] dark:text-white">VNRVJIET</span> · Syllabus Library
      </footer>
      <SyllabusPreviewModal record={preview} onClose={closePreview} onDownload={downloadRecord} downloadError={downloadError} />
    </div>
  );
}
