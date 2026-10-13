const BASE_URL = process.env.FFMS_TEST_URL || 'http://localhost:5000/api';
const createdFiles = [];
const createdEntries = [];
const createdUsers = [];
const deletedFiles = [];
let passed = 0;
let failed = 0;
let restoreRegulation = null;
let restoreDepartment = null;

function assert(condition, label) {
  if (condition) {
    console.log(`PASS ${label}`);
    passed += 1;
  } else {
    console.error(`FAIL ${label}`);
    failed += 1;
  }
}

async function request(path, { method = 'GET', token, body, headers = {} } = {}) {
  const requestHeaders = { ...headers };
  let requestBody = body;
  if (token) requestHeaders.Authorization = `Bearer ${token}`;
  if (body && !(body instanceof FormData)) {
    requestHeaders['Content-Type'] = 'application/json';
    requestBody = JSON.stringify(body);
  }
  const response = await fetch(`${BASE_URL}${path}`, { method, headers: requestHeaders, body: requestBody });
  const contentType = response.headers.get('content-type') || '';
  const result = contentType.includes('application/json') ? await response.json() : Buffer.from(await response.arrayBuffer());
  return { status: response.status, headers: response.headers, body: result };
}

function makePdf() {
  const content = 'BT\n/F1 18 Tf\n30 80 Td\n(Temporary syllabus test fixture) Tj\nET\n';
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
  const xrefOffset = Buffer.byteLength(document, 'ascii');
  document += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach(offset => {
    document += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  document += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(document, 'ascii');
}

async function uploadPdf(token, name, visibility) {
  const form = new FormData();
  form.append('visibility', visibility);
  form.append('files', new Blob([makePdf()], { type: 'application/pdf' }), name);
  const result = await request('/files/upload', { method: 'POST', token, body: form });
  const fileId = result.body?.files?.[0]?.id;
  if (fileId) createdFiles.push(fileId);
  if (result.status !== 201 || !fileId) {
    throw new Error(`Temporary PDF upload failed with HTTP ${result.status}: ${JSON.stringify(result.body).slice(0, 500)}`);
  }
  return fileId;
}

async function uploadNonPdfWithPdfName(token, name) {
  const form = new FormData();
  form.append('visibility', 'public');
  form.append('files', new Blob(['This is not a PDF file.'], { type: 'application/pdf' }), name);
  const result = await request('/files/upload', { method: 'POST', token, body: form });
  const fileId = result.body?.files?.[0]?.id;
  if (fileId) createdFiles.push(fileId);
  if (result.status !== 201 || !fileId) {
    throw new Error(`Invalid-PDF validation fixture upload failed with HTTP ${result.status}.`);
  }
  return fileId;
}

function cataloguePayload(fileId, departmentId, suffix, published = false, resource = {}) {
  return {
    file_id: fileId,
    program: 'B.Tech',
    regulation: 'R25',
    academic_year: '2098-2099',
    department_id: departmentId,
    branch_code: 'TEST',
    semester: '7',
    subject_code: `TEST-${suffix}`,
    subject_name: `Temporary Syllabus ${suffix}`,
    published,
    resource_type: resource.resource_type || 'syllabus',
    student_visible: resource.student_visible === undefined ? true : resource.student_visible
  };
}

async function cleanup(token) {
  let cleanupFailures = 0;
  for (const id of createdEntries) {
    try {
      const response = await request(`/syllabus/${id}`, { method: 'DELETE', token });
      if (![200, 404].includes(response.status)) {
        cleanupFailures += 1;
        console.error(`Cleanup failed to unlink test catalogue entry ${id}: HTTP ${response.status}`);
      }
    } catch (error) {
      cleanupFailures += 1;
      console.error(`Cleanup failed to unlink test catalogue entry ${id}: ${error.message}`);
    }
  }
  for (const id of createdFiles) {
    if (deletedFiles.includes(id)) {
      try {
        const restored = await request(`/files/${id}/restore`, { method: 'POST', token });
        if (![200, 404].includes(restored.status)) {
          cleanupFailures += 1;
          console.error(`Cleanup failed to restore test PDF ${id}: HTTP ${restored.status}`);
        }
        for (const id of createdUsers) {
          try {
            const removed = await request(`/users/${id}`, { method: 'DELETE', token });
            if (![200, 404].includes(removed.status)) {
              cleanupFailures += 1;
              console.error(`Cleanup failed to remove test user ${id}: HTTP ${removed.status}`);
            }
          } catch (error) {
            cleanupFailures += 1;
            console.error(`Cleanup failed to remove test user ${id}: ${error.message}`);
          }
        }
      } catch (error) {
        cleanupFailures += 1;
        console.error(`Cleanup failed to restore test PDF ${id}: ${error.message}`);
      }
    }
    try {
      const removed = await request(`/files/${id}/permanent`, { method: 'DELETE', token });
      if (![200, 404].includes(removed.status)) {
        cleanupFailures += 1;
        console.error(`Cleanup failed to remove test PDF ${id}: HTTP ${removed.status}`);
      }
    } catch (error) {
      cleanupFailures += 1;
      console.error(`Cleanup failed to remove test PDF ${id}: ${error.message}`);
    }
  }
  if (cleanupFailures) failed += cleanupFailures;
}

async function run() {
  let token = null;
  try {
    const username = process.env.FFMS_ADMIN_USER;
    const password = process.env.FFMS_ADMIN_PASSWORD;
    if (!username || !password) {
      throw new Error('Set FFMS_ADMIN_USER and FFMS_ADMIN_PASSWORD for integration tests.');
    }
    const login = await request('/auth/login', {
      method: 'POST',
      body: { username, password }
    });
    assert(login.status === 200 && Boolean(login.body.token), 'Admin login');
    if (login.status !== 200 || !login.body.token) throw new Error('Admin credentials are unavailable for integration tests.');
    token = login.body.token;

    const publicFilters = await request('/public/syllabus/filters');
    const expectedRegulations = ['R25', 'R22', 'A19', 'R19', 'R18', 'R15', 'R13', 'R12', 'R11'];
    const orderedFilterRegulations = (publicFilters.body.regulations || []).filter(code => expectedRegulations.includes(code));
    assert(publicFilters.status === 200 &&
      JSON.stringify(orderedFilterRegulations) === JSON.stringify(expectedRegulations) &&
      Array.isArray(publicFilters.body.departments) &&
      !JSON.stringify(publicFilters.body).includes('storage_path'),
    'Anonymous filter API includes active master data and safe catalogue metadata');
    const publicMasterData = await request('/public/syllabus/master-data');
    const regulationCodes = publicMasterData.body?.regulations?.map(row => row.code) || [];
    const expectedGroups = ['ENGINEERING', 'CSE & IT', 'SCIENCES & HUMANITIES'];
    const orderedMasterRegulations = regulationCodes.filter(code => expectedRegulations.includes(code));
    assert(publicMasterData.status === 200 && JSON.stringify(orderedMasterRegulations) === JSON.stringify(expectedRegulations), 'Public syllabus master data includes active seeded regulations in priority order');
    const regulationDetail = publicMasterData.body.regulations.find(row => row.code === 'R25');
    assert(regulationDetail?.effective_from === '2025 onwards' && Boolean(regulationDetail.description), 'Regulation master data includes effective date and description');
    assert(publicMasterData.status === 200 && expectedGroups.every(group => publicMasterData.body.departments.some(row => row.display_group === group)), 'Public syllabus master data includes active seeded departments');
    assert(!JSON.stringify(publicMasterData.body).includes('storage_path'), 'Public master data does not expose file storage paths');
    const endpointChecks = await Promise.all([
      request('/public/syllabus/master-data'),
      request('/public/syllabus/filters'),
      request('/public/syllabus')
    ]);
    assert(endpointChecks.every(result => result.status === 200 && result.headers.get('content-type')?.includes('application/json')), 'All required public syllabus endpoints return JSON');
    const unknownApi = await request('/endpoint-does-not-exist');
    assert(unknownApi.status === 404 && unknownApi.headers.get('content-type')?.includes('application/json'), 'Unknown API paths return JSON 404 responses, not HTML');
    const anonymousManagement = await request('/syllabus');
    assert(anonymousManagement.status === 401, 'Catalogue management requires authentication');
    const anonymousRegulationManagement = await request('/academic-regulations');
    assert(anonymousRegulationManagement.status === 401, 'Regulation management requires Admin authentication');
    const adminFilters = await request('/syllabus/filters', { token });
    assert(adminFilters.status === 200 && Array.isArray(adminFilters.body.programs), 'Admin catalogue filter API');
    const adminRegulations = await request('/academic-regulations', { token });
    const regulation = adminRegulations.body.regulations?.find(row => row.code === 'R11');
    assert(adminRegulations.status === 200 && Boolean(regulation), 'Admin can list academic regulation master data');
    if (regulation) {
      restoreRegulation = {
        id: regulation.id,
        code: regulation.code,
        display_name: regulation.display_name,
        programme: regulation.programme,
        sort_order: regulation.sort_order,
        active: Boolean(regulation.active)
      };
      const changed = await request(`/academic-regulations/${regulation.id}`, {
        method: 'PUT',
        token,
        body: { ...restoreRegulation, display_name: `${regulation.display_name} Test` }
      });
      const deactivated = await request(`/academic-regulations/${regulation.id}/status`, { method: 'PATCH', token, body: { active: false } });
      const hiddenFromStudents = await request('/public/syllabus/master-data');
      const reactivated = await request(`/academic-regulations/${regulation.id}/status`, { method: 'PATCH', token, body: { active: true } });
      const restored = await request(`/academic-regulations/${regulation.id}`, { method: 'PUT', token, body: restoreRegulation });
      assert(changed.status === 200 && deactivated.status === 200 && !hiddenFromStudents.body.regulations.some(row => row.code === 'R11') && reactivated.status === 200 && restored.status === 200, 'Admin can edit, deactivate, and reactivate regulations while public master data hides inactive choices');
      if (restored.status === 200) restoreRegulation = null;
    }
    const invalidPage = await request('/public/syllabus?page=0');
    assert(invalidPage.status === 400, 'Public pagination rejects invalid input');

    const profile = await request('/auth/me', { token });
    const departments = await request('/departments', { token });
    const departmentId = profile.body.user?.department_id || departments.body.departments?.[0]?.id;
    assert(Number.isInteger(Number(departmentId)), 'Department available for catalogue metadata');
    if (!departmentId) throw new Error('No department exists for the temporary syllabus records.');
    const department = departments.body.departments?.find(row => row.id === Number(departmentId));
    if (department) {
      restoreDepartment = {
        id: department.id,
        name: department.name,
        code: department.code,
        display_group: department.display_group || 'OTHER',
        sort_order: department.sort_order || 0,
        active: Boolean(department.active)
      };
      const changed = await request(`/departments/${department.id}`, {
        method: 'PUT',
        token,
        body: { ...restoreDepartment, sort_order: restoreDepartment.sort_order + 1 }
      });
      const deactivated = await request(`/departments/${department.id}/status`, { method: 'PATCH', token, body: { active: false } });
      const hiddenFromStudents = await request('/public/syllabus/master-data');
      const reactivated = await request(`/departments/${department.id}/status`, { method: 'PATCH', token, body: { active: true } });
      const restored = await request(`/departments/${department.id}`, { method: 'PUT', token, body: restoreDepartment });
      assert(changed.status === 200 && deactivated.status === 200 && !hiddenFromStudents.body.departments.some(row => row.id === department.id) && reactivated.status === 200 && restored.status === 200, 'Admin can edit, deactivate, and reactivate departments without deleting relationships');
      if (restored.status === 200) restoreDepartment = null;
    }

    const suffix = Date.now().toString();
    const publicFileId = await uploadPdf(token, `test-syllabus-${suffix}.pdf`, 'public');
    const created = await request('/syllabus', {
      method: 'POST',
      token,
      body: cataloguePayload(publicFileId, Number(departmentId), suffix)
    });
    assert(created.status === 201, 'Admin creates unpublished catalogue entry');
    if (!created.body.id) throw new Error(`Catalogue creation failed with HTTP ${created.status}.`);
    const catalogueId = created.body.id;
    createdEntries.push(catalogueId);

    let results = await request(`/public/syllabus?q=TEST-${suffix}`);
    assert(results.status === 200 && !results.body.syllabus.some(row => row.subject_code === `TEST-${suffix}`), 'Unpublished syllabus is absent from public listing');

    const published = await request(`/syllabus/${catalogueId}/published`, { method: 'PATCH', token, body: { published: true } });
    assert(published.status === 200, 'Admin publishes catalogue entry');
    results = await request(`/public/syllabus?q=TEST-${suffix}&program=B.Tech&regulation=R25&academic_year=2098-2099&department_id=${departmentId}&branch_code=TEST&semester=7&subject_id=${catalogueId}`);
    const programFilters = await request('/public/syllabus/filters');
    assert(results.status === 200 && results.body.syllabus.some(row => row.subject_code === `TEST-${suffix}`) && !JSON.stringify(results.body).includes('storage_path'), 'Public search and progressive filters return safe syllabus metadata');
    assert(programFilters.status === 200 && programFilters.body.programs.some(row => row.value === 'B.Tech' && row.count > 0), 'Program card counts are backed by published database records');
    const groupedProgram = await request(`/public/syllabus?program_group=btech&department_ids=${departmentId}`);
    const invalidProgramGroup = await request('/public/syllabus?program_group=unknown');
    const invalidDepartmentIds = await request('/public/syllabus?department_ids=1,invalid');
    assert(groupedProgram.status === 200 && groupedProgram.body.syllabus.some(row => row.subject_code === `TEST-${suffix}`), 'Grouped programme and department filters return matching published records');
    assert(invalidProgramGroup.status === 400 && invalidDepartmentIds.status === 400, 'Public grouped filters reject invalid values');

    const anonymousPreview = await request(`/public/syllabus/${catalogueId}/preview`);
    const anonymousDownload = await request(`/public/syllabus/${catalogueId}/download`);
    assert(anonymousPreview.status === 401 && anonymousDownload.status === 401, 'Student login is required before preview or download');

    const roleData = await request('/users/roles', { token });
    const studentRole = roleData.body.roles?.find(role => role.name === 'student');
    const facultyRole = roleData.body.roles?.find(role => role.name === 'faculty');
    const studentCreated = await request('/users', {
      method: 'POST',
      token,
      body: {
        full_name: `Test Student ${suffix}`,
        username: `student-${suffix}`,
        email: `student-${suffix}@example.test`,
        password: 'Student-test-password-123',
        role_id: studentRole?.id,
        department_id: Number(departmentId),
        roll_number: `ROLL-${suffix}`,
        programme: 'B.Tech',
        academic_year: 'II Year',
        semester: '3'
      }
    });
    assert(studentCreated.status === 201, 'Admin creates a student account with hashed password and academic details');
    if (!studentCreated.body.userId) throw new Error('Student account creation failed.');
    createdUsers.push(studentCreated.body.userId);
    const studentLogin = await request('/auth/student-login', { method: 'POST', body: { username: `student-${suffix}`, password: 'Student-test-password-123' } });
    const studentToken = studentLogin.body.token;
    assert(studentLogin.status === 200 && studentLogin.body.user?.role_name === 'student' && !JSON.stringify(studentLogin.body).includes('password_hash'), 'Student login returns a student profile without a password hash');
    const preview = await request(`/public/syllabus/${catalogueId}/preview`, { token: studentToken });
    assert(preview.status === 200 &&
      preview.headers.get('content-type') === 'application/pdf' &&
      Buffer.compare(preview.body, makePdf()) === 0,
    'Authenticated student preview returns the uploaded PDF bytes with the correct MIME type');
    const rangePreview = await request(`/public/syllabus/${catalogueId}/preview`, {
      token: studentToken,
      headers: { Range: 'bytes=0-4' }
    });
    assert(rangePreview.status === 206 &&
      rangePreview.headers.get('content-range')?.startsWith('bytes 0-4/') &&
      rangePreview.body.toString('ascii') === '%PDF-',
    'PDF preview supports browser byte-range requests');
    const tokenInUrl = await request(`/public/syllabus/${catalogueId}/preview?token=${encodeURIComponent(studentToken)}`);
    assert(tokenInUrl.status === 400, 'Student document routes reject authentication tokens in query strings');
    const download = await request(`/public/syllabus/${catalogueId}/download`, { token: studentToken });
    const downloadDisposition = download.headers.get('content-disposition') || '';
    assert(download.status === 200 &&
      downloadDisposition.startsWith('attachment') &&
      Buffer.compare(download.body, makePdf()) === 0 &&
      decodeURIComponent(downloadDisposition.match(/filename\*=UTF-8''([^;]+)/)?.[1] || '') === `test-syllabus-${suffix}.pdf`,
    'Authenticated student downloads the uploaded PDF bytes with its original filename');
    const studentFiles = await request('/files', { token: studentToken });
    assert(studentFiles.status === 403, 'Student token cannot access Faculty Portal file APIs');

    const facultyCreated = await request('/users', {
      method: 'POST',
      token,
      body: {
        full_name: `Test Faculty ${suffix}`,
        username: `faculty-${suffix}`,
        email: `faculty-${suffix}@example.test`,
        password: 'Faculty-test-password-123',
        role_id: facultyRole?.id,
        department_id: 1
      }
    });
    assert(facultyCreated.status === 201, 'Admin creates a Faculty account for activity-scope verification');
    if (!facultyCreated.body.userId) throw new Error('Faculty test account creation failed.');
    createdUsers.push(facultyCreated.body.userId);
    const facultyLogin = await request('/auth/login', { method: 'POST', body: { username: `faculty-${suffix}`, password: 'Faculty-test-password-123' } });
    const facultyToken = facultyLogin.body.token;
    const facultyCatalogueMasterData = await request('/syllabus/master-data', { token: facultyToken });
    const publicMasterDataForFaculty = await request('/public/syllabus/master-data');
    assert(facultyCatalogueMasterData.status === 200 &&
      facultyCatalogueMasterData.body.departments.some(department => department.id === 1) &&
      publicMasterDataForFaculty.body.departments.some(department => department.id === 1),
    'Faculty management and the public department directory include the mapped legacy CSE department');
    const beforeHeartbeat = await request('/activity?action=Faculty%20Login', { token: facultyToken });
    await new Promise(resolve => setTimeout(resolve, 1100));
    const heartbeat = await request('/auth/heartbeat', { method: 'POST', token: facultyToken });
    const ownLoginActivity = await request('/activity?action=Faculty%20Login', { token: facultyToken });
    const facultyLoginEvents = (ownLoginActivity.body.logs || []).filter(row => row.session_id);
    const previousLastSeen = (beforeHeartbeat.body.logs || []).find(row => row.session_id)?.session_last_seen_at;
    const updatedLastSeen = facultyLoginEvents[0]?.session_last_seen_at;
    assert(heartbeat.status === 204 &&
      facultyLogin.status === 200 &&
      facultyLoginEvents.length === 1 &&
      facultyLoginEvents[0].user_id === facultyCreated.body.userId &&
      Boolean(facultyLoginEvents[0].session_started_at) &&
      previousLastSeen &&
      updatedLastSeen &&
      Date.parse(`${updatedLastSeen.replace(' ', 'T')}Z`) > Date.parse(`${previousLastSeen.replace(' ', 'T')}Z`),
    'Faculty heartbeat updates last-seen and the activity stream shows one linked login event');
    const crossUserActivity = await request(`/activity?user_id=${profile.body.user.id}`, { token: facultyToken });
    const adminFacultyActivity = await request(`/activity?user_id=${facultyCreated.body.userId}`, { token });
    const clientActivityWrite = await request('/activity', { method: 'POST', token: facultyToken, body: { action: 'Forged Activity' } });
    assert(crossUserActivity.status === 200 && crossUserActivity.body.logs.length === 0 &&
      adminFacultyActivity.status === 200 && adminFacultyActivity.body.logs.some(row => row.user_id === facultyCreated.body.userId) &&
      clientActivityWrite.status === 404,
    'Faculty activity is owner-only, administrators can monitor it, and clients cannot write activity records');
    const noteFileId = await uploadPdf(facultyToken, `faculty-note-${suffix}.pdf`, 'public');
    const selectableFacultyFiles = await request('/syllabus/files', { token: facultyToken });
    assert(selectableFacultyFiles.status === 200 &&
      selectableFacultyFiles.body.files.some(file => file.id === noteFileId && file.department_id === 1),
    'Faculty can select an existing uploaded PDF from its original file record');
    const noteEntry = await request('/syllabus', {
      method: 'POST',
      token: facultyToken,
      body: cataloguePayload(noteFileId, 1, `${suffix}-note`, false, { resource_type: 'faculty_note', student_visible: true })
    });
    if (!noteEntry.body.id) throw new Error(`Faculty Note submission failed with HTTP ${noteEntry.status}.`);
    createdEntries.push(noteEntry.body.id);
    const facultyUploadActivity = await request('/activity?action=File%20Uploaded', { token: facultyToken });
    assert(facultyUploadActivity.status === 200 &&
      facultyUploadActivity.body.logs.some(row => row.file_id === noteFileId && row.user_id === facultyCreated.body.userId),
    'Faculty uploads are recorded against the authenticated faculty user');
    const notePublished = await request(`/syllabus/${noteEntry.body.id}/published`, { method: 'PATCH', token, body: { published: true } });
    const publishedActivity = await request('/activity?action=Syllabus%20Published', { token });
    const notesOnly = await request(`/public/syllabus?resource_type=faculty_note&q=TEST-${suffix}-NOTE`);
    const syllabusOnly = await request(`/public/syllabus?resource_type=syllabus&q=TEST-${suffix}-NOTE`);
    const facultyUploadListing = await request(`/public/syllabus?resource_type=faculty_note&program=B.Tech&regulation=R25&academic_year=2098-2099&department_id=1&branch_code=TEST&semester=7&q=TEST-${suffix}-NOTE`);
    const publicDepartmentData = await request('/public/syllabus/master-data');
    const selectableFilesAfterLink = await request('/syllabus/files', { token: facultyToken });
    const notePreview = await request(`/public/syllabus/${noteEntry.body.id}/preview`, { token: studentToken });
    assert(notePublished.status === 200 && publishedActivity.status === 200 &&
      publishedActivity.body.logs.some(row => row.file_id === noteFileId),
    'Faculty resource publication is recorded server-side');
    assert(notesOnly.body.syllabus.some(row => row.resource_type === 'faculty_note') &&
      !syllabusOnly.body.syllabus.length,
    'Published faculty uploads appear only in the student Faculty Notes listing');
    assert(facultyUploadListing.body.syllabus.some(row => row.id === noteEntry.body.id &&
      row.file_id === noteFileId && row.department_id === 1 &&
      row.academic_year === '2098-2099'),
    'Published faculty uploads appear in matching student department and academic-year filters');
    assert(selectableFilesAfterLink.status === 200 &&
      !selectableFilesAfterLink.body.files.some(file => file.id === noteFileId),
    'Linking a resource reuses the uploaded file and prevents duplicate catalogue entries');
    assert(publicDepartmentData.body.departments.find(department => department.id === 1)?.document_count > 0,
      'Published resources in the legacy CSE department contribute to the public department document count');
    assert(notePreview.status === 200, 'Student can access a published note explicitly shared with students');
    const noteDownload = await request(`/public/syllabus/${noteEntry.body.id}/download`, { token: studentToken });
    assert(noteDownload.status === 200 && Buffer.compare(noteDownload.body, makePdf()) === 0,
      'Student download returns the actual uploaded faculty resource');
    const nonPdfFileId = await uploadNonPdfWithPdfName(facultyToken, `invalid-pdf-${suffix}.pdf`);
    const nonPdfPayload = cataloguePayload(nonPdfFileId, Number(departmentId), `${suffix}-invalid`);
    nonPdfPayload.subject_name = `Invalid PDF fixture ${suffix}-invalid`;
    const nonPdfEntry = await request('/syllabus', {
      method: 'POST',
      token: facultyToken,
      body: nonPdfPayload
    });
    const studentListingAfterInvalidUpload = await request(`/public/syllabus?q=TEST-${suffix}-invalid`);
    assert(nonPdfEntry.status === 400 &&
      nonPdfEntry.body.error.includes('valid PDF data') &&
      !studentListingAfterInvalidUpload.body.syllabus.length,
    'A file with a PDF name but non-PDF contents cannot enter the student catalogue');
    const noteUpdatePayload = cataloguePayload(noteFileId, Number(departmentId), `${suffix}-note`, true, {
      resource_type: 'faculty_note',
      student_visible: true
    });
    noteUpdatePayload.subject_name = `Updated Faculty Note ${suffix}`;
    const noteUpdated = await request(`/syllabus/${noteEntry.body.id}`, { method: 'PUT', token: facultyToken, body: noteUpdatePayload });
    const updateActivity = await request('/activity?action=Syllabus%20Updated', { token: facultyToken });
    assert(noteUpdated.status === 200 && updateActivity.body.logs.some(row => row.metadata.catalogue_id === noteEntry.body.id), 'Faculty syllabus metadata updates are recorded server-side');
    const facultyActivity = await request('/student/activity/mine', { token: facultyToken });
    assert(facultyActivity.status === 200 &&
      facultyActivity.body.activity.some(row => row.catalogue_id === noteEntry.body.id) &&
      facultyActivity.body.activity.every(row => row.faculty_uploader_id === facultyCreated.body.userId),
    'Faculty activity only lists student access to files uploaded by that faculty');

    const facultyLogout = await request('/auth/logout', { method: 'POST', token: facultyToken });
    const revokedFacultySession = await request('/auth/me', { token: facultyToken });
    const facultyLogoutActivity = await request('/activity?action=Faculty%20Logout', { token });
    assert(facultyLogout.status === 200 && revokedFacultySession.status === 401 &&
      facultyLogoutActivity.body.logs.some(row => row.user_id === facultyCreated.body.userId &&
        row.session_logout_at && row.session_duration_seconds >= 0),
    'Faculty logout records its own session duration and immediately revokes its token');

    await request('/student/activity', { method: 'POST', token: studentToken, body: { action: 'student_resource_searched' } });
    await request('/student/activity', { method: 'POST', token: studentToken, body: { action: 'student_resource_filtered' } });
    const adminMonitor = await request('/student/activity/monitor', { token });
    assert(adminMonitor.status === 200 && adminMonitor.body.activity.some(row => row.user_id === undefined && row.roll_number === `ROLL-${suffix}`) && adminMonitor.body.login_history.some(row => row.roll_number === `ROLL-${suffix}`), 'Admin activity monitor includes student login and resource actions');
    const noteAccessEvents = adminMonitor.body.activity.filter(row => row.catalogue_id === noteEntry.body.id);
    assert(noteAccessEvents.some(row => row.action === 'student_resource_previewed') &&
      noteAccessEvents.some(row => row.action === 'student_resource_downloaded') &&
      !noteAccessEvents.some(row => row.action === 'student_resource_opened'),
    'Student previews and downloads are each tracked once with accurate server-side event types');

    const updatedPayload = { ...cataloguePayload(publicFileId, Number(departmentId), suffix, true), subject_name: `Edited Temporary Syllabus ${suffix}` };
    const updated = await request(`/syllabus/${catalogueId}`, { method: 'PUT', token, body: updatedPayload });
    const adminList = await request(`/syllabus?q=TEST-${suffix}`, { token });
    assert(updated.status === 200 && adminList.body.syllabus?.some(row => row.subject_name === updatedPayload.subject_name), 'Admin edits catalogue metadata');

    const unpublished = await request(`/syllabus/${catalogueId}/published`, { method: 'PATCH', token, body: { published: false } });
    const unpublishedActivity = await request('/activity?action=Syllabus%20Unpublished', { token });
    const hiddenPreview = await request(`/public/syllabus/${catalogueId}/preview`, { token: studentToken });
    const hiddenDownload = await request(`/public/syllabus/${catalogueId}/download`, { token: studentToken });
    assert(unpublished.status === 200 && unpublishedActivity.status === 200 &&
      unpublishedActivity.body.logs.some(row => row.file_id === publicFileId) &&
      hiddenPreview.status === 404 && hiddenDownload.status === 404,
    `Unpublished action is audited and the file cannot be previewed or downloaded (${unpublished.status}/${hiddenPreview.status}/${hiddenDownload.status})`);

    const privateSuffix = `${suffix}-private`;
    const privateFileId = await uploadPdf(token, `test-private-syllabus-${suffix}.pdf`, 'private');
    const privateEntry = await request('/syllabus', {
      method: 'POST',
      token,
      body: cataloguePayload(privateFileId, Number(departmentId), privateSuffix)
    });
    if (privateEntry.body.id) createdEntries.push(privateEntry.body.id);
    const privatePublish = privateEntry.body.id
      ? await request(`/syllabus/${privateEntry.body.id}/published`, { method: 'PATCH', token, body: { published: true } })
      : { status: 0 };
    const privatePreview = privateEntry.body.id ? await request(`/public/syllabus/${privateEntry.body.id}/preview`, { token: studentToken }) : { status: 0 };
    const privateDownload = privateEntry.body.id ? await request(`/public/syllabus/${privateEntry.body.id}/download`, { token: studentToken }) : { status: 0 };
    assert(privateEntry.status === 201 && privatePublish.status === 400 && privatePreview.status === 404 && privateDownload.status === 404, `Private file stays inaccessible through public syllabus URLs (${privateEntry.status}/${privatePublish.status}/${privatePreview.status}/${privateDownload.status})`);

    const unsharedSuffix = `${suffix}-unshared`;
    const unsharedFileId = await uploadPdf(token, `test-unshared-syllabus-${suffix}.pdf`, 'public');
    const unsharedEntry = await request('/syllabus', {
      method: 'POST',
      token,
      body: cataloguePayload(unsharedFileId, Number(departmentId), unsharedSuffix, false, { student_visible: false })
    });
    if (unsharedEntry.body.id) createdEntries.push(unsharedEntry.body.id);
    const unsharedPublished = unsharedEntry.body.id
      ? await request(`/syllabus/${unsharedEntry.body.id}/published`, { method: 'PATCH', token, body: { published: true } })
      : { status: 0 };
    const unsharedResults = await request(`/public/syllabus?q=TEST-${unsharedSuffix}`);
    const unsharedPreview = unsharedEntry.body.id
      ? await request(`/public/syllabus/${unsharedEntry.body.id}/preview`, { token: studentToken })
      : { status: 0 };
    assert(unsharedEntry.status === 201 && unsharedPublished.status === 200 && !unsharedResults.body.syllabus.some(row => row.subject_code === `TEST-${unsharedSuffix}`) && unsharedPreview.status === 404, 'Published resources marked not visible to students stay hidden');

    await request(`/syllabus/${catalogueId}/published`, { method: 'PATCH', token, body: { published: true } });
    const trashed = await request(`/files/${publicFileId}`, { method: 'DELETE', token });
    const deletionActivity = await request('/activity?action=File%20Moved%20to%20Trash', { token });
    if (trashed.status === 200) deletedFiles.push(publicFileId);
    const deletedPreview = await request(`/public/syllabus/${catalogueId}/preview`, { token: studentToken });
    const deletedDownload = await request(`/public/syllabus/${catalogueId}/download`, { token: studentToken });
    assert(trashed.status === 200 && deletionActivity.status === 200 &&
      deletionActivity.body.logs.some(row => row.file_id === publicFileId) &&
      deletedPreview.status === 404 && deletedDownload.status === 404,
    `Deletion is audited and the soft-deleted file cannot be previewed or downloaded (${trashed.status}/${deletedPreview.status}/${deletedDownload.status})`);

    const unlinked = await request(`/syllabus/${catalogueId}`, { method: 'DELETE', token });
    createdEntries.splice(createdEntries.indexOf(catalogueId), 1);
    const storedFile = await request(`/files/${publicFileId}`, { token });
    assert(unlinked.status === 200 && storedFile.status === 200, 'Unlinking catalogue metadata leaves the stored file intact');
    const studentLogout = await request('/auth/logout', { method: 'POST', token: studentToken });
    const logoutActivity = await request('/student/activity/monitor', { token });
    assert(studentLogout.status === 200 && logoutActivity.body.activity.some(row => row.roll_number === `ROLL-${suffix}` && row.action === 'student_logout'), 'Student logout is tracked server-side');
  } catch (error) {
    console.error('Syllabus integration test error:', error.message);
    failed += 1;
  } finally {
    if (token && restoreRegulation) {
      try {
        await request(`/academic-regulations/${restoreRegulation.id}`, { method: 'PUT', token, body: restoreRegulation });
        await request(`/academic-regulations/${restoreRegulation.id}/status`, { method: 'PATCH', token, body: { active: Boolean(restoreRegulation.active) } });
      } catch (error) {
        failed += 1;
        console.error(`Could not restore test regulation: ${error.message}`);
      }
    }
    if (token && restoreDepartment) {
      try {
        await request(`/departments/${restoreDepartment.id}`, { method: 'PUT', token, body: restoreDepartment });
        await request(`/departments/${restoreDepartment.id}/status`, { method: 'PATCH', token, body: { active: Boolean(restoreDepartment.active) } });
      } catch (error) {
        failed += 1;
        console.error(`Could not restore test department: ${error.message}`);
      }
    }
    if (token) await cleanup(token);
    console.log(`Syllabus integration tests: ${passed} passed, ${failed} failed`);
    process.exitCode = failed ? 1 : 0;
  }
}

run();
