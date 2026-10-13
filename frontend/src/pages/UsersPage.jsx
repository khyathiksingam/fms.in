import React, { useState, useEffect } from 'react';
import { 
  Users, UserPlus, Search, Edit3, KeyRound, 
  Trash2, ShieldCheck, UserX, UserCheck, CheckCircle2, X, Save, Shield,
  GraduationCap, Eye, Clock
} from 'lucide-react';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { formatBytes, formatDate } from '../utils/formatters';
import ConfirmDialog from '../components/common/ConfirmDialog';

export default function UsersPage() {
  const { user: currentUser, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('faculty'); // 'faculty' or 'students'
  const [studentToView, setStudentToView] = useState(null);
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([
    { id: 1, name: 'admin', label: 'Administrator' },
    { id: 2, name: 'hod', label: 'Head of Department (HOD)' },
    { id: 3, name: 'faculty', label: 'Faculty Member' },
    { id: 4, name: 'student', label: 'Student' }
  ]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');

  // Modals state
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [userToEdit, setUserToEdit] = useState(null);
  const [userToResetPass, setUserToResetPass] = useState(null);
  const [userToDelete, setUserToDelete] = useState(null);
  const [message, setMessage] = useState('');

  // Form states
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState(3); // Faculty default
  const [selectedDeptId, setSelectedDeptId] = useState('');
  const [studentRollNumber, setStudentRollNumber] = useState('');
  const [studentProgramme, setStudentProgramme] = useState('');
  const [studentAcademicYear, setStudentAcademicYear] = useState('');
  const [studentSemester, setStudentSemester] = useState('');
  const [accountStatus, setAccountStatus] = useState('active');
  const [newPassword, setNewPassword] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    loadUsers();
    loadMeta();
  }, [activeTab, roleFilter, deptFilter]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const effectiveRole = activeTab === 'students' ? 'student' : (roleFilter || '');
      const data = await api.get('/users', {
        role: effectiveRole,
        department_id: deptFilter,
        search: searchQuery
      });
      let resultUsers = data.users || [];
      if (activeTab === 'faculty' && !roleFilter) {
        resultUsers = resultUsers.filter(u => u.role_name !== 'student');
      }
      setUsers(resultUsers);
    } catch (err) {
      console.warn('Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadMeta = async () => {
    try {
      const [rData, dData] = await Promise.all([
        api.get('/users/roles'),
        api.get('/departments')
      ]);
      if (rData && rData.roles && rData.roles.length > 0) {
        setRoles(rData.roles.map(r => ({
          ...r,
          label: r.name === 'admin' ? 'Administrator' : r.name === 'hod' ? 'Head of Department (HOD)' : r.name === 'student' ? 'Student' : 'Faculty Member'
        })));
      }
      setDepartments(dData.departments || []);
    } catch (e) {
      console.warn('Failed to load meta:', e);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadUsers();
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!isAdmin) {
      setFormError('Only Administrator can create accounts.');
      return;
    }

    setFormLoading(true);
    setFormError('');

    try {
      await api.post('/users', {
        full_name: fullName.trim(),
        username: username.trim(),
        email: email.trim(),
        password: password,
        role_id: Number(selectedRoleId),
        department_id: selectedDeptId ? Number(selectedDeptId) : null,
        status: accountStatus,
        ...(roles.find(role => role.id === Number(selectedRoleId))?.name === 'student' ? {
          roll_number: studentRollNumber.trim(),
          programme: studentProgramme.trim(),
          academic_year: studentAcademicYear.trim(),
          semester: studentSemester.trim()
        } : {})
      });

      setMessage(`User account "${fullName}" created successfully.`);
      setShowAddUserModal(false);
      resetForm();
      loadUsers();
    } catch (err) {
      setFormError(err.message || 'Failed to create user.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    if (!userToEdit) return;

    if (!isAdmin) {
      setFormError('Only Administrator can edit user details and change roles.');
      return;
    }

    setFormLoading(true);
    setFormError('');

    try {
      await api.put(`/users/${userToEdit.id}`, {
        full_name: fullName.trim(),
        username: username.trim(),
        email: email.trim(),
        role_id: Number(selectedRoleId),
        department_id: selectedDeptId ? Number(selectedDeptId) : null,
        status: accountStatus,
        ...(roles.find(role => role.id === Number(selectedRoleId))?.name === 'student' ? {
          roll_number: studentRollNumber.trim(),
          programme: studentProgramme.trim(),
          academic_year: studentAcademicYear.trim(),
          semester: studentSemester.trim()
        } : {})
      });

      setMessage(`User account "${fullName}" updated successfully.`);
      setUserToEdit(null);
      resetForm();
      loadUsers();
    } catch (err) {
      setFormError(err.message || 'Failed to update user.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleToggleStatus = async (user) => {
    try {
      const res = await api.patch(`/users/${user.id}/toggle-status`);
      setUsers(prev =>
        prev.map(u => (u.id === user.id ? { ...u, status: res.status } : u))
      );
      setMessage(res.message || 'Status updated.');
    } catch (err) {
      alert('Failed to update status: ' + err.message);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!userToResetPass || !newPassword) return;

    setFormLoading(true);
    setFormError('');

    try {
      const res = await api.post(`/users/${userToResetPass.id}/reset-password`, {
        new_password: newPassword
      });

      setMessage(res.message || 'Password reset successfully.');
      setUserToResetPass(null);
      setNewPassword('');
    } catch (err) {
      setFormError(err.message || 'Failed to reset password.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!userToDelete) return;
    try {
      await api.delete(`/users/${userToDelete.id}`);
      setUsers(prev => prev.filter(u => u.id !== userToDelete.id));
      setUserToDelete(null);
      setMessage('User deleted successfully.');
    } catch (err) {
      alert('Failed to delete user: ' + err.message);
    }
  };

  const openEditModal = (u) => {
    setUserToEdit(u);
    setFullName(u.full_name || '');
    setUsername(u.username || '');
    setEmail(u.email || '');
    setSelectedRoleId(u.role_id || 3);
    setSelectedDeptId(u.department_id || '');
    setStudentRollNumber(u.roll_number || '');
    setStudentProgramme(u.programme || '');
    setStudentAcademicYear(u.academic_year || '');
    setStudentSemester(u.semester || '');
    setAccountStatus(u.status || 'active');
    setFormError('');
  };

  const resetForm = () => {
    setFullName('');
    setUsername('');
    setEmail('');
    setPassword('');
    setSelectedRoleId(3);
    setSelectedDeptId('');
    setStudentRollNumber('');
    setStudentProgramme('');
    setStudentAcademicYear('');
    setStudentSemester('');
    setAccountStatus('active');
    setFormError('');
  };

  return (
    <div className="space-y-5 text-left">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3 dark:border-slate-800">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Users className="h-5 w-5 text-brand-600" />
            User Accounts
          </h2>
          <p className="text-xs text-slate-400">
            {isAdmin 
              ? 'Administrator privilege: Full access to add, edit user profiles, assign roles, and manage credentials.' 
              : 'Viewing department faculty directory and active members.'}
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => { resetForm(); setShowAddUserModal(true); }}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-700 via-indigo-600 to-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-indigo-500/20 hover:from-blue-800 hover:to-indigo-700 transition active:scale-95 cursor-pointer"
          >
            <UserPlus className="h-4 w-4 stroke-[2.5]" />
            <span>Add Account</span>
          </button>
        )}
      </div>

      {/* Tab Switcher */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800">
        <button
          type="button"
          onClick={() => setActiveTab('faculty')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition ${
            activeTab === 'faculty'
              ? 'border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-300'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <Users className="h-4 w-4" />
          Faculty & Staff ({activeTab === 'faculty' ? users.length : '...'})
        </button>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setActiveTab('students')}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition ${
              activeTab === 'students'
                ? 'border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-300'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <GraduationCap className="h-4 w-4" />
            Students ({activeTab === 'students' ? users.length : '...'})
          </button>
        )}
      </div>

      {message && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-2.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          {message}
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center gap-2.5">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={activeTab === 'students' ? "Search student by name, roll number, or college email..." : "Search by name, username, email..."}
            className="w-full rounded-xl border border-slate-200 bg-white py-1.5 pl-9 pr-3 text-xs text-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </form>

        {activeTab === 'faculty' && (
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <option value="">All Roles</option>
            <option value="admin">Administrator</option>
            <option value="hod">Head of Department (HOD)</option>
            <option value="faculty">Faculty Member</option>
          </select>
        )}

        {isAdmin && (
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <option value="">All Departments</option>
            {departments.map(d => (
              <option key={d.id} value={d.id}>{d.code} - {d.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Users / Students Table */}
      {loading ? (
        <div className="py-20 text-center text-xs text-slate-400 animate-pulse">
          Loading {activeTab === 'students' ? 'students' : 'accounts'}...
        </div>
      ) : users.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center text-xs text-slate-400 dark:border-slate-800 dark:bg-slate-900">
          No {activeTab === 'students' ? 'students' : 'faculty accounts'} match the current search filters.
        </div>
      ) : activeTab === 'students' ? (
        /* STUDENTS TABLE */
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-850 dark:text-slate-400">
              <tr>
                <th className="py-3.5 pl-4 pr-2">Student Name</th>
                <th className="px-3 py-3.5">Roll Number</th>
                <th className="px-3 py-3.5">College Email</th>
                <th className="px-3 py-3.5">Email Verification Status</th>
                <th className="px-3 py-3.5">Account Status</th>
                <th className="px-3 py-3.5">Created Date</th>
                <th className="py-3.5 pl-3 pr-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {users.map((u) => {
                const isEmailVerified = u.email_verified === 1;
                const isAccountActive = u.status === 'active';
                return (
                  <tr key={u.id} className="transition hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    <td className="py-3 pl-4 pr-2">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-sky-600 to-indigo-600 text-xs font-bold text-white uppercase shadow-sm">
                          {u.full_name?.charAt(0) || 'S'}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 dark:text-slate-100">
                            {u.full_name}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            @{u.username}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-3 py-3">
                      <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                        {u.roll_number || '—'}
                      </span>
                    </td>

                    <td className="px-3 py-3 text-slate-600 dark:text-slate-300">
                      {u.email}
                    </td>

                    <td className="px-3 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                        isEmailVerified
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                          : 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${isEmailVerified ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                        {isEmailVerified ? 'Verified' : 'Pending Verification'}
                      </span>
                    </td>

                    <td className="px-3 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                        isAccountActive
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                          : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${isAccountActive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                        {isAccountActive ? 'Active' : 'Disabled'}
                      </span>
                    </td>

                    <td className="px-3 py-3 text-slate-500">
                      {formatDate(u.created_at)}
                    </td>

                    <td className="py-3 pl-3 pr-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setStudentToView(u)}
                          className="flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-brand-50 hover:text-brand-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition"
                          title="View Student Details"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </button>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(u)}
                            className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                              isAccountActive
                                ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/50 dark:text-amber-300 dark:hover:bg-amber-900/50'
                                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300 dark:hover:bg-emerald-900/50'
                            }`}
                            title={isAccountActive ? 'Disable Student Account' : 'Enable Student Account'}
                          >
                            {isAccountActive ? (
                              <>
                                <UserX className="h-3.5 w-3.5" />
                                Disable
                              </>
                            ) : (
                              <>
                                <UserCheck className="h-3.5 w-3.5" />
                                Enable
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* FACULTY & STAFF TABLE */
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-850 dark:text-slate-400">
              <tr>
                <th className="py-3.5 pl-4 pr-2">User Details</th>
                <th className="px-3 py-3.5">Role</th>
                <th className="px-3 py-3.5">Department</th>
                <th className="px-3 py-3.5">Files & Storage</th>
                <th className="px-3 py-3.5">Status</th>
                <th className="px-3 py-3.5">Joined</th>
                <th className="py-3.5 pl-3 pr-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {users.map((u) => (
                <tr key={u.id} className="transition hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                  <td className="py-3 pl-4 pr-2">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-brand-600 to-indigo-600 text-xs font-bold text-white uppercase shadow-sm">
                        {u.full_name?.charAt(0) || 'U'}
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 dark:text-slate-100">
                          {u.full_name}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          @{u.username} • {u.email}
                        </div>
                      </div>
                    </div>
                  </td>

                  <td className="px-3 py-3">
                    <span className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
                      u.role_name === 'admin'
                        ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                        : u.role_name === 'hod'
                        ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                        : 'bg-brand-100 text-brand-800 dark:bg-brand-950 dark:text-brand-300'
                    }`}>
                      {u.role_name}
                    </span>
                  </td>

                  <td className="px-3 py-3">
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      {u.department_code || u.department_name || '—'}
                    </span>
                  </td>

                  <td className="px-3 py-3 text-slate-600 dark:text-slate-400">
                    <span className="font-medium">{u.file_count || 0} files</span>
                    <span className="text-[10px] text-slate-400 block">{formatBytes(u.storage_used || 0)}</span>
                  </td>

                  <td className="px-3 py-3">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      u.status === 'active'
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                    }`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${u.status === 'active' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                      {u.status}
                    </span>
                  </td>

                  <td className="px-3 py-3 text-slate-500">
                    {formatDate(u.created_at)}
                  </td>

                  <td className="py-3 pl-3 pr-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {isAdmin ? (
                        <>
                          <button
                            onClick={() => openEditModal(u)}
                            className="flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-brand-50 hover:text-brand-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                            title="Edit User Details & Role"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                            Edit
                          </button>
                          <button
                            onClick={() => { setUserToResetPass(u); setNewPassword(''); setFormError(''); }}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                            title="Reset Password"
                          >
                            <KeyRound className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleToggleStatus(u)}
                            className={`rounded-lg p-1.5 ${
                              u.status === 'active' 
                                ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/50'
                                : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50'
                            }`}
                            title={u.status === 'active' ? 'Disable Account' : 'Enable Account'}
                          >
                            {u.status === 'active' ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
                          </button>
                          {u.id !== currentUser.id && (
                            <button
                              onClick={() => setUserToDelete(u)}
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50 dark:hover:text-rose-400"
                              title="Delete User"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </>
                      ) : (
                        <button
                          onClick={() => openEditModal(u)}
                          className="rounded-lg px-2.5 py-1 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          View
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* View Student Details Modal */}
      {studentToView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 text-left">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                  <GraduationCap className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                    Student Profile Details
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Read-only student records. Passwords are never revealed.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStudentToView(null)}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3.5">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl border border-slate-150 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-850">
                  <span className="text-[11px] font-semibold text-slate-400 block">Student Name</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100 mt-0.5 block">{studentToView.full_name}</span>
                </div>
                <div className="rounded-xl border border-slate-150 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-850">
                  <span className="text-[11px] font-semibold text-slate-400 block">Roll Number</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-slate-100 mt-0.5 block">{studentToView.roll_number || '—'}</span>
                </div>
              </div>

              <div className="rounded-xl border border-slate-150 bg-slate-50 p-3 text-xs dark:border-slate-800 dark:bg-slate-850">
                <span className="text-[11px] font-semibold text-slate-400 block">College Email</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5 block">{studentToView.email}</span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl border border-slate-150 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-850">
                  <span className="text-[11px] font-semibold text-slate-400 block">Department / Branch</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200 mt-0.5 block">
                    {studentToView.department_code || studentToView.department_name || 'VNRVJIET'}
                  </span>
                </div>
                <div className="rounded-xl border border-slate-150 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-850">
                  <span className="text-[11px] font-semibold text-slate-400 block">Programme & Semester</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200 mt-0.5 block">
                    {studentToView.programme || 'B.Tech'} {studentToView.semester ? `• Sem ${studentToView.semester}` : ''}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl border border-slate-150 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-850">
                  <span className="text-[11px] font-semibold text-slate-400 block">Email Verification</span>
                  <div className="mt-1">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      studentToView.email_verified === 1
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                    }`}>
                      {studentToView.email_verified === 1 ? 'Verified' : 'Pending Verification'}
                    </span>
                    {studentToView.email_verified_at && (
                      <span className="text-[10px] text-slate-400 block mt-1">
                        on {formatDate(studentToView.email_verified_at)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-150 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-850">
                  <span className="text-[11px] font-semibold text-slate-400 block">Account Status</span>
                  <div className="mt-1">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      studentToView.status === 'active'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                    }`}>
                      {studentToView.status === 'active' ? 'Active' : 'Disabled'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-150 bg-slate-50 p-3 text-xs dark:border-slate-800 dark:bg-slate-850">
                <span className="text-[11px] font-semibold text-slate-400 block">Registered On</span>
                <span className="text-slate-700 dark:text-slate-300 mt-0.5 block">{formatDate(studentToView.created_at)}</span>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 pt-4 mt-4 dark:border-slate-800">
              {isAdmin && (
                <button
                  type="button"
                  onClick={async () => {
                    await handleToggleStatus(studentToView);
                    setStudentToView(prev => prev ? {
                      ...prev,
                      status: prev.status === 'active' ? 'disabled' : 'active'
                    } : null);
                  }}
                  className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                    studentToView.status === 'active'
                      ? 'bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-950 dark:text-amber-200'
                      : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-950 dark:text-emerald-200'
                  }`}
                >
                  {studentToView.status === 'active' ? (
                    <>
                      <UserX className="h-3.5 w-3.5" />
                      Disable Student Account
                    </>
                  ) : (
                    <>
                      <UserCheck className="h-3.5 w-3.5" />
                      Enable Student Account
                    </>
                  )}
                </button>
              )}
              <button
                type="button"
                onClick={() => setStudentToView(null)}
                className="ml-auto rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit User Modal */}
      {(showAddUserModal || userToEdit) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 text-left">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-100 text-brand-600 dark:bg-brand-950 dark:text-brand-400">
                  <Shield className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                    {userToEdit ? (isAdmin ? 'Edit User Account' : 'User Account Details') : 'Create New Account'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {isAdmin ? 'Admin can configure user details, department, and role permissions.' : 'Read-only user profile.'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => { setShowAddUserModal(false); setUserToEdit(null); }}
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

            <form onSubmit={userToEdit ? handleUpdateUser : handleCreateUser} className="mt-4 space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Full Name</label>
                  <input
                    type="text"
                    required
                    disabled={!isAdmin}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Dr. Ravi Kumar"
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 disabled:opacity-60"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Username</label>
                  <input
                    type="text"
                    required
                    disabled={!isAdmin}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. dr.ravi"
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 disabled:opacity-60"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Email Address</label>
                  <input
                    type="email"
                    required
                    disabled={!isAdmin}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ravi.kumar@abc.edu"
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 disabled:opacity-60"
                  />
                </div>
                {!userToEdit && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Temporary Password</label>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min 6 characters"
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    System Role {isAdmin ? '(Admin Only: Change Role)' : '(Assigned Role)'}
                  </label>
                  <select
                    value={selectedRoleId}
                    disabled={!isAdmin}
                    onChange={(e) => setSelectedRoleId(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 disabled:opacity-60"
                  >
                    {roles.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.label || r.name.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Assigned Department</label>
                  <select
                    value={selectedDeptId}
                    disabled={!isAdmin}
                    onChange={(e) => setSelectedDeptId(e.target.value)}
                    required={roles.find(role => role.id === Number(selectedRoleId))?.name === 'student'}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 disabled:opacity-60"
                  >
                    <option value="">No Department (Admin)</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.code} - {d.name}</option>
                    ))}
                  </select>
                </div>

                {roles.find(role => role.id === Number(selectedRoleId))?.name === 'student' && (
                  <div className="grid grid-cols-2 gap-3 rounded-xl border border-blue-100 bg-blue-50/60 p-3 dark:border-blue-900 dark:bg-blue-950/30">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-200">Roll Number<input required maxLength="40" value={studentRollNumber} onChange={event => setStudentRollNumber(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800" /></label>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-200">Programme<input required maxLength="80" value={studentProgramme} onChange={event => setStudentProgramme(event.target.value)} placeholder="e.g. B.Tech" className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800" /></label>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-200">Academic Year<input required value={studentAcademicYear} onChange={event => setStudentAcademicYear(event.target.value)} placeholder="e.g. II Year" className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800" /></label>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-200">Semester<input required value={studentSemester} onChange={event => setStudentSemester(event.target.value)} placeholder="e.g. 3" className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800" /></label>
                    <p className="col-span-2 text-[11px] text-slate-500">Student credentials are created by an Admin; the password is stored as a hash.</p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Account Status</label>
                <select
                  value={accountStatus}
                  disabled={!isAdmin}
                  onChange={(e) => setAccountStatus(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 disabled:opacity-60"
                >
                  <option value="active">Active (Can Log In)</option>
                  <option value="disabled">Disabled (Access Blocked)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => { setShowAddUserModal(false); setUserToEdit(null); }}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                {isAdmin ? (
                  <button
                    type="submit"
                    disabled={formLoading}
                    className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-md shadow-brand-500/25 hover:from-brand-700 hover:to-indigo-700 disabled:opacity-50"
                  >
                    <Save className="h-3.5 w-3.5" />
                    {formLoading ? 'Saving...' : userToEdit ? 'Save Changes' : 'Create Account'}
                  </button>
                ) : (
                  <span className="text-xs text-slate-400 italic">Only Administrator can save user edits</span>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {userToResetPass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 text-left">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                Reset Password for {userToResetPass.full_name}
              </h3>
              <button onClick={() => setUserToResetPass(null)} className="rounded-full p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="mt-3 rounded-xl bg-rose-50 p-2.5 text-xs text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
                {formError}
              </div>
            )}

            <form onSubmit={handleResetPassword} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  New Temporary Password
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter at least 6 characters"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 pt-4 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setUserToResetPass(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading || !newPassword}
                  className="rounded-xl bg-brand-600 px-5 py-2 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  {formLoading ? 'Resetting...' : 'Reset Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete User Confirmation */}
      <ConfirmDialog
        isOpen={Boolean(userToDelete)}
        title="Delete User Account"
        message={`Are you sure you want to delete user "${userToDelete?.full_name}" (@${userToDelete?.username})?`}
        confirmText="Delete User"
        isDanger={true}
        onClose={() => setUserToDelete(null)}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
