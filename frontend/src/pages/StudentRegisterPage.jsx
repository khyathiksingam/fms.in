import React, { useState, useEffect } from 'react';
import { ArrowLeft, LockKeyhole, UserRound, Mail, Hash, AlertCircle, RefreshCw } from 'lucide-react';
import { api } from '../utils/api';
import { useTheme } from '../context/ThemeContext';
import { VNRVJIET_DARK_EMBLEM } from '../utils/branding';

export default function StudentRegisterPage() {
  const { isDark } = useTheme();
  const [fullName, setFullName] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [selfRegistrationEnabled, setSelfRegistrationEnabled] = useState(null); // null = loading
  const [canResend, setCanResend] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendStatus, setResendStatus] = useState('');

  const navigate = (path) => {
    window.history.pushState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  useEffect(() => {
    api.publicGet('/settings/public')
      .then(res => {
        if (res?.settings) {
          setSelfRegistrationEnabled(Boolean(res.settings.student_self_registration));
        } else {
          setSelfRegistrationEnabled(false);
        }
      })
      .catch(() => {
        setSelfRegistrationEnabled(false);
      });
  }, []);

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setResendStatus('');

    // Frontend validation
    const cleanEmail = email.trim().toLowerCase();
    const cleanRollNumber = rollNumber.trim().toUpperCase();
    const cleanFullName = fullName.trim();

    if (!cleanFullName) {
      setError('Full name is required.');
      return;
    }

    if (!cleanRollNumber) {
      setError('Student roll number is required.');
      return;
    }

    if (!cleanEmail.endsWith('@vnrvjiet.in')) {
      setError('Please enter your official college email ending in @vnrvjiet.in');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const result = await api.post('/auth/student-register', {
        full_name: cleanFullName,
        roll_number: cleanRollNumber,
        email: cleanEmail,
        password,
        confirm_password: confirmPassword
      });
      if (!result?.messageId || result.message !== 'OTP sent successfully.') {
        const params = new URLSearchParams({
          email: result?.email || cleanEmail,
          expiresAt: result?.expiresAt || '',
          resendAvailableAt: result?.resendAvailableAt || '',
          deliveryError: 'Brevo did not confirm OTP delivery. Please try again.'
        });
        navigate(`/verify-student-email?${params.toString()}`);
        return;
      }
      const params = new URLSearchParams({
        email: result.email,
        expiresAt: result.expiresAt,
        resendAvailableAt: result.resendAvailableAt,
        sent: '1'
      });
      navigate(`/verify-student-email?${params.toString()}`);
    } catch (err) {
      if (err.data?.deliveryFailed && err.data.email) {
        const params = new URLSearchParams({
          email: err.data.email,
          expiresAt: err.data.expiresAt || '',
          resendAvailableAt: err.data.resendAvailableAt || '',
          deliveryError: err.message || 'Brevo could not send the verification OTP.'
        });
        navigate(`/verify-student-email?${params.toString()}`);
        return;
      }
      if (err.data?.canResend) {
        setCanResend(true);
      }
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setResendStatus('');
    try {
      const res = await api.post('/auth/resend-otp', { email: email.trim().toLowerCase() });
      if (!res.messageId || res.message !== 'OTP sent successfully.') {
        throw new Error('Brevo did not confirm OTP delivery.');
      }
      const params = new URLSearchParams({
        email: res.email,
        expiresAt: res.expiresAt,
        resendAvailableAt: res.resendAvailableAt,
        sent: '1'
      });
      navigate(`/verify-student-email?${params.toString()}`);
    } catch (err) {
      setResendStatus(err.message || 'Failed to resend OTP.');
    } finally {
      setResending(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f4f6fb] p-4 dark:bg-slate-950">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate('/student-login')}
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#2846C7] hover:underline focus-visible:outline-2 dark:text-blue-300 cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Student Login
          </button>
        </div>

        <div className="mt-6 text-center">
          <img src={isDark ? VNRVJIET_DARK_EMBLEM : '/branding/vnrvjiet-emblem.png'} alt="VNRVJIET emblem" className="mx-auto h-16 w-16 object-contain" />
          <p className="mt-3 text-xs font-extrabold tracking-widest text-[#16265C] dark:text-slate-100">VNRVJIET</p>
          <h1 className="mt-1 text-2xl font-extrabold text-slate-900 dark:text-white">Create Student Account</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Register with your official college credentials.</p>
        </div>

        {selfRegistrationEnabled === false && (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center dark:border-amber-900/60 dark:bg-amber-950/40">
            <AlertCircle className="mx-auto h-8 w-8 text-amber-600 dark:text-amber-400" />
            <p className="mt-3 text-sm font-semibold text-amber-900 dark:text-amber-200">
              Student registration is currently disabled by the administrator.
            </p>
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
              Please contact your college administrator to activate self-registration.
            </p>
            <button
              type="button"
              onClick={() => navigate('/student-login')}
              className="mt-4 rounded-xl bg-[#16265C] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#2846C7] cursor-pointer"
            >
              Return to Student Login
            </button>
          </div>
        )}

        {selfRegistrationEnabled === true && (
          <>
            {error && (
              <div role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
                <p className="font-semibold">{error}</p>
                {canResend && (
                  <div className="mt-2.5 border-t border-rose-200 pt-2 dark:border-rose-900">
                    <button
                      type="button"
                      onClick={handleResend}
                      disabled={resending}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-50 cursor-pointer"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${resending ? 'animate-spin' : ''}`} />
                      {resending ? 'Sending OTP…' : 'Resend OTP'}
                    </button>
                    {resendStatus && (
                      <p className="mt-1 text-xs text-rose-700 dark:text-rose-300">{resendStatus}</p>
                    )}
                  </div>
                )}
              </div>
            )}

            <form onSubmit={handleRegister} className="mt-5 space-y-3.5">
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                Full Name
                <span className="relative mt-1 block">
                  <UserRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    required
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder="e.g. Ramesh Kumar"
                    className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm focus-visible:outline-2 focus-visible:outline-[#2846C7] dark:border-slate-700 dark:bg-slate-800"
                  />
                </span>
              </label>

              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                Student Roll Number
                <span className="relative mt-1 block">
                  <Hash className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    required
                    value={rollNumber}
                    onChange={e => setRollNumber(e.target.value.toUpperCase())}
                    placeholder="e.g. 22071A0501"
                    className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm uppercase focus-visible:outline-2 focus-visible:outline-[#2846C7] dark:border-slate-700 dark:bg-slate-800"
                  />
                </span>
              </label>

              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                Official College Email
                <span className="relative mt-1 block">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value.toLowerCase())}
                    placeholder="student@vnrvjiet.in"
                    className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm lowercase focus-visible:outline-2 focus-visible:outline-[#2846C7] dark:border-slate-700 dark:bg-slate-800"
                  />
                </span>
                <span className="mt-1 block text-[11px] text-slate-500">Only @vnrvjiet.in emails are accepted.</span>
              </label>

              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                Password
                <span className="relative mt-1 block">
                  <LockKeyhole className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    required
                    type="password"
                    minLength={8}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm focus-visible:outline-2 focus-visible:outline-[#2846C7] dark:border-slate-700 dark:bg-slate-800"
                  />
                </span>
              </label>

              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                Confirm Password
                <span className="relative mt-1 block">
                  <LockKeyhole className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    required
                    type="password"
                    minLength={8}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm focus-visible:outline-2 focus-visible:outline-[#2846C7] dark:border-slate-700 dark:bg-slate-800"
                  />
                </span>
              </label>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-[#16265C] px-4 py-3 font-bold text-white hover:bg-[#2846C7] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F4B64E] disabled:opacity-60 cursor-pointer"
              >
                {loading ? 'Creating Account…' : 'Create Student Account'}
              </button>
            </form>

            <div className="mt-5 text-center text-xs text-slate-600 dark:text-slate-400">
              <span>Already have an account? </span>
              <button
                type="button"
                onClick={() => navigate('/student-login')}
                className="font-bold text-[#2846C7] hover:underline focus-visible:outline-2 dark:text-blue-300 cursor-pointer"
              >
                Sign In
              </button>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
