import React, { useMemo } from 'react';
import { Award, BookOpen, Cpu, GraduationCap, Monitor, School } from 'lucide-react';
import {
  matchesProgramSelection,
  PROGRAM_GROUPS
} from './syllabusBrowseData';

const PROGRAM_ICONS = [BookOpen, Award, GraduationCap, Cpu, Monitor, School];
const DEPARTMENT_GROUPS = [
  {
    title: 'ENGINEERING',
    departments: [
      { codes: ['AE'] },
      { codes: ['BT'] },
      { codes: ['CE'] },
      { codes: ['EEE'] },
      {
        codes: ['ECE', 'EVL'],
        name: 'Electronics and Communication Engineering (ECE) & Electronics Engineering (VLSI Design and Technology – EVL)'
      },
      { codes: ['EIE'] },
      { codes: ['ME'] }
    ]
  },
  {
    title: 'CSE & IT',
    departments: [
      { codes: ['CSECORE', 'CSBS'], name: 'Computer Science & Engineering (CSE and CSBS)' },
      { codes: ['AIML', 'IOT', 'RAI'], name: 'CSE (AI & ML) & IoT and R&AI' },
      { codes: ['CSE', 'CYS', 'DS', 'AIDS'], name: 'CSE-(CyS,DS) and AI&DS' },
      { codes: ['IT'] }
    ]
  },
  {
    title: 'SCIENCES & HUMANITIES',
    departments: [
      { codes: ['CHEM'] },
      { codes: ['ENG'] },
      { codes: ['MMS'] },
      { codes: ['PHY'] }
    ]
  }
];

export default function SyllabusBrowseControls({
  subjects,
  masterData,
  selected,
  onFilterChange,
  onDepartmentSelect,
  departmentBrowserOnly = false,
  hideDepartmentDirectory = false
}) {
  const availableSubjects = useMemo(
    () => subjects.filter(row => matchesProgramSelection(row.program, selected.program)),
    [subjects, selected.program]
  );
  const programCounts = useMemo(() => PROGRAM_GROUPS.map(group => ({
    ...group,
    count: subjects.filter(row => group.matches(row.program)).length
  })), [subjects]);
  const otherCount = subjects.filter(row => !PROGRAM_GROUPS.some(group => group.matches(row.program))).length;
  const visibleProgramCards = otherCount > 0
    ? [...programCounts, { value: '__other__', name: 'Diploma / Other', subtitle: 'Other programmes', count: otherCount }]
    : programCounts;
  const directoryRegulations = masterData.regulations || [];
  const upstreamSubjects = availableSubjects.filter(row =>
    !selected.regulation || row.regulation === selected.regulation
  );
  const departmentsByCode = new Map((masterData.departments || []).map(department => [department.code, department]));
  const departmentsByGroup = DEPARTMENT_GROUPS.map(group => ({
    title: group.title,
    items: group.departments.flatMap(definition => {
      const mappedDepartments = definition.codes
        .map(code => departmentsByCode.get(code))
        .filter(Boolean);
      if (!mappedDepartments.length) return [];
      return [{
        id: mappedDepartments.map(department => department.id).join('-'),
        name: definition.name || mappedDepartments[0].name,
        department_ids: mappedDepartments.map(department => department.id),
        document_count: mappedDepartments.reduce((total, department) => total + Number(department.document_count || 0), 0)
      }];
    })
  }));

  const departmentDirectory = (
    <section className="syllabus-department-directory rounded-3xl p-4 sm:p-6" aria-labelledby="departments-heading">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="departments-heading" className="text-lg font-extrabold text-[#16265C] dark:text-white">Browse departments</h2>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">Choose a department to see matching published syllabi.</p>
        </div>
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
          {upstreamSubjects.length} matching {upstreamSubjects.length === 1 ? 'document' : 'documents'}
        </span>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {departmentsByGroup.map(group => (
          <section key={group.title} aria-labelledby={`department-group-${group.title.replace(/\W+/g, '-').toLowerCase()}`}>
            <h3 id={`department-group-${group.title.replace(/\W+/g, '-').toLowerCase()}`} className="mb-2 border-b border-slate-200 pb-2 text-xs font-extrabold tracking-wider text-[#16265C] dark:border-slate-700 dark:text-[#F4B64E]">{group.title}</h3>
            {group.items.length ? <ul className="space-y-1.5">
              {group.items.map(department => {
                const count = upstreamSubjects.filter(row => department.department_ids.includes(Number(row.department_id))).length;
                const selectedDepartmentIds = selected.department_ids
                  ? selected.department_ids.split(',').map(Number).sort((a, b) => a - b)
                  : selected.department_id
                    ? [Number(selected.department_id)]
                    : [];
                const active = JSON.stringify([...department.department_ids].sort((a, b) => a - b)) === JSON.stringify(selectedDepartmentIds);
                const status = count > 0
                  ? 'Published syllabus available'
                  : department.document_count > 0
                    ? '0 for current filters'
                    : 'No published syllabi yet';
                return (
                  <li key={department.id}>
                    <button
                      type="button"
                      aria-pressed={active}
                      onClick={() => onDepartmentSelect(department)}
                      className={`syllabus-department-button grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 rounded-xl border p-3 text-left text-sm ${active ? 'is-selected' : ''}`}
                    >
                      <span className="row-span-2 min-w-0 break-words font-semibold leading-5">{department.name}</span>
                      <span className="syllabus-department-count justify-self-end rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                        {count} {count === 1 ? 'document' : 'documents'}
                      </span>
                      <span className="syllabus-department-status max-w-36 justify-self-end break-words text-right text-[10px] font-medium leading-4 text-slate-500 dark:text-slate-400">
                        {status}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul> : <p className="py-2 text-xs text-slate-500 dark:text-slate-400">No active departments in this group.</p>}
          </section>
        ))}
      </div>
    </section>
  );

  if (departmentBrowserOnly) {
    return <div>{departmentDirectory}</div>;
  }

  return (
    <div className="space-y-5">
      <section aria-labelledby="programs-heading">
        <div className="mb-3">
          <h2 id="programs-heading" className="text-lg font-extrabold text-[#16265C] dark:text-white">Browse programmes</h2>
          <p className="text-xs text-slate-600 dark:text-slate-300">Choose a programme to narrow the published curriculum.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {visibleProgramCards.map((program, index) => {
            const Icon = PROGRAM_ICONS[index];
            const active = selected.program === program.value;
            return (
              <button
                key={program.value}
                type="button"
                aria-pressed={active}
                onClick={() => onFilterChange('program', active ? '' : program.value)}
                className={`syllabus-program-card flex min-h-24 items-center justify-between gap-2 rounded-2xl border p-4 text-left ${active ? 'selected border-[#16265C] bg-[#eef2fb] text-[#16265C] dark:border-[#F4B64E] dark:bg-slate-800 dark:text-white' : 'border-slate-200 bg-white text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100'}`}
              >
                <span className="min-w-0">
                  <span className="block font-bold">{program.name}</span>
                  <span className={`mt-1 block text-xs ${active ? 'text-[#334879] dark:text-slate-300' : 'text-slate-600 dark:text-slate-400'}`}>{program.subtitle}</span>
                  <span className="mt-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">{program.count} {program.count === 1 ? 'document' : 'documents'}</span>
                </span>
                <Icon className={`h-5 w-5 shrink-0 ${active ? 'text-[#16265C] dark:text-[#F4B64E]' : 'text-[#F4B64E]'}`} aria-hidden="true" />
              </button>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="regulations-heading">
        <h2 id="regulations-heading" className="mb-2 text-sm font-bold text-[#16265C] dark:text-white">Regulation</h2>
        <div className="flex flex-wrap gap-2">
          {[{ value: '', label: 'All', document_count: null }, ...directoryRegulations.map(row => ({
            value: row.code,
            label: row.code,
            display_name: row.display_name,
            document_count: row.document_count
          }))].map(option => (
            <button
              key={option.value || 'all-regulations'}
              type="button"
              aria-pressed={selected.regulation === option.value}
              title={option.display_name || option.label}
              onClick={() => onFilterChange('regulation', option.value)}
              className={`syllabus-filter-pill syllabus-regulation-pill ${selected.regulation === option.value ? 'is-selected' : ''}`}
            >
              {option.label}
              {option.value && <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] ${selected.regulation === option.value ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>{option.document_count || 0}</span>}
            </button>
          ))}
          {directoryRegulations.length === 0 && <span className="self-center text-xs text-slate-500">No active regulations are configured.</span>}
        </div>
      </section>

      {!hideDepartmentDirectory && departmentDirectory}
    </div>
  );
}
