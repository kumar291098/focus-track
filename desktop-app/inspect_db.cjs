const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

async function run() {
  const SQL = await initSqlJs();
  const dbPath = path.join(process.env.APPDATA, 'FocusTrack', 'focustrack.db');
  if (!fs.existsSync(dbPath)) {
    console.log("Database file does not exist at", dbPath);
    return;
  }
  const fileBuffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(new Uint8Array(fileBuffer));
  
  console.log("=== APP_ACTIVITY TABLE ===");
  const res = db.exec("SELECT * FROM app_activity LIMIT 20");
  if (res.length === 0) {
    console.log("No data or table is empty");
  } else {
    const columns = res[0].columns;
    const values = res[0].values;
    console.log("Columns:", columns.join(" | "));
    values.forEach(row => {
      console.log(row.join(" | "));
    });
  }
  
  console.log("=== TOTAL COUNT ===");
  const countRes = db.exec("SELECT COUNT(*) FROM app_activity");
  console.log("Total rows:", countRes[0]?.values[0]?.[0]);
}

run().catch(console.error);
