export const PROGRAM_GROUPS = [
  {
    value: '__program_btech__',
    name: 'B.Tech',
    subtitle: 'Undergraduate',
    matches: program => normalize(program) === 'btech'
  },
  {
    value: '__program_btech_minor__',
    name: 'B.Tech Minor',
    subtitle: 'Specialisation tracks',
    matches: program => normalize(program).includes('btech') && normalize(program).includes('minor')
  },
  {
    value: '__program_btech_honors__',
    name: 'B.Tech Honors',
    subtitle: 'Honors programme',
    matches: program => normalize(program).includes('btech') && /honou?r/.test(normalize(program))
  },
  {
    value: '__program_mtech__',
    name: 'M.Tech',
    subtitle: 'Postgraduate',
    matches: program => normalize(program).startsWith('mtech')
  },
  {
    value: '__program_mca__',
    name: 'MCA',
    subtitle: 'Computer Applications',
    matches: program => normalize(program) === 'mca'
  }
];

export function normalize(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function matchesProgramSelection(program, selectedProgram) {
  if (!selectedProgram) return true;
  if (selectedProgram === '__other__') return !PROGRAM_GROUPS.some(group => group.matches(program));
  const group = PROGRAM_GROUPS.find(item => item.value === selectedProgram);
  return group ? group.matches(program) : program === selectedProgram;
}

export function regulationSort(a, b) {
  const preferred = ['R25', 'R22', 'A19', 'R19', 'R18', 'R15', 'R13', 'R12', 'R11'];
  const aIndex = preferred.findIndex(value => value.toLowerCase() === String(a).toLowerCase());
  const bIndex = preferred.findIndex(value => value.toLowerCase() === String(b).toLowerCase());
  if (aIndex >= 0 || bIndex >= 0) {
    if (aIndex < 0) return 1;
    if (bIndex < 0) return -1;
    return aIndex - bIndex;
  }
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

export function academicYearLabel(value) {
  const normalized = normalize(value);
  if (/^(first|1|i)(year)?$/.test(normalized)) return 'I Year';
  if (/^(second|2|ii)(year)?$/.test(normalized)) return 'II Year';
  if (/^(third|3|iii)(year)?$/.test(normalized)) return 'III Year';
  if (/^(fourth|4|iv)(year)?$/.test(normalized)) return 'IV Year';
  return String(value);
}

export function academicYearSort(a, b) {
  const order = ['I Year', 'II Year', 'III Year', 'IV Year'];
  const aIndex = order.indexOf(academicYearLabel(a));
  const bIndex = order.indexOf(academicYearLabel(b));
  if (aIndex >= 0 || bIndex >= 0) {
    if (aIndex < 0) return 1;
    if (bIndex < 0) return -1;
    return aIndex - bIndex;
  }
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}
