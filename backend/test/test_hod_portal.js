const BASE_URL = process.env.FFMS_TEST_URL || 'http://localhost:5000/api';

async function request(path, { method = 'GET', token, body, headers = {} } = {}) {
  const requestHeaders = { ...headers };
  let requestBody = body;
  if (token) requestHeaders.Authorization = ['Bearer', token].join(' ');
  if (body && !(body instanceof FormData)) {
    requestHeaders['Content-Type'] = 'application/json';
    requestBody = JSON.stringify(body);
  }
  const response = await fetch(`${BASE_URL}${path}`, { method, headers: requestHeaders, body: requestBody });
  const contentType = response.headers.get('content-type') || '';
  const result = contentType.includes('application/json') ? await response.json() : await response.text();
  return { status: response.status, body: result };
}

function check(condition, label) {
  if (!condition) throw new Error(`FAIL ${label}`);
  console.log(`PASS ${label}`);
}

function createPdf() {
  const content = 'BT\n/F1 18 Tf\n30 80 Td\n(HOD approval test) Tj\nET\n';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(content, 'ascii')} >>\nstream\n${content}endstream`
  ];
  let document = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(document, 'ascii'));
    document += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(document, 'ascii');
  document += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach(offset => { document += `${String(offset).padStart(10, '0')} 00000 n \n`; });
  document += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(document, 'ascii');
}

async function main() {
  const adminUsername = process.env.FFMS_ADMIN_USER;
  const adminPassword = process.env.FFMS_ADMIN_PASSWORD;
  const hodTemporaryPassword = process.env.FFMS_HOD_TEMP_PASSWORD;
  if (!adminUsername || !adminPassword || !hodTemporaryPassword) {
    throw new Error('Set FFMS_ADMIN_USER, FFMS_ADMIN_PASSWORD, and FFMS_HOD_TEMP_PASSWORD to run HOD integration tests.');
  }

  const adminLogin = await request('/auth/login', {
    method: 'POST',
    body: {
      username: adminUsername,
      password: adminPassword
    }
  });
  check(adminLogin.status === 200 && adminLogin.body.token, 'Admin test session');
  const adminToken = adminLogin.body.token;

  const publicDepartments = await request('/public/departments');
  check(publicDepartments.status === 200 && publicDepartments.body.departments.length === 21, 'Public directory lists exactly 21 active departments');
  check(publicDepartments.body.departments.every(department => department.hod_names), 'Each active department has an assigned HOD name');
  const publicFaculty = await request('/public/faculty');
  check(publicFaculty.status === 200 && Array.isArray(publicFaculty.body.faculty) &&
    !JSON.stringify(publicFaculty.body).match(/email|password|storage_path/i), 'Public faculty directory returns only safe profile fields');

  const users = await request('/users', { token: adminToken, headers: {}, });
  const hodUsers = users.body.users.filter(user => user.role_name === 'hod');
  check(users.status === 200 && hodUsers.length === 15, 'HOD seed creates one account per unique person');

  const hodLogin = await request('/auth/login', {
    method: 'POST',
    body: { username: 'hod.p.kishore', password: hodTemporaryPassword }
  });
  check(hodLogin.status === 200 && hodLogin.body.user.must_change_password === 1, 'New HOD account requires temporary password change');
  check(hodLogin.body.user.assigned_departments.length === 2, 'Shared HOD account is assigned to both departments');
  const hodToken = hodLogin.body.token;
  const deniedUntilPasswordChange = await request('/analytics/dashboard', { token: hodToken });
  check(deniedUntilPasswordChange.status === 403 && deniedUntilPasswordChange.body.code === 'PASSWORD_CHANGE_REQUIRED', 'Temporary HOD account is blocked from portal APIs');

  const passwordChange = await request('/auth/change-password', {
    method: 'POST',
    token: hodToken,
    body: { currentPassword: hodTemporaryPassword, newPassword: 'Test-HOD-Pass-2026!' }
  });
  check(passwordChange.status === 200, 'HOD can change the temporary password');
  const dashboard = await request('/hod/dashboard', { token: hodToken });
  check(dashboard.status === 200, 'HOD gains dashboard access after password rotation');

  const assignedDepartment = hodLogin.body.user.assigned_departments[1];
  const switchedDashboard = await request('/hod/dashboard', {
    token: hodToken,
    headers: { 'X-Active-Department-Id': String(assignedDepartment.id) }
  });
  check(switchedDashboard.status === 200 && switchedDashboard.body.department.id === assignedDepartment.id, 'HOD dashboard supports switching to another assigned department');
  const unrelatedDepartmentId = publicDepartments.body.departments.find(department => !hodLogin.body.user.assigned_departments.some(assigned => assigned.id === department.id)).id;
  const deniedUnrelated = await request('/hod/dashboard', {
    token: hodToken,
    headers: { 'X-Active-Department-Id': String(unrelatedDepartmentId) }
  });
  check(deniedUnrelated.status === 403, 'HOD cannot select an unrelated department');

  const roles = await request('/users/roles', { token: adminToken });
  const facultyRole = roles.body.roles.find(role => role.name === 'faculty');
  const ece = publicDepartments.body.departments.find(department => department.code === 'ECE');
  const external = publicDepartments.body.departments.find(department => department.code === 'AE');
  const suffix = `${Date.now()}`;

  async function uploadFacultyFile(department, shortName) {
    const user = await request('/users', {
      method: 'POST',
      token: adminToken,
      body: {
        full_name: `Test Faculty ${shortName}`,
        username: `test.faculty.${shortName}.${suffix}`,
        email: `test.faculty.${shortName}.${suffix}@example.invalid`,
        password: 'Test-Faculty-Pass-2026!',
        role_id: facultyRole.id,
        department_id: department.id
      }
    });
    check(user.status === 201, `Test faculty account created for ${department.code}`);
    const facultyLogin = await request('/auth/login', {
      method: 'POST',
      body: { username: `test.faculty.${shortName}.${suffix}`, password: 'Test-Faculty-Pass-2026!' }
    });
    const form = new FormData();
    form.append('visibility', 'public');
    form.append('files', new Blob([createPdf()], { type: 'application/pdf' }), `hod-review-${shortName}.pdf`);
    const uploaded = await request('/files/upload', { method: 'POST', token: facultyLogin.body.token, body: form });
    check(uploaded.status === 201, `Faculty PDF upload accepted for ${department.code}`);
    return uploaded.body.files[0].id;
  }

  const assignedFileId = await uploadFacultyFile(ece, 'ece');
  const pendingDashboard = await request('/hod/dashboard', {
    token: hodToken,
    headers: { 'X-Active-Department-Id': String(ece.id) }
  });
  check(pendingDashboard.body.submissions.some(file => file.id === assignedFileId && file.approval_status === 'pending'), 'Faculty upload appears in assigned HOD pending queue');
  const approved = await request(`/hod/submissions/${assignedFileId}`, {
    method: 'PATCH',
    token: hodToken,
    headers: { 'X-Active-Department-Id': String(ece.id) },
    body: { status: 'approved' }
  });
  check(approved.status === 200, 'HOD can approve an assigned department submission');

  const otherFileId = await uploadFacultyFile(external, 'ae');
  const forbiddenReview = await request(`/hod/submissions/${otherFileId}`, {
    method: 'PATCH',
    token: hodToken,
    headers: { 'X-Active-Department-Id': String(ece.id) },
    body: { status: 'approved' }
  });
  check(forbiddenReview.status === 404, 'HOD cannot review a submission from an unrelated department');
  const unrelatedFile = await request(`/files/${otherFileId}`, {
    token: hodToken,
    headers: { 'X-Active-Department-Id': String(ece.id) }
  });
  check(unrelatedFile.status === 403 || unrelatedFile.status === 404, 'HOD cannot open a file from an unrelated department');
  const unrelatedFaculty = await request('/users?allow_all=1', {
    token: hodToken,
    headers: { 'X-Active-Department-Id': String(ece.id) }
  });
  check(!unrelatedFaculty.body.users.some(user => user.username === `test.faculty.ae.${suffix}`), 'HOD cannot list faculty outside assigned departments');

  console.log('HOD portal integration checks passed.');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
