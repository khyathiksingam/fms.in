import React, { useState, useEffect } from 'react';
import { ArrowLeft, LockKeyhole, UserRound, RefreshCw, CheckCircle2 } from 'lucide-react';
import { api, setToken } from '../utils/api';
import { useTheme } from '../context/ThemeContext';
import { getDisplayedLogo, DEFAULT_FALLBACK_LOGO } from '../utils/branding';
import RoleBadge from '../components/common/RoleBadge';
import ThemeToggle from '../components/common/ThemeToggle';

export default function StudentLoginPage() {
  const { isDark } = useTheme();
  const params = new URLSearchParams(window.location.search);
  const resourceId = params.get('resourceId') || '';
  const action = params.get('action') === 'download' ? 'download' : 'preview';
  const [collegeSettings, setCollegeSettings] = useState(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [selfRegistrationEnabled, setSelfRegistrationEnabled] = useState(false);
  const [unverifiedAccount, setUnverifiedAccount] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState('');
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const [resendSuccess, setResendSuccess] = useState(false);

  const navigate = (path) => {
    window.history.pushState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  useEffect(() => {
    api.publicGet('/settings/public')
      .then(res => {
        if (res?.settings) {
          setCollegeSettings(res.settings);
          setSelfRegistrationEnabled(Boolean(res.settings.student_self_registration));
        }
      })
      .catch(() => {});
  }, []);

  const submit = async event => {
    event.preventDefault();
    setError('');
    setResendMessage('');
    setUnverifiedAccount(false);
    setLoading(true);
    try {
      const result = await api.post('/auth/student-login', { username: username.trim(), password });
      if (result.user?.role_name !== 'student') throw new Error('This account is not a student account.');
      setToken(result.token);
      const query = new URLSearchParams();
      if (resourceId) {
        query.set('resourceId', resourceId);
        query.set('action', action);
      }
      navigate(`/student-syllabus${query.size ? `?${query}` : ''}`);
    } catch (err) {
      if (err.data?.unverified || (err.message && err.message.toLowerCase().includes('verify your college email'))) {
        setUnverifiedAccount(true);
        setUnverifiedEmail(err.data?.email || username.trim());
        setError('Please verify your college email before logging in.');
      } else {
        setError(err.message || 'Unable to sign in. Check your credentials and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setResending(true);
    setResendMessage('');
    try {
      const targetEmail = unverifiedEmail || username.trim();
      const res = await api.post('/auth/resend-otp', { email: targetEmail });
      if (!res.messageId || res.message !== 'OTP sent successfully.') {
        throw new Error('Brevo did not confirm OTP delivery.');
      }
      setResendSuccess(true);
      setResendMessage('OTP sent successfully.');
      const params = new URLSearchParams({
        email: res.email,
        expiresAt: res.expiresAt,
        resendAvailableAt: res.resendAvailableAt,
        sent: '1'
      });
      navigate(`/verify-student-email?${params.toString()}`);
    } catch (err) {
      setResendSuccess(false);
      setResendMessage(err.message || 'Failed to send OTP. Please try again.');
    } finally {
      setResending(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-slate-50 p-4 dark:bg-slate-950 transition-colors">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <section className="app-card w-full max-w-md p-7 shadow-xl">
        <button
          type="button"
          onClick={() => navigate('/syllabus')}
          className="inline-flex items-center gap-2 text-xs font-bold text-brand-600 hover:text-brand-700 dark:text-brand-400 hover:underline cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Syllabus Library
        </button>

        <div className="mt-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-white p-1 border border-slate-200 dark:border-slate-800 dark:bg-slate-900">
            <img 
              src={getDisplayedLogo(collegeSettings, isDark)} 
              alt={`${collegeSettings?.college_name || 'College'} logo`} 
              className="h-full w-full object-contain" 
              onError={(e) => { e.currentTarget.src = DEFAULT_FALLBACK_LOGO; }}
            />
          </div>
          <p className="mt-3 text-xs font-extrabold tracking-wider text-slate-700 dark:text-slate-300 uppercase truncate">
            {collegeSettings?.college_name || 'College Portal'}
          </p>
          <h1 className="mt-1 text-2xl font-extrabold text-slate-900 dark:text-white">Student Login</h1>
          <div className="mt-2 flex justify-center">
            <RoleBadge role="student" />
          </div>
          <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">Sign in with your registered college roll number or email.</p>
        </div>

        {resourceId && (
          <p className="mt-4 rounded-xl border border-brand-200 bg-brand-50 p-3 text-xs text-brand-900 dark:border-brand-900 dark:bg-brand-950/50 dark:text-brand-100">
            Sign in to continue to the selected resource.
          </p>
        )}

        {error && (
          <div role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
            <p>{error}</p>
            {unverifiedAccount && (
              <div className="mt-2.5 border-t border-rose-200 pt-2.5 dark:border-rose-900">
                <button
                  type="button"
                  onClick={handleResendVerification}
                  disabled={resending}
                  className="btn-danger text-xs py-1 px-2.5"
                >
                  <RefreshCw className={`h-3 w-3 ${resending ? 'animate-spin' : ''}`} />
                  {resending ? 'Sending OTP…' : 'Resend OTP'}
                </button>
              </div>
            )}
          </div>
        )}

        {resendMessage && (
          <div className={`mt-3 rounded-xl p-3 text-xs font-semibold ${resendSuccess ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-200' : 'bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-200'}`}>
            <div className="flex items-center gap-2">
              {resendSuccess && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
              <span>{resendMessage}</span>
            </div>
          </div>
        )}

        <form onSubmit={submit} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              Roll number or college email
            </label>
            <div className="relative mt-1">
              <UserRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                required
                autoComplete="username"
                value={username}
                onChange={event => setUsername(event.target.value)}
                placeholder="e.g. 22071A0501 or student@vnrvjiet.in"
                className="app-input pl-9"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              Password
            </label>
            <div className="relative mt-1">
              <LockKeyhole className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                required
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={event => setPassword(event.target.value)}
                placeholder="••••••••"
                className="app-input pl-9"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-2.5 text-xs font-bold mt-2"
          >
            {loading ? 'Signing in…' : 'Sign in to Student Library'}
          </button>
        </form>

        {selfRegistrationEnabled ? (
          <div className="mt-5 text-center text-xs text-slate-600 dark:text-slate-400">
            <span>Don't have an account? </span>
            <button
              type="button"
              onClick={() => navigate('/student-register')}
              className="font-bold text-brand-600 hover:text-brand-700 hover:underline dark:text-brand-400 cursor-pointer"
            >
              Create Student Account
            </button>
          </div>
        ) : (
          <p className="mt-4 text-center text-xs text-slate-500 dark:text-slate-400">
            Student registration is currently disabled by the administrator.
          </p>
        )}
      </section>
    </main>
  );
}
