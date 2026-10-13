import React, { useState, useEffect } from 'react';
import { Share2, X, Users, Building2, Shield, Check, Trash2, UserPlus } from 'lucide-react';
import { api } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

export default function FileShareModal({ isOpen, onClose, file, onShareUpdated }) {
  const { user } = useAuth();
  const [facultyList, setFacultyList] = useState([]);
  const [deptList, setDeptList] = useState([]);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [selectedDeptIds, setSelectedDeptIds] = useState([]);
  const [permission, setPermission] = useState('view_download');
  const [existingShares, setExistingShares] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && file) {
      loadInitialData();
    }
  }, [isOpen, file]);

  const loadInitialData = async () => {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      // Load all faculty for sharing (allow_all=1 for HOD/admin/faculty selection)
      const usersData = await api.get('/users', { allow_all: '1', status: 'active' });
      setFacultyList((usersData.users || []).filter(u => u.id !== user.id));

      const deptsData = await api.get('/departments');
      setDeptList(deptsData.departments || []);

      // Load existing file shares
      const fileData = await api.get(`/files/${file.id}`);
      setExistingShares(fileData.shares || []);
    } catch (err) {
      setError('Failed to load sharing details.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !file) return null;

  const handleToggleUser = (userId) => {
    setSelectedUserIds(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleToggleDept = (deptId) => {
    setSelectedDeptIds(prev => 
      prev.includes(deptId) ? prev.filter(id => id !== deptId) : [...prev, deptId]
    );
  };

  const handleShareSubmit = async (e) => {
    e.preventDefault();
    if (selectedUserIds.length === 0 && selectedDeptIds.length === 0) {
      setError('Please select at least one faculty member or department to share with.');
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');

    try {
      const res = await api.post(`/files/${file.id}/share`, {
        user_ids: selectedUserIds,
        department_ids: selectedDeptIds,
        permission
      });

      setMessage(res.message || 'File shared successfully!');
      setSelectedUserIds([]);
      setSelectedDeptIds([]);
      
      // Reload shares
      const fileData = await api.get(`/files/${file.id}`);
      setExistingShares(fileData.shares || []);
      onShareUpdated && onShareUpdated();
    } catch (err) {
      setError(err.message || 'Failed to share file.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveShare = async (shareId) => {
    try {
      await api.delete(`/shares/${shareId}`);
      setExistingShares(prev => prev.filter(s => s.id !== shareId));
      onShareUpdated && onShareUpdated();
    } catch (err) {
      setError('Failed to revoke share access.');
    }
  };

  const handleClose = () => {
    setSelectedUserIds([]);
    setSelectedDeptIds([]);
    setMessage('');
    setError('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 text-left">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-100 text-brand-600 dark:bg-brand-950 dark:text-brand-400">
              <Share2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                Share "{file.name}"
              </h3>
              <p className="text-[11px] text-slate-400">
                Control individual faculty and department-wide access permissions.
              </p>
            </div>
          </div>
          <button onClick={handleClose} className="rounded-full p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="h-5 w-5" />
          </button>
        </div>

        {message && (
          <div className="mt-3 rounded-xl bg-emerald-50 p-2.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
            ✓ {message}
          </div>
        )}

        {error && (
          <div className="mt-3 rounded-xl bg-rose-50 p-2.5 text-xs text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
            {error}
          </div>
        )}

        {/* Existing Active Shares */}
        {existingShares.length > 0 && (
          <div className="mt-4 border-b border-slate-100 pb-4 dark:border-slate-800">
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Currently Shared With ({existingShares.length})
            </h4>
            <div className="max-h-32 space-y-1.5 overflow-y-auto pr-1">
              {existingShares.map(share => (
                <div key={share.id} className="flex items-center justify-between rounded-xl bg-slate-50 p-2 text-xs dark:bg-slate-800/60">
                  <div className="flex items-center gap-2 truncate">
                    {share.shared_with_department ? (
                      <Building2 className="h-4 w-4 text-brand-600 flex-shrink-0" />
                    ) : (
                      <Users className="h-4 w-4 text-purple-600 flex-shrink-0" />
                    )}
                    <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                      {share.shared_with_department_name ? `${share.shared_with_department_name} Dept` : share.shared_with_user_name}
                    </span>
                    <span className="rounded bg-slate-200 px-1.5 py-0.2 text-[10px] text-slate-700 dark:bg-slate-700 dark:text-slate-300 capitalize">
                      {share.permission === 'view_download' ? 'View + Download' : share.permission}
                    </span>
                  </div>
                  <button
                    onClick={() => handleRemoveShare(share.id)}
                    className="text-slate-400 hover:text-rose-500 p-1"
                    title="Revoke access"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Form: Select Faculty and Departments */}
        <form onSubmit={handleShareSubmit} className="mt-4 space-y-4">
          
          {/* Permission Level Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Access Permission Level
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'view', label: 'View Only', desc: 'Can preview file' },
                { id: 'view_download', label: 'View & Download', desc: 'Can preview & download' },
                { id: 'edit', label: 'Edit / Manage', desc: 'Can edit, rename & version' },
              ].map(perm => (
                <button
                  type="button"
                  key={perm.id}
                  onClick={() => setPermission(perm.id)}
                  className={`rounded-xl border p-2.5 text-left transition ${
                    permission === perm.id
                      ? 'border-brand-600 bg-brand-50/60 dark:border-brand-500 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300'
                      : 'border-slate-200 bg-slate-50 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-850 dark:text-slate-300'
                  }`}
                >
                  <div className="font-semibold text-xs">{perm.label}</div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{perm.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Share with Department */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-brand-600" />
              Share with Entire Department
            </label>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1 border border-slate-200 rounded-xl bg-slate-50 dark:border-slate-700 dark:bg-slate-850">
              {deptList.map(dept => {
                const isSelected = selectedDeptIds.includes(dept.id);
                return (
                  <button
                    type="button"
                    key={dept.id}
                    onClick={() => handleToggleDept(dept.id)}
                    className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                      isSelected
                        ? 'bg-brand-600 text-white shadow-sm'
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {isSelected && <Check className="h-3 w-3" />}
                    {dept.code} ({dept.name})
                  </button>
                );
              })}
            </div>
          </div>

          {/* Share with Individual Faculty */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-purple-600" />
              Select Individual Faculty Members
            </label>
            <div className="max-h-36 overflow-y-auto space-y-1 p-1 border border-slate-200 rounded-xl bg-slate-50 dark:border-slate-700 dark:bg-slate-850">
              {facultyList.map(f => {
                const isSelected = selectedUserIds.includes(f.id);
                return (
                  <div
                    key={f.id}
                    onClick={() => handleToggleUser(f.id)}
                    className={`flex cursor-pointer items-center justify-between rounded-lg p-2 text-xs transition ${
                      isSelected
                        ? 'bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300 font-semibold'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700 text-[10px] font-bold">
                        {f.full_name.charAt(0)}
                      </div>
                      <div className="truncate">
                        <span>{f.full_name}</span>
                        <span className="text-[10px] text-slate-400 ml-1.5">({f.email})</span>
                      </div>
                    </div>
                    {isSelected && <Check className="h-4 w-4 text-brand-600" />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Modal Buttons */}
          <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 pt-4 dark:border-slate-800">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={saving || (selectedUserIds.length === 0 && selectedDeptIds.length === 0)}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-700 via-indigo-600 to-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-indigo-500/20 hover:from-blue-800 hover:to-indigo-700 transition active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <UserPlus className="h-4 w-4 stroke-[2.5]" />
              <span>{saving ? 'Sharing...' : 'Share File'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
