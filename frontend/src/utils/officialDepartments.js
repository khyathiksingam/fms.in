const OFFICIAL_DEPARTMENT_GROUPS = [
  { label: 'Automobile Engineering', codes: ['AE'] },
  { label: 'Biotechnology', codes: ['BT'] },
  { label: 'Civil Engineering', codes: ['CE'] },
  { label: 'Electrical & Electronics Engineering', codes: ['EEE'] },
  {
    label: 'Electronics and Communication Engineering (ECE) & Electronics Engineering (VLSI Design and Technology - EVL)',
    codes: ['ECE', 'EVL']
  },
  { label: 'Electronics and Instrumentation Engineering', codes: ['EIE'] },
  { label: 'Mechanical Engineering', codes: ['ME'] },
  { label: 'Computer Science & Engineering (CSE and CSBS)', codes: ['CSECORE', 'CSBS'] },
  { label: 'CSE (AI & ML) & IoT and R&AI', codes: ['AIML', 'IOT', 'RAI'] },
  { label: 'CSE – (CyS, DS) and AI&DS', codes: ['CSE', 'CYS', 'DS', 'AIDS'] },
  { label: 'Information Technology', codes: ['IT'] },
  { label: 'Chemistry', codes: ['CHEM'] },
  { label: 'English', codes: ['ENG'] },
  { label: 'Mathematics & Management Sciences (MMS)', codes: ['MMS'] },
  { label: 'Physics', codes: ['PHY'] }
];

const normalizeCode = (code) => String(code || '').trim().toUpperCase();

export function getOfficialDepartmentOptions(departments = []) {
  const byCode = new Map(departments.map(department => [normalizeCode(department.code), department]));

  return OFFICIAL_DEPARTMENT_GROUPS.flatMap(group => {
    const members = group.codes.map(code => byCode.get(code)).filter(Boolean);
    if (members.length === 0) return [];

    // Keep a stable existing department ID as the value for a grouped choice.
    const canonical = byCode.get(group.codes[0]) || members[0];
    return [{ id: canonical.id, label: group.label, memberIds: members.map(member => Number(member.id)) }];
  });
}

export function getOfficialDepartmentLabel(code, fallback = '—') {
  const normalized = normalizeCode(code);
  const group = OFFICIAL_DEPARTMENT_GROUPS.find(item => item.codes.includes(normalized));
  return group?.label || fallback || '—';
}

export function getOfficialDepartmentId(departmentId, departments = []) {
  const id = Number(departmentId);
  const options = getOfficialDepartmentOptions(departments);
  return options.find(option => option.memberIds.includes(id))?.id || '';
}
