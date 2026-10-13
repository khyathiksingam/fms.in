import React, { useState, useEffect } from 'react';
import { Settings, Building2, Shield, Save, CheckCircle2, Sliders, HardDrive, FileType, Upload, UserCheck } from 'lucide-react';
import { api, apiRequest } from '../utils/api';
import { useAuth } from '../context/AuthContext';

export default function SettingsPage() {
  const { isAdmin, collegeSettings, refreshSettings } = useAuth();
  const [collegeName, setCollegeName] = useState('');
  const [systemName, setSystemName] = useState('');
  const [maxUploadSize, setMaxUploadSize] = useState(50);
  const [allowedTypes, setAllowedTypes] = useState('');
  const [studentSelfRegistration, setStudentSelfRegistration] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [logoFile, setLogoFile] = useState(null);
  const [logoSaving, setLogoSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await api.get('/settings');
      const s = data.settings || {};
      setCollegeName(s.college_name || 'Vallurupalli Nageswara Rao Vignana Jyothi Institute of Engineering & Technology');
      setSystemName(s.system_name || 'Faculty File Management System');
      setMaxUploadSize(s.max_upload_size_mb || 50);
      setAllowedTypes(s.allowed_file_types || 'pdf,doc,docx,xls,xlsx,ppt,pptx,txt,csv,jpg,jpeg,png,gif,svg,mp4,mov,avi,mp3,wav,zip,rar');
      setStudentSelfRegistration(Boolean(s.student_self_registration));
    } catch (e) {
      console.warn('Failed to load settings:', e);
    }
  };

  const handleLogoUpload = async () => {
    if (!isAdmin || !logoFile) return;
    setLogoSaving(true);
    setError('');
    setMessage('');
    try {
      const body = new FormData();
      body.append('logo', logoFile);
      await apiRequest('/settings/logo', { method: 'POST', body });
      setLogoFile(null);
      setMessage('College logo updated successfully.');
      await refreshSettings();
    } catch (err) {
      setError(err.message || 'Failed to upload college logo.');
    } finally {
      setLogoSaving(false);
    }
  };

  const handleToggleStudentSelfRegistration = async () => {
    if (!isAdmin) return;
    const nextVal = !studentSelfRegistration;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const res = await api.patch('/settings/student-registration', { enabled: nextVal });
      setStudentSelfRegistration(Boolean(res.student_self_registration));
      setMessage(`Student self-registration is now ${res.student_self_registration ? 'enabled (ON)' : 'disabled (OFF)'}.`);
      await refreshSettings();
    } catch (err) {
      setError(err.message || 'Failed to update student self-registration setting.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    if (!isAdmin) return;

    setSaving(true);
    setError('');
    setMessage('');

    try {
      await api.put('/settings', {
        college_name: collegeName.trim(),
        system_name: systemName.trim(),
        max_upload_size_mb: Number(maxUploadSize),
        allowed_file_types: allowedTypes.trim(),
        student_self_registration: studentSelfRegistration
      });

      setMessage('College branding & system settings updated successfully.');
      refreshSettings();
    } catch (err) {
      setError(err.message || 'Failed to update settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 text-left max-w-3xl">
      <div className="border-b border-slate-200 pb-3 dark:border-slate-800">
        <h2 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Settings className="h-5 w-5 text-brand-600" />
          College Branding & System Settings
        </h2>
        <p className="text-xs text-slate-400">
          Configure university title, repository constraints, storage limits, and file policies.
        </p>
      </div>

      {message && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          {message}
        </div>
      )}

      {error && (
        <div className="rounded-xl bg-rose-50 p-3 text-xs font-medium text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
          {error}
        </div>
      )}

      <form onSubmit={handleSaveSettings} className="space-y-5">
        {/* Branding Section */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
            <Building2 className="h-4 w-4 text-brand-600" />
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
              Institution Branding
            </h3>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              College / University Name
            </label>
            <input
              type="text"
              required
              disabled={!isAdmin}
              value={collegeName}
              onChange={(e) => setCollegeName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 disabled:opacity-60"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              System Title
            </label>
            <input
              type="text"
              required
              disabled={!isAdmin}
              value={systemName}
              onChange={(e) => setSystemName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 disabled:opacity-60"
            />
          </div>

          <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Header Logo (PNG, JPG, WebP, or SVG; max 2 MB)
            </label>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <img
                src={collegeSettings?.college_logo || '/brand/vnrvjiet-full-logo.png'}
                alt="Current header logo"
                className="h-12 w-52 rounded-xl border border-slate-200 bg-white object-contain p-1 dark:border-slate-700"
                onError={event => { event.currentTarget.src = '/brand/vnrvjiet-full-logo.png'; }}
              />
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml,.png,.jpg,.jpeg,.webp,.svg"
                disabled={!isAdmin || logoSaving}
                onChange={event => setLogoFile(event.target.files?.[0] || null)}
                className="min-w-0 flex-1 text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-xs file:font-semibold dark:text-slate-300 dark:file:bg-slate-800"
              />
              {isAdmin && (
                <button type="button" onClick={handleLogoUpload} disabled={!logoFile || logoSaving} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">
                  <Upload className="h-4 w-4" /> {logoSaving ? 'Uploading…' : 'Upload logo'}
                </button>
              )}
            </div>
            <p className="mt-2 text-[11px] text-slate-400">The uploaded image is validated and stored under a server-generated path. It appears as the wide Syllabus Books header logo; the compact VNRVJIET mark remains available for portal icons.</p>
          </div>
        </div>

        {/* Upload Policy & Size Limits */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
            <Sliders className="h-4 w-4 text-purple-600" />
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
              Storage Policies & Validation Rules
            </h3>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Max Upload Size Per File (MB)
            </label>
            <input
              type="number"
              min="5"
              max="500"
              required
              disabled={!isAdmin}
              value={maxUploadSize}
              onChange={(e) => setMaxUploadSize(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 disabled:opacity-60"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Allowed Document File Extensions (Comma-separated)
            </label>
            <input
              type="text"
              required
              disabled={!isAdmin}
              value={allowedTypes}
              onChange={(e) => setAllowedTypes(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 disabled:opacity-60"
            />
            <p className="mt-1 text-[11px] text-slate-400">
              Files with executable formats (.exe, .bat, .sh) are permanently blocked by server security.
            </p>
          </div>
        </div>

        {/* Student Registration Settings */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
            <UserCheck className="h-4 w-4 text-emerald-600" />
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
              Student Registration Settings
            </h3>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                Enable Student Self-Registration
              </label>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Allow students to create their own accounts using their official college email (@vnrvjiet.in).
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-extrabold ${studentSelfRegistration ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                {studentSelfRegistration ? 'ON' : 'OFF'}
              </span>
              {isAdmin && (
                <button
                  type="button"
                  onClick={handleToggleStudentSelfRegistration}
                  disabled={saving}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#2846C7] focus:ring-offset-2 disabled:opacity-50 ${studentSelfRegistration ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'}`}
                  role="switch"
                  aria-checked={studentSelfRegistration}
                >
                  <span className="sr-only">Toggle Student Self-Registration</span>
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${studentSelfRegistration ? 'translate-x-5' : 'translate-x-0'}`}
                  />
                </button>
              )}
            </div>
          </div>
        </div>

        {isAdmin && (
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-700 via-indigo-600 to-blue-600 px-6 py-2.5 text-xs font-bold text-white shadow-md shadow-indigo-500/25 hover:from-blue-800 hover:to-indigo-700 transition active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <Save className="h-4 w-4" />
              <span>{saving ? 'Saving Settings...' : 'Save Configuration'}</span>
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
