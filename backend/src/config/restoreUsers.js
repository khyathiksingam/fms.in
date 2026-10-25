const bcrypt = require('bcryptjs');
const { initDB, dbHelper } = require('../config/db');

async function restoreUsers() {
  await initDB();
  const temporaryPassword = process.env.FFMS_HOD_TEMP_PASSWORD;
  if (!temporaryPassword) {
    throw new Error('Set FFMS_HOD_TEMP_PASSWORD before provisioning an HOD account.');
  }
  const facultyPass = await bcrypt.hash(temporaryPassword, 10);

  const ravi = await dbHelper.get("SELECT * FROM users WHERE username = 'dr.ravi'");
  if (!ravi) {
    await dbHelper.run(`
      INSERT INTO users (id, full_name, username, password_hash, email, role_id, department_id, status, must_change_password)
      VALUES (2, 'Dr. Ravi Kumar', 'dr.ravi', ?, 'dr.ravi@example.edu', 2, 1, 'active', 1)
    `, [facultyPass]);
    await dbHelper.run("UPDATE departments SET hod_id = 2 WHERE id = 1");
    console.log("Re-seeded Dr. Ravi Kumar as HOD (CSE)");
  } else {
    console.log("Dr. Ravi exists:", ravi);
  }
}

restoreUsers();
