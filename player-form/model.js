'use strict';
const { CLUB_ID, isActive, parseMatch, normalizePosition } = (() => {
  const model = require('../friendly-matches/model');
  return { ...model, normalizePosition: require('../power-ranking/scoring').normalizePosition };
})();
const POSITIONS = ['goalkeeper', 'defender', 'midfielder', 'forward'];
const MIN_PLAYER_SECONDS = 45 * 60;
function normalizeName(value) { return String(value || '').trim().normalize('NFKC').toLowerCase(); }
function ingest(data, rawMatches, now = new Date()) {
  let added = 0;
  for (const raw of rawMatches) {
    const m = parseMatch(raw);
    if (!m || new Date(m.timestamp) > now || !isActive(new Date(m.timestamp))) continue;
    const entry = { id: m.id, clubId: CLUB_ID, timestamp: m.timestamp, minutes: m.minutes, termination: m.termination,
      players: m.own.players };
    if (!data.matches[m.id]) added++;
    // EA can fill in player data later; keep the latest available snapshot.
    data.matches[m.id] = entry;
  }
  return added;
}
function findPlayer(match, link) {
  if (!link) return null;
  const rows = match.players || [];
  if (link.playerId) {
    const exact = rows.find(p => String(p.id) === String(link.playerId));
    if (exact) return exact;
    // Do not use the name to override a known but different ID.
    return null;
  }
  const names = rows.filter(p => normalizeName(p.name) === normalizeName(link.playerName));
  return names.length === 1 ? names[0] : null;
}
function average(rows, key) {
  const values = rows.map(p => p[key]).filter(n => typeof n === 'number' && Number.isFinite(n));
  return values.length === rows.length && values.length ? values.reduce((n, v) => n + v, 0) / values.length : null;
}
function weightedPassPercent(rows) {
  if (!rows.length || rows.some(p => p.passes === null || p.passAttempts === null)) return null;
  const attempts = rows.reduce((n, p) => n + p.passAttempts, 0);
  return attempts ? 100 * rows.reduce((n, p) => n + p.passes, 0) / attempts : null;
}
function summarize(rows) {
  return { rating: average(rows, 'rating'), passPercent: weightedPassPercent(rows),
    goals: average(rows, 'goals'), assists: average(rows, 'assists'), tackles: average(rows, 'tackles'), saves: average(rows, 'saves') };
}
function playerForm(data, link) {
  const buckets = Object.fromEntries(POSITIONS.map(p => [p, []]));
  let excluded = 0;
  for (const match of Object.values(data.matches || {})) {
    if (String(match.clubId) !== CLUB_ID) continue;
    const p = findPlayer(match, link);
    if (!p || !POSITIONS.includes(p.position)) continue;
    if (match.termination || match.minutes === null || match.minutes < 90 || p.secondsPlayed === null || p.secondsPlayed < MIN_PLAYER_SECONDS) {
      excluded++; continue;
    }
    buckets[p.position].push({ ...p, timestamp: match.timestamp, matchId: match.id });
  }
  return { excluded, positions: Object.fromEntries(POSITIONS.map(position => {
    const rows = buckets[position].sort((a, b) => b.timestamp.localeCompare(a.timestamp) || b.matchId.localeCompare(a.matchId));
    const current = rows.slice(0, 5); const previous = rows.slice(5, 10);
    return [position, { count: rows.length, currentCount: current.length, previousCount: previous.length,
      comparable: current.length === 5 && previous.length === 5, current: summarize(current), previous: summarize(previous),
      latestAt: current[0]?.timestamp || null }];
  })) };
}
module.exports = { POSITIONS, MIN_PLAYER_SECONDS, normalizeName, ingest, findPlayer, playerForm, summarize, normalizePosition };
