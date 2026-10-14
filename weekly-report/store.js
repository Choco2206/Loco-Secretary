'use strict';
const fs = require('fs'); const path = require('path');
const FILE = path.join(process.env.DATA_DIR || path.join(__dirname, '..', 'data'), 'weeklyReports.json');
function load() {
  if (!fs.existsSync(FILE)) return { version: 1, matches: {}, reports: {} };
  const d = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  for (const k of ['matches', 'reports']) if (!d[k] || typeof d[k] !== 'object' || Array.isArray(d[k])) throw new Error('Ungültiger Wochenbericht-Speicher.');
  return d;
}
function save(d) { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(`${FILE}.tmp`, JSON.stringify(d, null, 2)); fs.renameSync(`${FILE}.tmp`, FILE); }
function recordMatches(raw, now = new Date()) {
  const d = load(); require('./model').ingest(d, raw, now); save(d);
}
module.exports = { FILE, load, save, recordMatches };
