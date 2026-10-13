export function formatBytes(bytes, decimals = 2) {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function parseUtcDate(dateString) {
  if (!dateString) return null;
  let s = String(dateString).trim();
  // SQLite timestamps 'YYYY-MM-DD HH:MM:SS' without timezone indicator are UTC
  if (!s.endsWith('Z') && !s.includes('+') && !s.includes('T')) {
    s = s.replace(' ', 'T') + 'Z';
  } else if (!s.endsWith('Z') && !s.includes('+') && s.includes('T')) {
    s = s + 'Z';
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? new Date(dateString) : d;
}

export function formatDate(dateString) {
  if (!dateString) return '—';
  const date = parseUtcDate(dateString);
  if (!date || isNaN(date.getTime())) return dateString;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

export function formatRelativeTime(dateString) {
  if (!dateString) return '';
  const date = parseUtcDate(dateString);
  if (!date || isNaN(date.getTime())) return '';
  const now = new Date();
  const diffInSeconds = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));

  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  return formatDate(dateString);
}

export function getFileCategoryColor(type) {
  switch (type?.toLowerCase()) {
    case 'pdf':
      return {
        bg: 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800/50',
        badge: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
      };
    case 'document':
      return {
        bg: 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800/50',
        badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
      };
    case 'spreadsheet':
      return {
        bg: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50',
        badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
      };
    case 'presentation':
      return {
        bg: 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/50',
        badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
      };
    case 'image':
      return {
        bg: 'bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800/50',
        badge: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300'
      };
    case 'video':
      return {
        bg: 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800/50',
        badge: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300'
      };
    case 'audio':
      return {
        bg: 'bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 border-violet-200 dark:border-violet-800/50',
        badge: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300'
      };
    case 'archive':
      return {
        bg: 'bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800/50',
        badge: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300'
      };
    default:
      return {
        bg: 'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800',
        badge: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
      };
  }
}
