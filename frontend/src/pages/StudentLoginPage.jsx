import React, { useState, useEffect } from 'react';
import { ArrowLeft, LockKeyhole, UserRound, RefreshCw, CheckCircle2 } from 'lucide-react';
import { api, setToken } from '../utils/api';
import { useTheme } from '../context/ThemeContext';
import { VNRVJIET_DARK_EMBLEM } from '../utils/branding';

export default function StudentLoginPage() {
  const { isDark } = useTheme();
  const params = new URLSearchParams(window.location.search);
  const resourceId = params.get('resourceId') || '';
  const action = params.get('action') === 'download' ? 'download' : 'preview';
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
    <main className="flex min-h-screen items-center justify-center bg-[#f4f6fb] p-4 dark:bg-slate-950">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <button
          type="button"
          onClick={() => navigate('/syllabus')}
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#2846C7] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 dark:text-blue-300"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Syllabus Library
        </button>

        <div className="mt-6 text-center">
          <img src={isDark ? VNRVJIET_DARK_EMBLEM : '/branding/vnrvjiet-emblem.png'} alt="VNRVJIET emblem" className="mx-auto h-16 w-16 object-contain" />
          <p className="mt-3 text-xs font-extrabold tracking-widest text-[#16265C] dark:text-slate-100">VNRVJIET</p>
          <h1 className="mt-1 text-2xl font-extrabold text-slate-900 dark:text-white">Student Login</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Sign in with your registered college roll number or email.</p>
        </div>

        {resourceId && (
          <p className="mt-5 rounded-xl bg-blue-50 p-3 text-sm text-blue-900 dark:bg-blue-950/50 dark:text-blue-100">
            Sign in to continue to the selected resource.
          </p>
        )}

        {error && (
          <div role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
            <p className="font-semibold">{error}</p>
            {unverifiedAccount && (
              <div className="mt-3 border-t border-rose-200 pt-3 dark:border-rose-900">
                <button
                  type="button"
                  onClick={handleResendVerification}
                  disabled={resending}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${resending ? 'animate-spin' : ''}`} />
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
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
            Roll number or college email
            <span className="relative mt-1 block">
              <UserRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                required
                autoComplete="username"
                value={username}
                onChange={event => setUsername(event.target.value)}
                placeholder="e.g. 22071A0501 or student@vnrvjiet.in"
                className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-3 focus-visible:outline-2 focus-visible:outline-[#2846C7] dark:border-slate-700 dark:bg-slate-800"
              />
            </span>
          </label>

          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
            Password
            <span className="relative mt-1 block">
              <LockKeyhole className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                required
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={event => setPassword(event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-3 focus-visible:outline-2 focus-visible:outline-[#2846C7] dark:border-slate-700 dark:bg-slate-800"
              />
            </span>
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[#16265C] px-4 py-3 font-bold text-white hover:bg-[#2846C7] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F4B64E] disabled:opacity-60 cursor-pointer"
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
              className="font-bold text-[#2846C7] hover:underline focus-visible:outline-2 dark:text-blue-300 cursor-pointer"
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
