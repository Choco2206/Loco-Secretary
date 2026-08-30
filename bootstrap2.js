const fs = require('fs');
const path = require('path');
const Module = require('module');

const file = path.join(__dirname, 'bootstrap.js');
let source = fs.readFileSync(file, 'utf8');

// Avoid repeated Gateway opcode 8 member-fetch requests. The bot already has
// GuildMembers intent and keeps the cache updated via member/role events.
source = source.replace(/\s*await guild\.members\.fetch\(\);/g, '');

const runtimeModule = new Module(file, module);
runtimeModule.filename = file;
runtimeModule.paths = Module._nodeModulePaths(__dirname);
runtimeModule._compile(source, file);
