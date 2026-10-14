'use strict';
const { localParts, parseMatch } = require('../friendly-matches/model');
const FIRST_WEEK = '2026-10-12';
function addDays(key, count) {
  const d = new Date(`${key}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + count); return d.toISOString().slice(0, 10);
}
function boundary(key) {
  // At 07:30 Berlin is never in the ambiguous/missing DST transition hour.
  const offset = new Intl.DateTimeFormat('en', { timeZone: 'Europe/Berlin', timeZoneName: 'shortOffset' })
    .formatToParts(new Date(`${key}T12:00:00Z`)).find(p => p.type === 'timeZoneName').value;
  const hours = Number(/GMT([+-]\d+)/.exec(offset)?.[1] || 0);
  return new Date(`${key}T07:30:00Z`).getTime() - hours * 3600000;
}
function currentWeek(now) {
  const p = localParts(now); const key = `${p.year}-${p.month}-${p.day}`;
  const weekday = new Date(`${key}T12:00:00Z`).getUTCDay();
  let monday = addDays(key, -((weekday + 6) % 7));
  if (now.getTime() < boundary(monday)) monday = addDays(monday, -7);
  return monday;
}
function dueWeeks(now, reports) {
  const due = [];
  for (let key = FIRST_WEEK; boundary(addDays(key, 7)) <= now.getTime(); key = addDays(key, 7)) {
    if (!reports[key]) due.push(key);
  }
  return due;
}
function ingest(data, raw, now = new Date()) {
  for (const row of raw) {
    const m = parseMatch(row);
    if (!m || new Date(m.timestamp).getTime() < boundary(FIRST_WEEK) || new Date(m.timestamp) > now) continue;
    data.matches[m.id] = { id: m.id, timestamp: m.timestamp, ownGoals: m.own.goals, opponentGoals: m.opponent.goals,
      opponentName: m.opponent.name, minutes: m.minutes, termination: m.termination,
      regular: !m.termination && m.durationSeconds !== null && m.durationSeconds >= 5400 };
  }
  data.lastCapturedAt = now.toISOString();
}
function summarize(rows) {
  const result = { games: rows.length, wins: 0, draws: 0, losses: 0, goals: 0, against: 0 };
  for (const m of rows) {
    result.goals += m.ownGoals; result.against += m.opponentGoals;
    result[m.ownGoals > m.opponentGoals ? 'wins' : m.ownGoals < m.opponentGoals ? 'losses' : 'draws']++;
  }
  return result;
}
function weekData(data, key) {
  const start = boundary(key); const end = boundary(addDays(key, 7));
  const rows = Object.values(data.matches).filter(m => { const t = new Date(m.timestamp).getTime(); return t >= start && t < end; })
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp) || a.id.localeCompare(b.id));
  const regular = rows.filter(m => m.regular); const other = rows.filter(m => !m.regular);
  return { rows, regular: summarize(regular), other: summarize(other), all: summarize(rows) };
}
module.exports = { FIRST_WEEK, addDays, boundary, currentWeek, dueWeeks, ingest, weekData };
