import React, { useState, useEffect } from 'react';
import { Building2, Plus, Users, Files, HardDrive, Edit3, Trash2, Shield, Check, X, CheckCircle2 } from 'lucide-react';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { formatBytes } from '../utils/formatters';
import ConfirmDialog from '../components/common/ConfirmDialog';

export default function DepartmentsPage({ onSelectDepartment }) {
  const { user, isAdmin } = useAuth();
  const [departments, setDepartments] = useState([]);
  const [facultyUsers, setFacultyUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [deptToEdit, setDeptToEdit] = useState(null);
  const [deptToDelete, setDeptToDelete] = useState(null);
  const [deptToAssignHOD, setDeptToAssignHOD] = useState(null);

  // Form states
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [selectedHodId, setSelectedHodId] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadDepartments();
    loadFaculty();
  }, []);

  const loadDepartments = async () => {
    setLoading(true);
    try {
      const data = await api.get('/departments');
      setDepartments(data.departments || []);
    } catch (err) {
      console.warn('Failed to load departments:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadFaculty = async () => {
    try {
      const data = await api.get('/users', { allow_all: '1', status: 'active' });
      setFacultyUsers(data.users || []);
    } catch (e) {
      console.warn(e);
    }
  };

  const handleCreateDepartment = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError('');

    try {
      await api.post('/departments', {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        hod_id: selectedHodId ? Number(selectedHodId) : null
      });

      setMessage(`Department "${name}" created with standard academic folders.`);
      setShowAddModal(false);
      setName('');
      setCode('');
      setSelectedHodId('');
      loadDepartments();
    } catch (err) {
      setFormError(err.message || 'Failed to create department.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleUpdateDepartment = async (e) => {
    e.preventDefault();
    if (!deptToEdit) return;

    setFormLoading(true);
    setFormError('');

    try {
      await api.put(`/departments/${deptToEdit.id}`, {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        hod_id: selectedHodId ? Number(selectedHodId) : null
      });

      setMessage(`Department "${name}" updated.`);
      setDeptToEdit(null);
      setName('');
      setCode('');
      setSelectedHodId('');
      loadDepartments();
    } catch (err) {
      setFormError(err.message || 'Failed to update department.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleAssignHOD = async (e) => {
    e.preventDefault();
    if (!deptToAssignHOD || !selectedHodId) return;

    setFormLoading(true);
    try {
      await api.post(`/departments/${deptToAssignHOD.id}/assign-hod`, {
        user_id: Number(selectedHodId)
      });

      setMessage('HOD assigned successfully.');
      setDeptToAssignHOD(null);
      setSelectedHodId('');
      loadDepartments();
    } catch (err) {
      setFormError(err.message || 'Failed to assign HOD.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deptToDelete) return;
    try {
      await api.delete(`/departments/${deptToDelete.id}`);
      setDepartments(prev => prev.filter(d => d.id !== deptToDelete.id));
      setDeptToDelete(null);
      setMessage('Department deleted.');
    } catch (err) {
      alert('Failed to delete department: ' + err.message);
    }
  };

  const openEditModal = (d) => {
    setDeptToEdit(d);
    setName(d.name);
    setCode(d.code);
    setSelectedHodId(d.hod_id || '');
    setFormError('');
  };

  return (
    <div className="space-y-5 text-left">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3 dark:border-slate-800">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Building2 className="h-5 w-5 text-brand-600" />
            College Departments & HOD Assignments
          </h2>
          <p className="text-xs text-slate-400">
            Organize faculty hierarchy, assign department heads, and monitor departmental storage quotas.
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => {
              setName('');
              setCode('');
              setSelectedHodId('');
              setFormError('');
              setShowAddModal(true);
            }}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-700 via-indigo-600 to-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-indigo-500/20 hover:from-blue-800 hover:to-indigo-700 transition active:scale-95 cursor-pointer"
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
            <span>Add Department</span>
          </button>
        )}
      </div>

      {message && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-2.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          {message}
        </div>
      )}

      {/* Departments Grid */}
      {loading ? (
        <div className="py-20 text-center text-xs text-slate-400 animate-pulse">
          Loading departments...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {departments.map((dept) => (
            <div
              key={dept.id}
                className="flex min-w-0 flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand-400 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
            >
              <div>
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-2.5">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-sm font-bold text-brand-600 dark:bg-brand-950 dark:text-brand-400">
                      {dept.code}
                    </div>
                      <div className="min-w-0">
                        <h4 className="break-words text-sm font-bold leading-5 text-slate-900 dark:text-slate-100">
                        {dept.name}
                      </h4>
                      <p className="text-[11px] text-slate-400">Code: {dept.code}</p>
                    </div>
                  </div>

                  {isAdmin && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(dept)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                        title="Edit Department"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setDeptToDelete(dept)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50 dark:hover:text-rose-400"
                        title="Delete Department"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* HOD Assignment Box */}
                <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs dark:bg-slate-850">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Head of Department (HOD)
                    </span>
                    {isAdmin && (
                      <button
                        onClick={() => { setDeptToAssignHOD(dept); setSelectedHodId(dept.hod_id || ''); }}
                        className="text-[10px] font-semibold text-brand-600 hover:underline dark:text-brand-400"
                      >
                        {dept.hod_name ? 'Change HOD' : 'Assign HOD'}
                      </button>
                    )}
                  </div>
                  <div className="mt-1 font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Shield className="h-3.5 w-3.5 text-purple-600" />
                    {dept.assigned_hod_names || dept.hod_name
                      ? <span className="min-w-0 break-words">{dept.assigned_hod_names || dept.hod_name}</span>
                      : <span className="text-slate-400 font-normal italic">Unassigned</span>}
                  </div>
                </div>

                {/* Metrics */}
                <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 text-center text-xs dark:border-slate-800">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Faculty</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {dept.faculty_count || 0}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Files</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {dept.file_count || 0}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Storage</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {formatBytes(dept.storage_used || 0)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Department Modal */}
      {(showAddModal || deptToEdit) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 text-left">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                {deptToEdit ? 'Edit Department' : 'Create Department'}
              </h3>
              <button
                onClick={() => { setShowAddModal(false); setDeptToEdit(null); }}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="mt-3 rounded-xl bg-rose-50 p-2.5 text-xs text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
                {formError}
              </div>
            )}

            <form onSubmit={deptToEdit ? handleUpdateDepartment : handleCreateDepartment} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Department Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Computer Science & Engineering"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Department Code</label>
                <input
                  type="text"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="e.g. CSE, ECE, MECH"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Assign HOD</label>
                <select
                  value={selectedHodId}
                  onChange={(e) => setSelectedHodId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <option value="">No HOD (Unassigned)</option>
                  {facultyUsers.map(f => (
                    <option key={f.id} value={f.id}>{f.full_name} (@{f.username})</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 pt-4 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => { setShowAddModal(false); setDeptToEdit(null); }}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="rounded-xl bg-brand-600 px-5 py-2 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  {formLoading ? 'Saving...' : deptToEdit ? 'Save Changes' : 'Create Department'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign HOD Modal */}
      {deptToAssignHOD && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 text-left">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                Assign HOD for {deptToAssignHOD.name}
              </h3>
              <button onClick={() => setDeptToAssignHOD(null)} className="rounded-full p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAssignHOD} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Select Faculty Member to appoint as HOD
                </label>
                <select
                  required
                  value={selectedHodId}
                  onChange={(e) => setSelectedHodId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <option value="">Select Faculty...</option>
                  {facultyUsers.map(f => (
                    <option key={f.id} value={f.id}>{f.full_name} - @{f.username} ({f.email})</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 pt-4 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setDeptToAssignHOD(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading || !selectedHodId}
                  className="rounded-xl bg-brand-600 px-5 py-2 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  {formLoading ? 'Assigning...' : 'Confirm HOD'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Department Confirmation */}
      <ConfirmDialog
        isOpen={Boolean(deptToDelete)}
        title="Delete Department"
        message={`Are you sure you want to delete "${deptToDelete?.name}" (${deptToDelete?.code})? Faculty will be unlinked from this department.`}
        confirmText="Delete Department"
        isDanger={true}
        onClose={() => setDeptToDelete(null)}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
