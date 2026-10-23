'use strict';

const { normalizePosition } = require('../power-ranking/scoring');
const { decodeEvents } = require('./events');
const CLUB_ID = '18360';
const CHANNEL_ID = '1559992305467916399';
const PLATFORM = 'common-gen5';
const MIN_MATCH_SECONDS = 50 * 60;
const POLL_MS = 10 * 60 * 1000;
const POSITIONS = { goalkeeper: 'TW', defender: 'ABW', midfielder: 'MIT', forward: 'ANG' };

function localParts(date) {
  return Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).map(p => [p.type, p.value]));
}
function isActive(date) { const h = Number(localParts(date).hour); return h >= 20 || h < 4; }
function sessionKey(date) {
  const p = localParts(date);
  const day = new Date(Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), 12));
  if (Number(p.hour) < 20) day.setUTCDate(day.getUTCDate() - 1);
  return day.toISOString().slice(0, 10);
}
function matchTime(raw) {
  const value = raw?.timestamp ?? raw?.matchTimestamp ?? raw?.match_timestamp ?? raw?.date;
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  const date = new Date(Number.isFinite(n) ? (n < 1e12 ? n * 1000 : n) : value);
  return Number.isFinite(date.getTime()) ? date : null;
}
function number(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value); return Number.isFinite(n) && n >= 0 ? n : null;
}
function percent(made, attempted) { return made === null || attempted === null || attempted <= 0 ? null : Math.round(100 * made / attempted); }
function sum(rows, key) {
  return rows.length && rows.every(p => p[key] !== null) ? rows.reduce((n, p) => n + p[key], 0) : null;
}
function parseTeam(id, club, rawPlayers) {
  const players = Object.entries(rawPlayers || {}).map(([playerId, p]) => ({
    events: decodeEvents(p),
    id: playerId, name: String(p.playername ?? p.playerName ?? p.name ?? playerId),
    position: normalizePosition(p.pos ?? p.position), rating: number(p.rating),
    goals: number(p.goals), assists: number(p.assists),
    passes: number(p.passesmade ?? p.passesMade), passAttempts: number(p.passattempts ?? p.passAttempts),
    tackles: number(p.tacklesmade ?? p.tacklesMade), tackleAttempts: number(p.tackleattempts ?? p.tackleAttempts),
    shots: number(p.shots), saves: number(p.saves ?? p.gkSaves),
    secondsPlayed: number(p.secondsPlayed ?? p.gameTime), motm: Number(p.man_of_the_match ?? p.mom) === 1,
  })).sort((a, b) => {
    const order = ['goalkeeper', 'defender', 'midfielder', 'forward', null];
    return order.indexOf(a.position) - order.indexOf(b.position) || a.name.localeCompare(b.name, 'de');
  });
  const ratings = players.map(p => p.rating).filter(n => n !== null);
  return {
    id: String(club.details?.clubId ?? club.clubId ?? id),
    name: String(club.details?.name ?? club.name ?? club.clubName ?? (String(id) === CLUB_ID ? 'Loco Squad' : 'Gegner')),
    goals: number(club.goals ?? club.score),
    winnerByDnf: Number(club.winnerByDnf) > 0,
    crestIds: [...new Set([club.TEAM, club.details?.customKit?.crestAssetId, club.details?.teamId].filter(v => /^\d+$/.test(String(v))).map(String))],
    players, shots: sum(players, 'shots'), passes: sum(players, 'passes'),
    passPercent: percent(sum(players, 'passes'), sum(players, 'passAttempts')),
    tacklePercent: percent(sum(players, 'tackles'), sum(players, 'tackleAttempts')),
    saves: sum(players, 'saves'), averageRating: ratings.length ? ratings.reduce((n, r) => n + r, 0) / ratings.length : null,
  };
}
function parseMatch(raw) {
  const id = String(raw?.matchId ?? raw?.match_id ?? raw?.id ?? '');
  const date = matchTime(raw);
  const entries = Object.entries(raw?.clubs || {});
  const own = entries.find(([key, c]) => String(c.details?.clubId ?? c.clubId ?? key) === CLUB_ID);
  const opponent = entries.find(entry => entry !== own);
  if (!id || !date || !own || !opponent || entries.length !== 2) return null;
  // 5 is EA's friendlyMatch type. Never accept a known league/playoff match.
  if (entries.some(([, c]) => c.matchType !== undefined && !['5', 'friendlyMatch'].includes(String(c.matchType)))) return null;
  const teams = [own, opponent].map(([key, c]) => parseTeam(key, c, raw.players?.[key]));
  if (teams.some(t => t.goals === null || !t.players.length)) return null;
  const seconds = teams.flatMap(t => t.players).map(p => p.secondsPlayed).filter(n => n !== null && n > 0);
  const durationSeconds = seconds.length ? Math.max(...seconds) : null;
  const termination = teams.some(t => t.winnerByDnf) ? 'dnf' : durationSeconds !== null && durationSeconds < 90 * 60 ? 'early' : null;
  return { id, timestamp: date.toISOString(), own: teams[0], opponent: teams[1],
    durationSeconds, termination, minutes: durationSeconds === null ? null : Math.round(durationSeconds / 60) };
}
function isPublishableMatch(match) {
  return Boolean(match && Number.isFinite(match.durationSeconds) && match.durationSeconds >= MIN_MATCH_SECONDS);
}
function candidates(rawMatches, now, posted = {}) {
  const result = new Map();
  for (const raw of rawMatches) {
    const match = parseMatch(raw);
    if (!isPublishableMatch(match) || posted[match.id]) continue;
    const date = new Date(match.timestamp);
    if (date > now || !isActive(date) || sessionKey(date) !== sessionKey(now)) continue;
    result.set(match.id, match);
  }
  return [...result.values()].sort((a, b) => a.timestamp.localeCompare(b.timestamp) || a.id.localeCompare(b.id));
}
module.exports = { MIN_MATCH_SECONDS, isPublishableMatch, CLUB_ID, CHANNEL_ID, PLATFORM, POLL_MS, POSITIONS, localParts, isActive, sessionKey, matchTime, number, percent, parseMatch, candidates };
