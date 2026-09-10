'use strict';

const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'data', 'powerRanking.json');

function defaults() {
  return {
    version: 1,
    club: {
      clubId: '46978',
      name: 'Loco Squad',
      platform: 'common-gen5',
      platformLabel: 'PS5 / Xbox Series / PC',
      linkedAt: 'initial-config',
    },
    links: {},
    session: null,
    lastSession: null,
    matches: {},
    weeklyArchive: {},
    messages: { admin: null, ranking: null },
  };
}

function normalize(data) {
  const base = defaults();
  const value = data && typeof data === 'object' ? data : {};
  return {
    ...base,
    ...value,
    links: value.links && typeof value.links === 'object' ? value.links : {},
    matches: value.matches && typeof value.matches === 'object' ? value.matches : {},
    weeklyArchive: value.weeklyArchive && typeof value.weeklyArchive === 'object' ? value.weeklyArchive : {},
    messages: { ...base.messages, ...(value.messages || {}) },
  };
}

function ensureStore() {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  if (!fs.existsSync(DATA_FILE)) save(defaults());
}

function load() {
  ensureStore();
  try {
    return normalize(JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')));
  } catch (error) {
    console.error('[power-ranking] Datendatei beschädigt:', error.message);
    return defaults();
  }
}

function save(data) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  const temp = `${DATA_FILE}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(normalize(data), null, 2), 'utf8');
  fs.renameSync(temp, DATA_FILE);
}

function update(updater) {
  const data = load();
  const result = updater(data) || data;
  save(result);
  return result;
}

module.exports = { DATA_FILE, defaults, load, save, update };
