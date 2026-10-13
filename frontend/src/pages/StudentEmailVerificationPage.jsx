import React, { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, AlertCircle, RefreshCw, Mail, LockKeyhole } from 'lucide-react';
import { api } from '../utils/api';
import { useTheme } from '../context/ThemeContext';
import { VNRVJIET_DARK_EMBLEM } from '../utils/branding';

function formatCountdown(milliseconds) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export default function StudentEmailVerificationPage() {
  const { isDark } = useTheme();
  const params = new URLSearchParams(window.location.search);
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
    <main className="flex min-h-screen items-center justify-center bg-[#f4f6fb] p-4 dark:bg-slate-950">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <button
          type="button"
          onClick={() => navigate('/student-login')}
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#2846C7] hover:underline focus-visible:outline-2 dark:text-blue-300 cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Student Login
        </button>

        <div className="mt-6 text-center">
          <img src={isDark ? VNRVJIET_DARK_EMBLEM : '/branding/vnrvjiet-emblem.png'} alt="VNRVJIET emblem" className="mx-auto h-16 w-16 object-contain" />
          <p className="mt-3 text-xs font-extrabold tracking-widest text-[#16265C] dark:text-slate-100">VNRVJIET</p>
          <h1 className="mt-1 text-2xl font-extrabold text-slate-900 dark:text-white">Verify Your Email</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Enter the 6-digit code sent to {email || 'your registered email address'}.
          </p>
        </div>

        {verified ? (
          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center dark:border-emerald-900 dark:bg-emerald-950/40">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600 dark:text-emerald-400" />
            <h2 className="mt-3 text-lg font-bold text-emerald-950 dark:text-emerald-100">Email Verified Successfully!</h2>
            <p className="mt-2 text-sm text-emerald-800 dark:text-emerald-200">{message}</p>
            <button
              type="button"
              onClick={() => navigate('/student-login')}
              className="mt-6 w-full rounded-xl bg-[#16265C] px-4 py-3 font-bold text-white hover:bg-[#2846C7] cursor-pointer"
            >
              Go to Student Login
            </button>
          </div>
        ) : (
          <>
            {error && (
              <div role="alert" className="mt-5 flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {message && (
              <div role="status" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
                {message}
              </div>
            )}

            <form onSubmit={handleVerify} className="mt-5 space-y-4">
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                Registered Email Address
                <span className="relative mt-1 block">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={event => setEmail(event.target.value)}
                    placeholder="student@vnrvjiet.in"
                    className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-3 focus-visible:outline-2 focus-visible:outline-[#2846C7] dark:border-slate-700 dark:bg-slate-800"
                  />
                </span>
              </label>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                6-digit OTP
                <input
                  required
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={otp}
                  onChange={event => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="123456"
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-center text-2xl font-bold tracking-[0.4em] focus-visible:outline-2 focus-visible:outline-[#2846C7] dark:border-slate-700 dark:bg-slate-800"
                />
              </label>
              <p className="text-center text-sm font-semibold text-slate-600 dark:text-slate-300" aria-live="polite">
                {expiresIn !== null && Number.isFinite(expiresIn)
                  ? expiresIn > 0 ? `OTP expires in ${formatCountdown(expiresIn)}` : 'OTP expired. Resend a new OTP.'
                  : 'The OTP is valid for 10 minutes.'}
              </p>
              <button
                type="submit"
                disabled={loading || !email.trim() || otp.length !== 6 || (expiresIn !== null && expiresIn <= 0)}
                className="w-full rounded-xl bg-[#16265C] px-4 py-3 font-bold text-white hover:bg-[#2846C7] disabled:opacity-60 cursor-pointer"
              >
                {loading ? 'Verifying…' : 'Verify OTP'}
              </button>
            </form>

            {showChangeEmail ? (
              <form onSubmit={handleChangeEmail} className="mt-5 space-y-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                <h2 className="font-bold text-slate-800 dark:text-slate-100">Change email address</h2>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Roll Number
                  <input required value={rollNumber} onChange={event => setRollNumber(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-800" />
                </label>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Account Password
                  <span className="relative mt-1 block">
                    <LockKeyhole className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input required type="password" value={password} onChange={event => setPassword(event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-3 dark:border-slate-700 dark:bg-slate-800" />
                  </span>
                </label>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  New College Email
                  <input required type="email" value={newEmail} onChange={event => setNewEmail(event.target.value)} placeholder="student@vnrvjiet.in" className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-800" />
                </label>
                <button type="submit" disabled={resending} className="w-full rounded-lg bg-[#16265C] px-3 py-2.5 text-sm font-bold text-white disabled:opacity-60">
                  {resending ? 'Updating…' : 'Save Email and Send OTP'}
                </button>
              </form>
            ) : (
              <button type="button" onClick={() => setShowChangeEmail(true)} className="mt-4 w-full text-sm font-semibold text-[#2846C7] hover:underline dark:text-blue-300">
                Change email
              </button>
            )}

            <button
              type="button"
              onClick={handleResend}
              disabled={resending || !email.trim() || (resendIn !== null && resendIn > 0)}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <RefreshCw className={`h-4 w-4 ${resending ? 'animate-spin' : ''}`} />
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
