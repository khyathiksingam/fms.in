import React, { useState } from 'react';
import { Building2, Lock, User, Eye, EyeOff, ArrowRight, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { VNRVJIET_DARK_EMBLEM } from '../utils/branding';

export default function LoginPage({ onLoginSuccess }) {
  const { login, collegeSettings } = useAuth();
  const { isDark } = useTheme();
  const collegeLogo = collegeSettings?.college_logo || collegeSettings?.system_logo || '/logo.png';
  const displayedCollegeLogo = isDark ? VNRVJIET_DARK_EMBLEM : collegeLogo;
  const collegeName = collegeSettings?.college_name || 'VNRVJIET';
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Please enter your faculty username and password.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await login(username.trim(), password);
      onLoginSuccess?.();
    } catch (err) {
      setError(err.message || 'Invalid username or password. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 via-indigo-50/40 to-blue-50/50 p-4 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="w-full max-w-md">
        {/* Main Card */}
        <div className="rounded-3xl border border-slate-200/90 bg-white p-8 text-left shadow-2xl backdrop-blur-xl dark:border-slate-700 dark:bg-slate-900">
          {/* College Header */}
          <div className="text-center">
            <div className={`mx-auto flex h-20 w-20 items-center justify-center overflow-hidden ${isDark ? '' : 'bg-white'}`}>
              <img src={displayedCollegeLogo} alt={`${collegeName} logo`} className="h-full w-full object-contain" />
            </div>
            <h2 className="mt-4 px-2 text-xs font-extrabold uppercase tracking-wide text-indigo-900 line-clamp-2 dark:text-slate-100">
              {collegeName}
            </h2>
            <h1 className="mt-1 text-xl font-extrabold text-slate-900 dark:text-white">
              {collegeSettings?.system_name || 'Faculty File Management System'}
            </h1>
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-bold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-200">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Authorized Faculty, HOD & Admin Portal</span>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mt-5 flex items-center gap-2 rounded-2xl border border-rose-100 bg-rose-50 p-3 text-xs font-medium text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-200">
              <span>{error}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="portal-username" className="block text-xs font-bold text-slate-700 dark:text-slate-200">
                Faculty / HOD / Admin Username
              </label>
              <div className="relative mt-1.5">
                <User className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="portal-username"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. admin or dr.ravi"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/80 py-2.5 pl-10 pr-3 text-xs text-slate-900 transition focus:border-indigo-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:bg-slate-700"
                />
              </div>
            </div>

            <div>
              <label htmlFor="portal-password" className="block text-xs font-bold text-slate-700 dark:text-slate-200">
                Password
              </label>
              <div className="relative mt-1.5">
                <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="portal-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/80 py-2.5 pl-10 pr-10 text-xs text-slate-900 transition focus:border-indigo-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:bg-slate-700"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-700 via-indigo-600 to-blue-600 py-3 text-xs font-bold text-white shadow-lg shadow-indigo-500/25 transition hover:from-blue-800 hover:to-indigo-700 active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? 'Authenticating...' : 'Sign In to FFMS'}
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-xs font-medium text-slate-500 dark:text-slate-400">
          <a href="/syllabus" className="font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-300 dark:hover:text-indigo-200">
            Browse the student syllabus library
          </a>
        </p>
      </div>
    </div>
  );
}
