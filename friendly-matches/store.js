'use strict';
const fs = require('fs');
const path = require('path');
const FILE = path.join(process.env.DATA_DIR || path.join(__dirname, '..', 'data'), 'friendlyMatches.json');
function load() {
  if (!fs.existsSync(FILE)) return { version: 1, posted: {} };
  // Fail closed on corruption so history is never silently discarded.
  const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  if (!data.posted || typeof data.posted !== 'object' || Array.isArray(data.posted)) throw new Error('Ungültiger Friendly-Match-Speicher.');
  return data;
}
function save(data) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(`${FILE}.tmp`, JSON.stringify(data, null, 2));
  fs.renameSync(`${FILE}.tmp`, FILE);
}
module.exports = { FILE, load, save };
