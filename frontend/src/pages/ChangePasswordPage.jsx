import React, { useState } from 'react';
import { KeyRound, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';

export default function ChangePasswordPage({ onComplete }) {
  const { user, refreshUser, logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async event => {
    event.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) {
      setError('The new password and confirmation do not match.');
      return;
    }
    if (newPassword.length < 8) {
      setError('Choose a password with at least 8 characters.');
      return;
    }
    setSaving(true);
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword });
      await refreshUser();
      onComplete?.();
    } catch (err) {
      setError(err.message || 'Unable to change password.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4">
      <section className="app-card w-full max-w-lg p-6 sm:p-9 shadow-xl">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
          <KeyRound className="h-6 w-6" />
        </div>
        <h1 className="mt-5 text-2xl font-black text-slate-900 dark:text-white">Set a new password</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
          Welcome, {user?.full_name}. For account security, change your temporary password before using the portal.
        </p>
        {error && <p className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-200" role="alert">{error}</p>}
        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
            Current temporary password
            <input required type="password" autoComplete="current-password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} className="app-input mt-1.5" />
          </label>
          <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
            New password
            <input required minLength={8} type="password" autoComplete="new-password" value={newPassword} onChange={event => setNewPassword(event.target.value)} className="app-input mt-1.5" />
          </label>
          <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
            Confirm new password
            <input required minLength={8} type="password" autoComplete="new-password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} className="app-input mt-1.5" />
          </label>
          <button disabled={saving} type="submit" className="btn-primary w-full py-3">
            <ShieldCheck className="h-4 w-4" />{saving ? 'Updating password…' : 'Change password'}
          </button>
        </form>
        <button type="button" onClick={logout} className="btn-secondary mt-4 w-full">Log out instead</button>
      </section>
    </div>
  );
}
