const http = require('http');

const BASE_URL = process.env.FFMS_TEST_URL || 'http://localhost:5000/api';

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${BASE_URL}${path}`);
    const reqOptions = {
      method: options.method || 'GET',
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    };

    const req = http.request(reqOptions, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, body });
        }
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function verify() {
  console.log('--- Verifying Branding & User Role Updates via API ---');

  // 1. Login as Admin
  const adminRes = await request('/auth/login', {
    method: 'POST',
    body: {
      username: process.env.FFMS_ADMIN_USER || 'admin',
      password: process.env.FFMS_ADMIN_PASSWORD || 'Admin@123'
    }
  });
  const token = adminRes.data.token;
  console.log('1. Admin Login:', adminRes.status === 200 ? 'SUCCESS' : 'FAILED');

  // 2. Update College Branding
  const brandingRes = await request('/settings', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: {
      college_name: 'Your College',
      system_name: 'Faculty File Management System',
      max_upload_size_mb: 100,
      allowed_file_types: 'pdf,doc,docx,xls,xlsx,ppt,pptx,txt,csv,jpg,jpeg,png,gif,svg,mp4,mov,avi,mp3,wav,zip,rar'
    }
  });
  console.log('2. Update College Branding:', brandingRes.status === 200 ? 'SUCCESS' : 'FAILED');
  console.log('   Saved College Name:', brandingRes.data?.settings?.college_name);

  // 3. Ensure Dr. Ravi Kumar user exists and update details
  let usersList = await request('/users', { headers: { Authorization: `Bearer ${token}` } });
  let ravi = usersList.data?.users?.find(u => u.username === 'dr.ravi');

  if (!ravi) {
    const createRes = await request('/users', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: {
        full_name: 'Dr. Ravi Kumar',
        username: 'dr.ravi',
        email: 'dr.ravi@example.edu',
        password: 'Faculty@123',
        role_id: 2,
        department_id: 1,
        status: 'active'
      }
    });
    console.log('3a. Create Dr. Ravi User:', createRes.status === 201 ? 'SUCCESS' : 'FAILED');
    usersList = await request('/users', { headers: { Authorization: `Bearer ${token}` } });
    ravi = usersList.data?.users?.find(u => u.username === 'dr.ravi');
  }

  // 4. Update Dr. Ravi's email to khyathiksingam@gmail.com and role as HOD
  const updateRes = await request(`/users/${ravi.id}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: {
      full_name: 'Dr. Ravi Kumar',
      username: 'dr.ravi',
      email: 'khyathiksingam@gmail.com',
      role_id: 2,
      department_id: 1,
      status: 'active'
    }
  });
  console.log('4. Update User Details & Role:', updateRes.status === 200 ? 'SUCCESS' : 'FAILED');
  console.log('   Update response:', updateRes.data);

  // 5. Verify updated user in user list
  const verifyUsers = await request('/users', { headers: { Authorization: `Bearer ${token}` } });
  const updatedRavi = verifyUsers.data?.users?.find(u => u.username === 'dr.ravi');
  console.log('5. Verified User Details:');
  console.log(`   Name: ${updatedRavi?.full_name}`);
  console.log(`   Email: ${updatedRavi?.email}`);
  console.log(`   Role: ${updatedRavi?.role_name}`);
  console.log(`   Department: ${updatedRavi?.department_code}`);

  // 6. Verify public branding endpoint
  const pub = await request('/settings/public');
  console.log('6. Verified Public Branding:', pub.data?.settings?.college_name);
}

verify();
