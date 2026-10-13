import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../../utils/api';
import { AlertCircle, CheckCircle2, LoaderCircle, Pencil, Plus, Search, ToggleLeft, ToggleRight } from 'lucide-react';

const EMPTY_REGULATION = { code: '', display_name: '', programme: '', effective_from: '', description: '', sort_order: 0, active: true };
const EMPTY_DEPARTMENT = { name: '', code: '', display_group: 'ENGINEERING', sort_order: 0, active: true };
const DEPARTMENT_GROUPS = ['ENGINEERING', 'CSE & IT', 'SCIENCES & HUMANITIES', 'OTHER'];

export default function SyllabusMasterDataManager({ type }) {
  const regulationsMode = type === 'regulations';
  const [rows, setRows] = useState([]);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(regulationsMode ? EMPTY_REGULATION : EMPTY_DEPARTMENT);
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadRows = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    setError('');
    try {
      if (regulationsMode) {
        const data = await api.get('/academic-regulations');
        setRows(data.regulations || []);
      } else {
        const data = await api.get('/departments');
        setRows(data.departments || []);
      }
    } catch (err) {
      setError(err.message || `Unable to load ${regulationsMode ? 'regulations' : 'departments'}.`);
    } finally {
      setLoading(false);
    }
  }, [regulationsMode]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  const resetForm = () => {
    setEditing(null);
    setForm(regulationsMode ? EMPTY_REGULATION : EMPTY_DEPARTMENT);
    setFormOpen(false);
  };

  const startEdit = row => {
    setEditing(row.id);
    setForm(regulationsMode
      ? { code: row.code, display_name: row.display_name, programme: row.programme || '', effective_from: row.effective_from || '', description: row.description || '', sort_order: row.sort_order || 0, active: Boolean(row.active) }
      : { name: row.name, code: row.code, display_group: row.display_group || 'OTHER', sort_order: row.sort_order || 0, active: Boolean(row.active) });
  };

  const submit = async event => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const endpoint = regulationsMode ? '/academic-regulations' : '/departments';
      if (editing) {
        await api.put(`${endpoint}/${editing}`, form);
      } else {
        await api.post(endpoint, form);
      }
      setMessage(`${regulationsMode ? 'Regulation' : 'Department'} ${editing ? 'updated' : 'created'} successfully.`);
      resetForm();
      await loadRows(true);
    } catch (err) {
      setError(err.message || `Unable to save ${regulationsMode ? 'regulation' : 'department'}.`);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async row => {
    setError('');
    setMessage('');
    try {
      const endpoint = regulationsMode ? '/academic-regulations' : '/departments';
      await api.patch(`${endpoint}/${row.id}/status`, { active: !row.active });
      setMessage(`${regulationsMode ? 'Regulation' : 'Department'} ${row.active ? 'deactivated' : 'activated'}.`);
      await loadRows(true);
    } catch (err) {
      setError(err.message || `Unable to update ${regulationsMode ? 'regulation' : 'department'} status.`);
    }
  };

  const filteredRows = rows.filter(row => {
    const haystack = regulationsMode
      ? `${row.code} ${row.display_name} ${row.programme || ''}`
      : `${row.name} ${row.code} ${row.display_group || ''}`;
    return haystack.toLowerCase().includes(query.trim().toLowerCase());
  });
  const title = regulationsMode ? 'Manage Regulations' : 'Manage Departments';

  return (
    <section className="space-y-4" aria-labelledby={`master-data-${type}-heading`}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id={`master-data-${type}-heading`} className="text-lg font-extrabold text-slate-900 dark:text-white">{title}</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {regulationsMode ? 'Maintain academic regulation choices without removing historical syllabus links.' : 'Maintain active directory departments while preserving existing faculty and HOD relationships.'}
          </p>
        </div>
        <button type="button" onClick={() => { resetForm(); setFormOpen(true); }} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-indigo-700">
          <Plus className="h-4 w-4" /> Add {regulationsMode ? 'regulation' : 'department'}
        </button>
      </div>

      {message && <div role="status" className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"><CheckCircle2 className="h-4 w-4" />{message}</div>}
      {error && <div role="alert" className="flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-800 dark:bg-rose-950/40 dark:text-rose-200"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}

      {formOpen && (
        <form onSubmit={submit} className="grid gap-3 rounded-2xl border border-indigo-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-3 dark:border-indigo-900 dark:bg-slate-900">
          {regulationsMode ? (
            <>
              <label className="text-xs font-semibold">Code<input required maxLength="30" value={form.code} onChange={event => setForm(current => ({ ...current, code: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" /></label>
              <label className="text-xs font-semibold">Display name<input required maxLength="100" value={form.display_name} onChange={event => setForm(current => ({ ...current, display_name: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" /></label>
              <label className="text-xs font-semibold">Programme (optional)<input maxLength="80" value={form.programme} onChange={event => setForm(current => ({ ...current, programme: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" placeholder="B.Tech" /></label>
              <label className="text-xs font-semibold">Effective from<input maxLength="80" value={form.effective_from} onChange={event => setForm(current => ({ ...current, effective_from: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" placeholder="2025 onwards" /></label>
              <label className="text-xs font-semibold sm:col-span-2">Description<textarea maxLength="500" rows="2" value={form.description} onChange={event => setForm(current => ({ ...current, description: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" /></label>
            </>
          ) : (
            <>
              <label className="text-xs font-semibold">Department name<input required maxLength="120" value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" /></label>
              <label className="text-xs font-semibold">Department code<input required maxLength="40" value={form.code} onChange={event => setForm(current => ({ ...current, code: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm uppercase dark:border-slate-700 dark:bg-slate-800 dark:text-white" /></label>
              <label className="text-xs font-semibold">Display group<select value={form.display_group} onChange={event => setForm(current => ({ ...current, display_group: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">{DEPARTMENT_GROUPS.map(group => <option key={group}>{group}</option>)}</select></label>
            </>
          )}
          <label className="text-xs font-semibold">Sort order<input type="number" min="0" max="100000" value={form.sort_order} onChange={event => setForm(current => ({ ...current, sort_order: Number(event.target.value) }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" /></label>
          <label className="flex items-center gap-2 self-end rounded-xl border border-slate-200 p-3 text-xs font-semibold dark:border-slate-700"><input type="checkbox" checked={form.active} onChange={event => setForm(current => ({ ...current, active: event.target.checked }))} />Active</label>
          <div className="flex items-end justify-end gap-2">
            <button type="button" onClick={() => { setFormOpen(false); resetForm(); }} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold dark:border-slate-700">Cancel</button>
            <button type="submit" disabled={saving} className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{saving ? 'Saving…' : editing ? 'Save changes' : 'Add'}</button>
          </div>
        </form>
      )}

      <label className="relative block max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={`Search ${regulationsMode ? 'regulations' : 'departments'}…`} className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
      </label>

      {loading ? (
        <div className="flex min-h-28 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900"><LoaderCircle className="h-4 w-4 animate-spin" />Loading {regulationsMode ? 'regulations' : 'departments'}…</div>
      ) : filteredRows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900">{query ? 'No matching records.' : `No ${regulationsMode ? 'regulations' : 'departments'} have been added.`}</div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full min-w-180 text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-300">
              <tr>
                <th className="px-4 py-3">{regulationsMode ? 'Code / Name' : 'Department'}</th>
                <th className="px-4 py-3">{regulationsMode ? 'Programme' : 'Group'}</th>
                <th className="px-4 py-3">Sort</th>
                <th className="px-4 py-3">Linked syllabi</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredRows.map(row => (
                <tr key={row.id} className="text-slate-700 dark:text-slate-200">
                  <td className="px-4 py-3"><span className="block font-bold">{regulationsMode ? row.code : row.name}</span><span className="text-xs text-slate-500">{regulationsMode ? row.display_name : row.code}</span></td>
                  <td className="px-4 py-3">{regulationsMode ? row.programme || 'All programmes' : row.display_group || 'OTHER'}</td>
                  <td className="px-4 py-3">{row.sort_order}</td>
                  <td className="px-4 py-3">{row.linked_syllabus_count ?? row.syllabus_count ?? 0}</td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-bold ${row.active ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>{row.active ? 'Active' : 'Inactive'}</span></td>
                  <td className="px-4 py-3"><div className="flex items-center gap-2">
                    <button type="button" onClick={() => { startEdit(row); setFormOpen(true); }} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"><Pencil className="h-3.5 w-3.5" />Edit</button>
                    <button type="button" onClick={() => toggleActive(row)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">{row.active ? <ToggleRight className="h-3.5 w-3.5" /> : <ToggleLeft className="h-3.5 w-3.5" />}{row.active ? 'Deactivate' : 'Activate'}</button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
