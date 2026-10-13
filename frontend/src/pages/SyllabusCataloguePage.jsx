import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api, apiRequest } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { AlertCircle, BookOpen, CheckCircle2, FilePlus2, Pencil, Plus, Search, Trash2, Upload, X } from 'lucide-react';
import SyllabusMasterDataManager from '../components/syllabus/SyllabusMasterDataManager';

const EMPTY_FORM = {
  file_id: '',
  program: '',
  regulation: '',
  academic_year: '',
  department_id: '',
  branch_code: '',
  semester: '',
  subject_code: '',
  subject_name: '',
  resource_type: 'syllabus',
  student_visible: false,
  published: false
};
const PROGRAM_SUGGESTIONS = ['B.Tech', 'B.Tech Minor', 'B.Tech Honors', 'M.Tech', 'MCA', 'Diploma'];

export default function SyllabusCataloguePage() {
  const { isAdmin, isHOD, isFaculty } = useAuth();
  const [records, setRecords] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [regulations, setRegulations] = useState([]);
  const [masterDataError, setMasterDataError] = useState('');
  const [masterDataLoading, setMasterDataLoading] = useState(true);
  const [pdfFiles, setPdfFiles] = useState([]);
  const [catalogueFilters, setCatalogueFilters] = useState({ programs: [], regulations: [], academic_years: [], departments: [], branches: [], semesters: [] });
  const [form, setForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState(null);
  const [uploadMode, setUploadMode] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState({ program: '', regulation: '', department_id: '', branch_code: '', semester: '', published: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [activeTab, setActiveTab] = useState('catalogue');

  const loadMasterData = useCallback(async () => {
    try {
      const data = await api.get('/syllabus/master-data');
      setDepartments(data.departments || []);
      setRegulations(data.regulations || []);
      setMasterDataError('');
    } catch (err) {
      setMasterDataError(err.message || 'Unable to load active regulations and departments.');
    } finally {
      setMasterDataLoading(false);
    }
  }, []);

  const loadCataloguePage = useCallback(async requestedPage => {
    setLoading(true);
    try {
      const data = await api.get('/syllabus', { ...filters, q: query, page: requestedPage, limit: 25 });
      setRecords(data.syllabus || []);
      setTotalPages(data.pagination?.totalPages || 1);
      setError('');
    } catch (err) {
      setError(err.message || 'Unable to load catalogue records.');
    } finally {
      setLoading(false);
    }
  }, [filters, query]);

  useEffect(() => {
    loadMasterData();
    if (isAdmin || isHOD || isFaculty) {
      api.get('/syllabus/filters').then(setCatalogueFilters).catch(err => setError(err.message || 'Unable to load catalogue filters.'));
    }
  }, [isAdmin, isHOD, isFaculty, loadMasterData]);

  useEffect(() => {
    if (isAdmin || isHOD || isFaculty) loadCataloguePage(page);
  }, [isAdmin, isHOD, isFaculty, loadCataloguePage, page]);

  useEffect(() => {
    const fileId = new URLSearchParams(window.location.search).get('fileId');
    if (!fileId || !/^\d+$/.test(fileId)) return;
    let active = true;
    loadPdfFiles().then(files => {
      if (!active) return;
      const file = files.find(item => String(item.id) === fileId);
      if (!file) {
        setError('That PDF is already linked to a resource or is not available to your account.');
        return;
      }
      setForm({
        ...EMPTY_FORM,
        file_id: fileId,
        department_id: String(file.department_id || ''),
        branch_code: file.department_code || '',
        student_visible: !isAdmin
      });
      setUploadMode(false);
      setFormOpen(true);
      window.history.replaceState({}, '', window.location.pathname);
    });
    return () => { active = false; };
  }, []);

  const loadPdfFiles = async (catalogueId = null) => {
    try {
      const data = await api.get('/syllabus/files', catalogueId ? { catalogue_id: catalogueId } : undefined);
      setPdfFiles(data.files || []);
      return data.files || [];
    } catch (err) {
      setError(err.message || 'Unable to load available PDFs.');
      return [];
    }
  };

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditing(null);
    setUploadFile(null);
    setUploadMode(false);
    setFormOpen(false);
    setError('');
  };

  const startCreate = async () => {
    resetForm();
    setForm(current => ({ ...current, student_visible: !isAdmin }));
    setUploadMode(false);
    await loadPdfFiles();
    setFormOpen(true);
  };

  const startEdit = async record => {
    setEditing(record.id);
    setForm({
      file_id: String(record.file_id),
      program: record.program,
      regulation: record.regulation,
      academic_year: record.academic_year,
      department_id: String(record.department_id),
      branch_code: record.branch_code,
      semester: record.semester,
      subject_code: record.subject_code,
      subject_name: record.subject_name,
      resource_type: record.resource_type || 'syllabus',
      student_visible: Boolean(record.student_visible),
      published: Boolean(record.published)
    });
    setUploadFile(null);
    setUploadMode(false);
    setError('');
    setFormOpen(true);
    await loadPdfFiles(record.id);
  };

  const availableDepartments = useMemo(() => departments || [], [departments]);
  const editingRecord = records.find(record => String(record.id) === String(editing));
  const filterOptions = {
    program: catalogueFilters.programs,
    regulation: catalogueFilters.regulations,
    branch_code: catalogueFilters.branches,
    semester: catalogueFilters.semesters
  };

  const handleSubmit = async event => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    let fileId = form.file_id;
    try {
      if (uploadMode) {
        if (!uploadFile) throw new Error('Choose a PDF file to upload.');
        if (uploadFile.type !== 'application/pdf' && !uploadFile.name.toLowerCase().endsWith('.pdf')) {
          throw new Error('Only PDF files can be added to the syllabus library.');
        }
        const body = new FormData();
        body.append('files', uploadFile);
        body.append('visibility', 'public');
        const uploaded = await apiRequest('/files/upload', { method: 'POST', body });
        fileId = String(uploaded.files?.[0]?.id || '');
        if (!fileId) throw new Error('PDF uploaded, but the file record was not returned.');
      }
      if (!fileId) throw new Error('Choose an existing PDF or upload one.');
      const payload = { ...form, file_id: Number(fileId), department_id: Number(form.department_id) };
      if (editing) {
        await api.put(`/syllabus/${editing}`, payload);
        setMessage('Syllabus catalogue entry updated.');
      } else {
        const result = await api.post('/syllabus', payload);
        setMessage(result.message || 'Syllabus catalogue entry created.');
      }
      window.dispatchEvent(new Event('syllabus-catalogue-updated'));
      resetForm();
      setPage(1);
      await loadCataloguePage(1);
      const updatedFilters = await api.get('/syllabus/filters');
      setCatalogueFilters(updatedFilters);
    } catch (err) {
      setError(err.message || 'Unable to save syllabus metadata.');
      if (uploadMode && fileId) {
        setUploadMode(false);
        setForm(current => ({ ...current, file_id: fileId }));
      }
      if (isAdmin) await loadPdfFiles(editing);
    } finally {
      setSaving(false);
    }
  };

  const togglePublished = async record => {
    setError('');
    setMessage('');
    try {
      await api.patch(`/syllabus/${record.id}/published`, { published: !record.published });
      setMessage(!record.published ? 'Syllabus published to the student library.' : 'Syllabus unpublished.');
      window.dispatchEvent(new Event('syllabus-catalogue-updated'));
      setPage(1);
      await loadCataloguePage(1);
      setCatalogueFilters(await api.get('/syllabus/filters'));
    } catch (err) {
      setError(err.message || 'Unable to update publication status.');
    }
  };

  const unlinkRecord = async record => {
    if (!window.confirm(`Unlink ${record.subject_code} from the syllabus catalogue? The stored file will not be deleted.`)) return;
    setError('');
    setMessage('');
    try {
      await api.delete(`/syllabus/${record.id}`);
      setMessage('Catalogue metadata unlinked. The stored file remains available in file management.');
      setPage(1);
      await loadCataloguePage(1);
    } catch (err) {
      setError(err.message || 'Unable to unlink the catalogue entry.');
    }
  };

  const updateFilter = (key, value) => {
    setFilters(current => ({ ...current, [key]: value }));
    setPage(1);
  };
  if (!isAdmin && !isHOD && !isFaculty) {
    return <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">Syllabus Catalogue is available to Admin accounts only.</div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-extrabold text-slate-900 dark:text-white"><BookOpen className="h-5 w-5 text-indigo-600" /> {isAdmin ? 'Syllabus Catalogue' : 'My Student Resources'}</h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{isAdmin ? 'Manage PDF metadata and publication for the student library.' : 'Submit and manage your own resources; Admin review is required before student access.'}</p>
        </div>
        {(activeTab === 'catalogue' || !isAdmin) && <button type="button" onClick={startCreate} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-indigo-700"><Plus className="h-4 w-4" /> {isAdmin ? 'Add syllabus' : 'Submit syllabus'}</button>}
      </div>

      {isAdmin && <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3 dark:border-slate-800" role="tablist" aria-label="Syllabus catalogue management">
        {[
          ['catalogue', 'Syllabus Records'],
          ['regulations', 'Manage Regulations'],
          ['departments', 'Manage Departments']
        ].map(([tab, label]) => (
          <button key={tab} type="button" role="tab" aria-selected={activeTab === tab} onClick={() => {
            setActiveTab(tab);
            if (tab === 'catalogue') loadMasterData();
          }} className={`rounded-xl border px-4 py-2 text-xs font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${activeTab === tab ? 'border-[#16265C] bg-[#16265C] text-white shadow-md' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'}`}>
            {label}
          </button>
        ))}
      </div>}

      {isAdmin && activeTab !== 'catalogue' ? (
        <SyllabusMasterDataManager type={activeTab} />
      ) : (
      <>
      {message && <div role="status" className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"><CheckCircle2 className="h-4 w-4" />{message}</div>}
      {error && <div role="alert" className="flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-800 dark:bg-rose-950/40 dark:text-rose-200"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}
      {masterDataError && activeTab === 'catalogue' && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">{masterDataError}</div>}

      {formOpen && (
        <section className="rounded-2xl border border-indigo-200 bg-white p-4 shadow-sm sm:p-6 dark:border-indigo-900 dark:bg-slate-900" aria-labelledby="syllabus-form-title">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div><h2 id="syllabus-form-title" className="font-bold">{editing ? 'Edit syllabus metadata' : 'Add syllabus'}</h2><p className="text-xs text-slate-500">Only PDF files can be listed in the public library.</p></div>
            <button type="button" onClick={resetForm} aria-label="Close form" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!editing && (
              <div className="grid gap-2 sm:grid-cols-2">
                <button type="button" onClick={() => setUploadMode(false)} className={`flex items-center gap-2 rounded-xl border p-3 text-left text-xs font-semibold ${!uploadMode ? 'border-indigo-500 bg-indigo-50 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200' : 'border-slate-200 dark:border-slate-700'}`}><FilePlus2 className="h-4 w-4" /> Select existing PDF</button>
                <button type="button" onClick={() => setUploadMode(true)} className={`flex items-center gap-2 rounded-xl border p-3 text-left text-xs font-semibold ${uploadMode ? 'border-indigo-500 bg-indigo-50 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200' : 'border-slate-200 dark:border-slate-700'}`}><Upload className="h-4 w-4" /> Upload a new PDF</button>
              </div>
            )}
            {uploadMode ? (
              <label className="block text-xs font-semibold">Resource PDF
                <input type="file" accept="application/pdf,.pdf" required onChange={event => setUploadFile(event.target.files?.[0] || null)} className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 p-2 text-sm dark:border-slate-700 dark:bg-slate-800" />
              </label>
            ) : (
              <label className="block text-xs font-semibold">Stored PDF file
                <select required value={form.file_id} onChange={event => setForm(current => ({ ...current, file_id: event.target.value }))} className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
                  <option value="">Select an unlinked PDF</option>
                  {pdfFiles.map(file => <option key={file.id} value={file.id}>{file.name} · {file.visibility}</option>)}
                </select>
              </label>
            )}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <label className="text-xs font-semibold">Resource Type
                <select required value={form.resource_type} onChange={event => setForm(current => ({ ...current, resource_type: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
                  <option value="syllabus">Syllabus</option>
                  <option value="faculty_note">Faculty Note</option>
                </select>
              </label>
              <label className="text-xs font-semibold">Program
                <select required value={form.program} onChange={event => setForm(current => ({ ...current, program: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
                  <option value="">Select programme</option>
                  {!PROGRAM_SUGGESTIONS.includes(form.program) && form.program && <option value={form.program}>{form.program}</option>}
                  {PROGRAM_SUGGESTIONS.map(program => <option key={program} value={program}>{program}</option>)}
                </select>
              </label>
              <label className="text-xs font-semibold">Regulation
                <select required value={form.regulation} onChange={event => setForm(current => ({ ...current, regulation: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
                  <option value="">{masterDataLoading ? 'Loading regulations…' : regulations.length ? 'Select active regulation' : 'No active regulations configured'}</option>
                  {regulations.map(regulation => <option key={regulation.id} value={regulation.code}>{regulation.display_name} ({regulation.code})</option>)}
                  {editingRecord && form.regulation && !regulations.some(regulation => regulation.code === form.regulation) &&
                    <option value={form.regulation}>{form.regulation} (inactive)</option>}
                </select>
                {!masterDataLoading && !regulations.length && <span className="mt-1 block text-amber-700 dark:text-amber-300">Ask an Admin to configure active academic regulations.</span>}
              </label>
              <TextField label="Academic Year" name="academic_year" form={form} setForm={setForm} maxLength={40} placeholder="e.g. 2025–26" />
              <label className="text-xs font-semibold">Department
                <select required value={form.department_id} onChange={event => {
                  const department = availableDepartments.find(item => String(item.id) === event.target.value);
                  setForm(current => ({ ...current, department_id: event.target.value, branch_code: department?.code || current.branch_code }));
                }} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
                  <option value="">{masterDataLoading ? 'Loading departments…' : 'Select department'}</option>
                  {availableDepartments.map(department => <option key={department.id} value={department.id}>{department.name} ({department.code})</option>)}
                  {editingRecord && form.department_id && !availableDepartments.some(department => String(department.id) === String(form.department_id)) &&
                    <option value={form.department_id}>{editingRecord.department_name || editingRecord.department_code || 'Department'} (inactive)</option>}
                </select>
                {!masterDataLoading && !availableDepartments.length && <span className="mt-1 block text-amber-700 dark:text-amber-300">Ask an Admin to configure active departments.</span>}
              </label>
              <TextField label="Branch Code" name="branch_code" form={form} setForm={setForm} maxLength={80} placeholder="e.g. CSE" />
              <TextField label="Semester" name="semester" form={form} setForm={setForm} maxLength={20} placeholder="e.g. 1" />
              <TextField label="Subject Code" name="subject_code" form={form} setForm={setForm} maxLength={80} placeholder="e.g. CS101" />
              <label className="text-xs font-semibold sm:col-span-2">Subject Name
                <input required maxLength="200" value={form.subject_name} onChange={event => setForm(current => ({ ...current, subject_name: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
              </label>
              <label className="flex items-center gap-2 self-end rounded-xl border border-slate-200 p-3 text-xs font-semibold dark:border-slate-700">
                <input type="checkbox" checked={form.student_visible} onChange={event => setForm(current => ({ ...current, student_visible: event.target.checked }))} />
                Visible to students after Admin publishes
              </label>
              {isAdmin && <label className="flex items-center gap-2 self-end rounded-xl border border-slate-200 p-3 text-xs font-semibold dark:border-slate-700">
                <input type="checkbox" checked={form.published} onChange={event => setForm(current => ({ ...current, published: event.target.checked }))} />
                Publish in student library
              </label>}
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
              <button type="button" onClick={resetForm} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold dark:border-slate-700">Cancel</button>
              <button type="submit" disabled={saving} className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{saving ? 'Saving…' : editing ? 'Save changes' : 'Add to catalogue'}</button>
            </div>
          </form>
        </section>
      )}

      {(isAdmin || isHOD || isFaculty) && <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900" aria-label="Catalogue filters">
        <label className="relative block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input type="search" value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} placeholder="Search subject, code, branch, or regulation" className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
        </label>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['program', 'Program'],
            ['regulation', 'Regulation'],
            ['department_id', 'Department'],
            ['branch_code', 'Branch'],
            ['semester', 'Semester']
          ].map(([key, label]) => (
            <select key={key} aria-label={`Filter by ${label}`} value={filters[key]} onChange={event => updateFilter(key, event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
              <option value="">All {label.toLowerCase()}s</option>
              {(key === 'department_id' ? catalogueFilters.departments.map(item => ({ value: item.id, label: `${item.name} (${item.code})` })) : (filterOptions[key] || []).map(value => ({ value, label: value }))).map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          ))}
          <select aria-label="Filter by publication status" value={filters.published} onChange={event => updateFilter('published', event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
            <option value="">All publication statuses</option><option value="1">Published</option><option value="0">Unpublished / Review</option>
          </select>
        </div>
      </section>}

      {(isAdmin || isHOD || isFaculty) && <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" aria-label="Syllabus catalogue entries">
        {loading ? <div className="p-10 text-center text-sm text-slate-500">Loading catalogue…</div> : records.length ? (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {records.map(record => (
              <article key={record.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-indigo-50 px-2 py-1 text-[10px] font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">{record.subject_code}</span>
                    <span className="rounded-md bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-800 dark:bg-blue-950 dark:text-blue-200">{record.resource_type === 'faculty_note' ? 'Faculty Note' : 'Syllabus'}</span>
                    {record.student_visible && <span className="rounded-md bg-sky-50 px-2 py-1 text-[10px] font-bold text-sky-800 dark:bg-sky-950 dark:text-sky-200">Student visible</span>}
                    <span className={`rounded-md px-2 py-1 text-[10px] font-bold ${record.published ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300'}`}>{record.published ? 'Published' : 'Unpublished / Review'}</span>
                    {record.visibility !== 'public' && <span className="rounded-md bg-rose-50 px-2 py-1 text-[10px] font-bold text-rose-700 dark:bg-rose-950 dark:text-rose-300">File is private</span>}
                  </div>
                  <h3 className="mt-1 font-bold text-slate-900 dark:text-white">{record.subject_name}</h3>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{record.program} · {record.regulation} · {record.academic_year} · {record.branch_code} · Semester {record.semester}</p>
                  <p className="mt-1 truncate text-xs text-slate-500" title={record.file_name}>{record.file_name}</p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {isAdmin && <button type="button" onClick={() => togglePublished(record)} disabled={!record.published && (record.visibility !== 'public' || record.deleted_at !== null)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold disabled:opacity-40 dark:border-slate-700">{record.published ? 'Unpublish' : 'Publish'}</button>}
                  <button type="button" onClick={() => startEdit(record)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold dark:border-slate-700"><Pencil className="h-3.5 w-3.5" /> Edit</button>
                  <button type="button" onClick={() => unlinkRecord(record)} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 dark:border-rose-900 dark:text-rose-300"><Trash2 className="h-3.5 w-3.5" /> Unlink</button>
                </div>
              </article>
            ))}
          </div>
        ) : <div className="p-10 text-center"><BookOpen className="mx-auto h-8 w-8 text-slate-400" /><p className="mt-3 font-semibold">No syllabus entries yet</p><p className="mt-1 text-xs text-slate-500">Add a PDF from existing files or upload one to begin.</p></div>}
        {totalPages > 1 && <div className="flex items-center justify-center gap-4 border-t border-slate-100 p-3 dark:border-slate-800"><button type="button" disabled={page <= 1} onClick={() => setPage(current => current - 1)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold disabled:opacity-40 dark:border-slate-700">Previous</button><span className="text-xs text-slate-500">Page {page} of {totalPages}</span><button type="button" disabled={page >= totalPages} onClick={() => setPage(current => current + 1)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold disabled:opacity-40 dark:border-slate-700">Next</button></div>}
      </section>}
      </>
      )}
    </div>
  );
}

function TextField({ label, name, form, setForm, maxLength, placeholder }) {
  return (
    <label className="text-xs font-semibold">{label}
      <input required maxLength={maxLength} value={form[name]} onChange={event => setForm(current => ({ ...current, [name]: event.target.value }))} placeholder={placeholder} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
    </label>
  );
}
