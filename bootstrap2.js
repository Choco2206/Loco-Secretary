const fs = require('fs');
const path = require('path');
const Module = require('module');

const file = path.join(__dirname, 'bootstrap.js');
let source = fs.readFileSync(file, 'utf8');

// Avoid repeated Gateway opcode 8 member-fetch requests.
source = source.replace(/\s*await guild\.members\.fetch\(\);/g, '');

// FC27: load members through the REST member list when the cache is empty.
// This avoids Gateway opcode 8 rate limits while still populating the Loco-Squad list after a restart.
source = source.replace(
  "async function fc27Members(guild) {\n  return [...guild.members.cache.values()]\n    .filter(m => !m.user.bot && m.roles.cache.has(CONFIG.roles.locoSquad))\n    .sort((a, b) => a.displayName.localeCompare(b.displayName, 'de'));\n}",
  "async function fc27Members(guild) {\n  let members = [...guild.members.cache.values()]\n    .filter(m => !m.user.bot && m.roles.cache.has(CONFIG.roles.locoSquad));\n\n  if (members.length === 0) {\n    try {\n      await guild.members.list({ limit: 1000 });\n      members = [...guild.members.cache.values()]\n        .filter(m => !m.user.bot && m.roles.cache.has(CONFIG.roles.locoSquad));\n    } catch (error) {\n      console.error('[fc27] REST member list failed:', error.message);\n    }\n  }\n\n  return members.sort((a, b) => a.displayName.localeCompare(b.displayName, 'de'));\n}"
);

// FC27: merge LIV / ZIV / RIV into one common IV position.
source = source.replace(
  "const FC27_POSITIONS = ['TW', 'LIV', 'ZIV', 'RIV', 'ZDM', 'ZOM', 'LM/RM', 'ST'];",
  "const FC27_POSITIONS = ['TW', 'IV', 'ZDM', 'ZOM', 'LM/RM', 'ST'];"
);
source = source.replace(
  '**TW · LIV · ZIV · RIV · ZDM · ZOM · LM/RM · ST**',
  '**TW · IV · ZDM · ZOM · LM/RM · ST**'
);

source = source.replace(/Choko/g, 'Choco');

const migrationNeedle = "function fc27Save(d) { fs.writeFileSync(FC27_FILE, JSON.stringify(d, null, 2), 'utf8'); }";
const migrationCode = `${migrationNeedle}\nfunction fc27MigrateOldIvPositions(data) {\n  let changed = false;\n  const migrateList = (list) => {\n    if (!Array.isArray(list)) return list;\n    const mapped = list.map(p => ['LIV', 'ZIV', 'RIV'].includes(p) ? 'IV' : p);\n    const unique = [...new Set(mapped)];\n    if (JSON.stringify(mapped) !== JSON.stringify(list)) changed = true;\n    return unique.length === 3 ? unique : null;\n  };\n  for (const p of Object.values(data.players || {})) {\n    if (p.self) { const next = migrateList(p.self); if (next) p.self = next; else { delete p.self; changed = true; } }\n    if (p.manager) { const next = migrateList(p.manager); if (next) p.manager = next; else { delete p.manager; changed = true; } }\n  }\n  if (changed) fc27Save(data);\n  return data;\n}`;
source = source.replace(migrationNeedle, migrationCode);
source = source.replace(
  "const d = JSON.parse(fs.readFileSync(FC27_FILE, 'utf8') || '{}');\n    if (!d.players) d.players = {};\n    return d;",
  "const d = JSON.parse(fs.readFileSync(FC27_FILE, 'utf8') || '{}');\n    if (!d.players) d.players = {};\n    return fc27MigrateOldIvPositions(d);"
);

const runtimeModule = new Module(file, module);
runtimeModule.filename = file;
runtimeModule.paths = Module._nodeModulePaths(__dirname);
runtimeModule._compile(source, file);
