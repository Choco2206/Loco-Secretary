'use strict';
const fs = require('fs'); const path = require('path');
const FILE = path.join(process.env.DATA_DIR || path.join(__dirname, '..', 'data'), 'playerForm.json');
function load() {
  if (!fs.existsSync(FILE)) return { version: 1, matches: {}, messages: {} };
  const d = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  for (const k of ['matches', 'messages']) if (!d[k] || typeof d[k] !== 'object' || Array.isArray(d[k])) throw new Error('Ungültiger Spieler-Formkurven-Speicher.');
  return d;
}
function save(d) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(`${FILE}.tmp`, JSON.stringify(d, null, 2)); fs.renameSync(`${FILE}.tmp`, FILE);
}
module.exports = { FILE, load, save };
