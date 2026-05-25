const fs = require("node:fs");
const path = require("node:path");

const outputPath = path.join(__dirname, "..", "dist-electron", "package.json");

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify({ type: "commonjs" }, null, 2)}\n`);
