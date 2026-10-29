import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

export default function ThemeToggle({ className = '', title }) {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-2xs transition hover:bg-slate-100 hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-slate-800 dark:bg-slate-900 dark:text-amber-300 dark:hover:bg-slate-800 cursor-pointer ${className}`}
      title={title || (isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode')}
      aria-label={title || (isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode')}
    >
      {isDark ? (
        <Sun className="h-4 w-4 animate-in spin-in-180 duration-300" />
      ) : (
        <Moon className="h-4 w-4 animate-in spin-in-180 duration-300" />
      )}
    </button>
  );
}
