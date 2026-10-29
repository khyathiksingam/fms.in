import React, { useState, useEffect } from 'react';
import { ArrowLeft, LockKeyhole, UserRound, Mail, Hash, AlertCircle, RefreshCw } from 'lucide-react';
import { api } from '../utils/api';
import { useTheme } from '../context/ThemeContext';
import { getDisplayedLogo, DEFAULT_FALLBACK_LOGO } from '../utils/branding';
import RoleBadge from '../components/common/RoleBadge';
import ThemeToggle from '../components/common/ThemeToggle';

export default function StudentRegisterPage() {
  const { isDark } = useTheme();
  const [collegeSettings, setCollegeSettings] = useState(null);
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
          setCollegeSettings(res.settings);
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
    <main className="relative flex min-h-screen items-center justify-center bg-slate-50 p-4 dark:bg-slate-950 transition-colors">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <section className="app-card w-full max-w-md p-7 shadow-xl">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate('/student-login')}
            className="inline-flex items-center gap-2 text-xs font-bold text-brand-600 hover:text-brand-700 dark:text-brand-400 hover:underline cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Student Login
          </button>
        </div>

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
          <h1 className="mt-1 text-2xl font-extrabold text-slate-900 dark:text-white">Create Student Account</h1>
          <div className="mt-2 flex justify-center">
            <RoleBadge role="student" />
          </div>
          <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">Register with your official college credentials.</p>
        </div>

        {selfRegistrationEnabled === false && (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center dark:border-amber-900/60 dark:bg-amber-950/40">
            <AlertCircle className="mx-auto h-8 w-8 text-amber-600 dark:text-amber-400" />
            <p className="mt-3 text-xs font-semibold text-amber-900 dark:text-amber-200">
              Student registration is currently disabled by the administrator.
            </p>
            <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-300">
              Please contact your college administrator to activate self-registration.
            </p>
            <button
              type="button"
              onClick={() => navigate('/student-login')}
              className="btn-primary mt-4 text-xs font-bold"
            >
              Return to Student Login
            </button>
          </div>
        )}

        {selfRegistrationEnabled === true && (
          <>
            {error && (
              <div role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
                <p>{error}</p>
                {canResend && (
                  <div className="mt-2.5 border-t border-rose-200 pt-2 dark:border-rose-900">
                    <button
                      type="button"
                      onClick={handleResend}
                      disabled={resending}
                      className="btn-danger text-xs py-1 px-2.5"
                    >
                      <RefreshCw className={`h-3 w-3 ${resending ? 'animate-spin' : ''}`} />
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
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Full Name
                </label>
                <div className="relative mt-1">
                  <UserRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    required
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder="e.g. Ramesh Kumar"
                    className="app-input pl-9"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Student Roll Number
                </label>
                <div className="relative mt-1">
                  <Hash className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    required
                    value={rollNumber}
                    onChange={e => setRollNumber(e.target.value.toUpperCase())}
                    placeholder="e.g. 22071A0501"
                    className="app-input pl-9 uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Official College Email
                </label>
                <div className="relative mt-1">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value.toLowerCase())}
                    placeholder="student@vnrvjiet.in"
                    className="app-input pl-9 lowercase"
                  />
                </div>
                <span className="mt-1 block text-[10px] text-slate-500">Only @vnrvjiet.in emails are accepted.</span>
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
                    minLength={8}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className="app-input pl-9"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Confirm Password
                </label>
                <div className="relative mt-1">
                  <LockKeyhole className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    required
                    type="password"
                    minLength={8}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className="app-input pl-9"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full py-2.5 text-xs font-bold mt-2"
              >
                {loading ? 'Creating Account…' : 'Create Student Account'}
              </button>
            </form>

            <div className="mt-5 text-center text-xs text-slate-600 dark:text-slate-400">
              <span>Already have an account? </span>
              <button
                type="button"
                onClick={() => navigate('/student-login')}
                className="font-bold text-brand-600 hover:text-brand-700 hover:underline dark:text-brand-400 cursor-pointer"
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
