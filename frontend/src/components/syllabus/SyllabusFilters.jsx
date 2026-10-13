import React from 'react';
import { matchesProgramSelection } from './syllabusBrowseData';

const FILTER_FIELDS = [
  ['department_id', 'Department / Branch'],
  ['semester', 'Semester'],
  ['subject_id', 'Subject']
];

export default function SyllabusFilters({ value, onChange, subjects }) {
  const selectedProgram = value.program;
  const matching = (subject) =>
    matchesProgramSelection(subject.program, selectedProgram) &&
    (!value.regulation || subject.regulation === value.regulation) &&
    (!value.department_id || String(subject.department_id) === String(value.department_id)) &&
    (!value.semester || subject.semester === value.semester);

  const optionsFor = (key) => {
    const rows = subjects.filter(matching);
    if (key === 'regulation') return [...new Set(rows.map(row => row.regulation))].sort().reverse();
    if (key === 'department_id') {
      const values = new Map(rows.map(row => [String(row.department_id), {
        id: row.department_id,
        label: row.department_name ? `${row.department_name} (${row.branch_code})` : row.branch_code
      }]));
      return [...values.values()].sort((a, b) => a.label.localeCompare(b.label));
    }
    if (key === 'semester') return [...new Set(rows.map(row => row.semester))].sort((a, b) => Number(a) - Number(b));
    return rows.map(row => ({ id: row.id, label: `${row.subject_code} — ${row.subject_name}` }));
  };

  const disabledFor = (key) => {
    if (!selectedProgram) return true;
    if (key === 'semester' && !value.department_id) return true;
    if (key === 'subject_id' && !value.semester) return true;
    return false;
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {FILTER_FIELDS.map(([key, label]) => {
        const options = optionsFor(key);
        const disabled = disabledFor(key);
        return (
          <label key={key} className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            {label}
            <select
              value={value[key]}
              disabled={disabled}
              onChange={e => onChange(key, e.target.value)}
              className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#31519e] focus:ring-2 focus:ring-[#31519e]/15 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              <option value="">{disabled ? 'Choose the previous filter first' : `All ${label.toLowerCase()}s`}</option>
              {options.map(option => {
                const id = typeof option === 'object' ? option.id : option;
                const text = typeof option === 'object' ? option.label : option;
                return <option key={id} value={id}>{text}</option>;
              })}
            </select>
          </label>
        );
      })}
    </div>
  );
}
