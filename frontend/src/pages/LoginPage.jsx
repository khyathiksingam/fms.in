import React, { useState } from 'react';
import { Building2, Lock, User, Eye, EyeOff, ArrowRight, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { getDisplayedLogo, DEFAULT_FALLBACK_LOGO } from '../utils/branding';
import ThemeToggle from '../components/common/ThemeToggle';

export default function LoginPage({ onLoginSuccess }) {
  const { login, collegeSettings } = useAuth();
  const { isDark } = useTheme();
  const displayedCollegeLogo = getDisplayedLogo(collegeSettings, isDark);
  const collegeName = collegeSettings?.college_name || 'College Portal';
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
    <div className="relative flex min-h-screen items-center justify-center bg-slate-50 p-4 dark:bg-slate-950 transition-colors">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md">
        {/* Main Card */}
        <div className="app-card p-8 text-left shadow-xl">
          {/* College Header */}
          <div className="text-center">
            <div className={`mx-auto flex h-20 w-20 items-center justify-center overflow-hidden ${isDark ? '' : 'bg-white'}`}>
              <img 
                src={displayedCollegeLogo} 
                alt={`${collegeName} logo`} 
                className="h-full w-full object-contain" 
                onError={(e) => { e.currentTarget.src = DEFAULT_FALLBACK_LOGO; }}
              />
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
                  className="app-input pl-10"
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
                  className="app-input pl-10 pr-10"
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
              className="btn-primary mt-4 w-full py-3 text-xs font-bold"
            >
              {loading ? 'Authenticating...' : 'Sign In to FFMS'}
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-xs font-medium text-slate-500 dark:text-slate-400">
          <a href="/syllabus" className="font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400">
            Browse the student syllabus library
          </a>
        </p>
      </div>
    </div>
  );
}
