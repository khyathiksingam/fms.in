import React from 'react';
import { ChevronRight, Home, Folder } from 'lucide-react';

export default function Breadcrumbs({ rootLabel = 'Files', breadcrumbs = [], onNavigateRoot, onNavigateFolder }) {
  return (
    <nav className="flex items-center gap-1.5 overflow-x-auto py-2 text-xs font-medium text-slate-500 dark:text-slate-400">
      <button
        onClick={onNavigateRoot}
        className="flex items-center gap-1.5 rounded-lg px-2 py-1 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100"
      >
        <Home className="h-3.5 w-3.5 text-brand-600 dark:text-brand-400" />
        <span>{rootLabel}</span>
      </button>

      {breadcrumbs.map((crumb, idx) => {
        const isLast = idx === breadcrumbs.length - 1;

        return (
          <React.Fragment key={crumb.id || idx}>
            <ChevronRight className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600 flex-shrink-0" />
            <button
              onClick={() => onNavigateFolder(crumb)}
              disabled={isLast}
              className={`flex items-center gap-1.5 rounded-lg px-2 py-1 transition ${
                isLast
                  ? 'font-bold text-slate-900 dark:text-slate-100 cursor-default bg-slate-100 dark:bg-slate-800'
                  : 'hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100'
              }`}
            >
              <Folder className={`h-3.5 w-3.5 ${isLast ? 'text-brand-600 fill-brand-600/20' : 'text-slate-400'}`} />
              <span className="truncate max-w-[150px]">{crumb.name}</span>
            </button>
          </React.Fragment>
        );
      })}
    </nav>
  );
}
