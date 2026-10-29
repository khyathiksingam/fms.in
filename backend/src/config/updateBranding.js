const { dbHelper } = require('./db');

async function updateBranding() {
  console.log("Automatic branding updates are permanently disabled to protect user uploaded logos.");
  try {
    const settings = await dbHelper.get("SELECT college_name, college_logo, system_logo FROM system_settings ORDER BY id ASC LIMIT 1");
    return settings || {};
  } catch (err) {
    return {};
  }
}

module.exports = { updateBranding };
