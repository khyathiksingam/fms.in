const { initDB, dbHelper } = require('../config/db');

async function updateBranding() {
  await initDB();
  const collegeName = 'Vallurupalli Nageswara Rao Vignana Jyothi Institute of Engineering & Technology';
  const systemName = 'Faculty File Management System';
  const collegeLogo = '/brand/vnrvjiet-full-logo.png';
  const systemLogo = '/brand/vnrvjiet-mark.png';
  await dbHelper.run(
    `UPDATE system_settings
     SET college_name = ?, system_name = ?, college_logo = ?, system_logo = ?, updated_at = CURRENT_TIMESTAMP`,
    [collegeName, systemName, collegeLogo, systemLogo]
  );
  const row = await dbHelper.get("SELECT * FROM system_settings");
  console.log("Database updated branding:", row);
}

updateBranding();
