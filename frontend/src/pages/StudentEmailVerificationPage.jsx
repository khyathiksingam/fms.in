import React, { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, AlertCircle, RefreshCw, Mail, LockKeyhole } from 'lucide-react';
import { api } from '../utils/api';
import { useTheme } from '../context/ThemeContext';
import { getDisplayedLogo, DEFAULT_FALLBACK_LOGO } from '../utils/branding';
import RoleBadge from '../components/common/RoleBadge';
import ThemeToggle from '../components/common/ThemeToggle';

function formatCountdown(milliseconds) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export default function StudentEmailVerificationPage() {
  const { isDark } = useTheme();
  const params = new URLSearchParams(window.location.search);
  const [collegeSettings, setCollegeSettings] = useState(null);
  const [email, setEmail] = useState(params.get('email') || '');
  const [expiresAt, setExpiresAt] = useState(params.get('expiresAt') || '');
  const [resendAvailableAt, setResendAvailableAt] = useState(params.get('resendAvailableAt') || '');
  const [otp, setOtp] = useState('');
  const [verified, setVerified] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState(params.get('deliveryError') || '');
  const [message, setMessage] = useState(params.get('sent') === '1' ? 'OTP sent successfully.' : '');
  const [showChangeEmail, setShowChangeEmail] = useState(false);
  const [rollNumber, setRollNumber] = useState('');
  const [password, setPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [now, setNow] = useState(0);

  const navigate = (path) => {
    window.history.pushState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const initialUpdate = window.setTimeout(tick, 0);
    const timer = window.setInterval(tick, 1000);
    return () => {
      window.clearTimeout(initialUpdate);
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    api.publicGet('/settings/public')
      .then(res => {
        if (res?.settings) setCollegeSettings(res.settings);
      })
      .catch(() => {});
  }, []);

  const expiresIn = expiresAt && now ? Date.parse(expiresAt) - now : null;
  const resendIn = resendAvailableAt && now ? Date.parse(resendAvailableAt) - now : null;

  const updateDelivery = (result, targetEmail) => {
    if (!result?.messageId || result.message !== 'OTP sent successfully.') {
      setError('Brevo did not confirm email delivery. Please try again.');
      return false;
    }
    setEmail(targetEmail || result.email);
    setExpiresAt(result.expiresAt);
    setResendAvailableAt(result.resendAvailableAt);
    setError('');
    setMessage('OTP sent successfully.');
    setOtp('');
    return true;
  };

  const handleVerify = async event => {
    event.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const result = await api.post('/auth/verify-student-email', { email: email.trim().toLowerCase(), otp });
      setVerified(true);
      setMessage(result.message || 'Email verified successfully. You can now log in.');
    } catch (err) {
      setError(err.message || 'Unable to verify this OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setMessage('');
    setResending(true);
    try {
      const result = await api.post('/auth/resend-otp', { email: email.trim().toLowerCase() });
      updateDelivery(result, result.email);
    } catch (err) {
      if (err.data?.expiresAt) setExpiresAt(err.data.expiresAt);
      if (err.data?.resendAvailableAt) setResendAvailableAt(err.data.resendAvailableAt);
      setError(err.message || 'Unable to resend the OTP.');
    } finally {
      setResending(false);
    }
  };

  const handleChangeEmail = async event => {
    event.preventDefault();
    setError('');
    setMessage('');
    setResending(true);
    try {
      const result = await api.post('/auth/student-change-email', {
        email: email.trim().toLowerCase(),
        roll_number: rollNumber.trim().toUpperCase(),
        password,
        new_email: newEmail.trim().toLowerCase()
      });
      updateDelivery(result, result.email);
      setShowChangeEmail(false);
      setPassword('');
      setNewEmail('');
    } catch (err) {
      if (err.data?.email) setEmail(err.data.email);
      if (err.data?.expiresAt) setExpiresAt(err.data.expiresAt);
      if (err.data?.resendAvailableAt) setResendAvailableAt(err.data.resendAvailableAt);
      setError(err.message || 'Unable to change the email address.');
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
          onClick={() => navigate('/student-login')}
          className="inline-flex items-center gap-2 text-xs font-bold text-brand-600 hover:text-brand-700 dark:text-brand-400 hover:underline cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Student Login
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
          <h1 className="mt-1 text-2xl font-extrabold text-slate-900 dark:text-white">Verify Your Email</h1>
          <div className="mt-2 flex justify-center">
            <RoleBadge role="student" />
          </div>
          <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
            Enter the 6-digit code sent to <strong className="text-slate-800 dark:text-slate-200">{email || 'your registered email address'}</strong>.
          </p>
        </div>

        {verified ? (
          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center dark:border-emerald-900 dark:bg-emerald-950/40">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600 dark:text-emerald-400" />
            <h2 className="mt-3 text-base font-bold text-emerald-950 dark:text-emerald-100">Email Verified Successfully!</h2>
            <p className="mt-2 text-xs text-emerald-800 dark:text-emerald-200">{message}</p>
            <button
              type="button"
              onClick={() => navigate('/student-login')}
              className="btn-primary mt-5 w-full text-xs font-bold"
            >
              Go to Student Login
            </button>
          </div>
        ) : (
          <>
            {error && (
              <div role="alert" className="mt-5 flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {message && (
              <div role="status" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
                {message}
              </div>
            )}

            <form onSubmit={handleVerify} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Registered Email Address
                </label>
                <div className="relative mt-1">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={event => setEmail(event.target.value)}
                    placeholder="student@vnrvjiet.in"
                    className="app-input pl-9"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  6-digit OTP
                </label>
                <input
                  required
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={otp}
                  onChange={event => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="123456"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-center text-xl font-bold tracking-[0.4em] focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <p className="text-center text-xs font-semibold text-slate-600 dark:text-slate-400" aria-live="polite">
                {expiresIn !== null && Number.isFinite(expiresIn)
                  ? expiresIn > 0 ? `OTP expires in ${formatCountdown(expiresIn)}` : 'OTP expired. Resend a new OTP.'
                  : 'The OTP is valid for 10 minutes.'}
              </p>

              <button
                type="submit"
                disabled={loading || !email.trim() || otp.length !== 6 || (expiresIn !== null && expiresIn <= 0)}
                className="btn-primary w-full py-2.5 text-xs font-bold"
              >
                {loading ? 'Verifying…' : 'Verify OTP'}
              </button>
            </form>

            {showChangeEmail ? (
              <form onSubmit={handleChangeEmail} className="mt-5 space-y-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                <h2 className="text-xs font-bold text-slate-800 dark:text-slate-200">Change email address</h2>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400">
                    Roll Number
                  </label>
                  <input required value={rollNumber} onChange={event => setRollNumber(event.target.value)} className="app-input mt-1" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400">
                    Account Password
                  </label>
                  <div className="relative mt-1">
                    <LockKeyhole className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input required type="password" value={password} onChange={event => setPassword(event.target.value)} className="app-input pl-9" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400">
                    New College Email
                  </label>
                  <input required type="email" value={newEmail} onChange={event => setNewEmail(event.target.value)} placeholder="student@vnrvjiet.in" className="app-input mt-1" />
                </div>
                <button type="submit" disabled={resending} className="btn-primary w-full py-2 text-xs font-bold">
                  {resending ? 'Updating…' : 'Save Email and Send OTP'}
                </button>
              </form>
            ) : (
              <button type="button" onClick={() => setShowChangeEmail(true)} className="mt-3 w-full text-xs font-bold text-brand-600 hover:text-brand-700 hover:underline dark:text-brand-400 cursor-pointer">
                Change email address
              </button>
            )}

            <button
              type="button"
              onClick={handleResend}
              disabled={resending || !email.trim() || (resendIn !== null && resendIn > 0)}
              className="btn-secondary mt-2.5 w-full text-xs font-bold"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${resending ? 'animate-spin' : ''}`} />
              {resending
                ? 'Sending OTP…'
                : resendIn !== null && resendIn > 0
                  ? `Resend OTP in ${formatCountdown(resendIn)}`
                  : 'Resend OTP'}
            </button>
          </>
        )}
      </section>
    </main>
  );
}
