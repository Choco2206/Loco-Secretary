const fs = require('fs');
const path = require('path');
const Module = require('module');

require('./self-roles-hook')();
require('./gta-channels-hook')();
require('./roster-hook')();
require('./power-ranking-hook')();
require('./friendly-matches-hook')();
require('./player-form-hook')();
require('./weekly-report-hook')();

const file = path.join(__dirname, 'bootstrap.js');
let source = fs.readFileSync(file, 'utf8');

// Avoid repeated Gateway opcode 8 member-fetch requests.
source = source.replace(/\s*await guild\.members\.fetch\(\);/g, '');

source = source.replace(/Choko/g, 'Choco');

const runtimeModule = new Module(file, module);
runtimeModule.filename = file;
runtimeModule.paths = Module._nodeModulePaths(__dirname);
runtimeModule._compile(source, file);
