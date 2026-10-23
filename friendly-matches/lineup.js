'use strict';
const { localParts, POSITIONS } = require('./model');
const CHANNELS = ['1544644644179152956', '1544644649354797087'];
const GROUPS = { TW: 'goalkeeper', LIV: 'defender', ZIV: 'defender', RIV: 'defender', LZDM: 'midfielder', RZDM: 'midfielder', ZOM: 'midfielder', LM: 'midfielder', RM: 'midfielder', LS: 'forward', RS: 'forward' };
function positionLabel(player) { return player.lineupPosition || POSITIONS[player.position] || '?'; }
function parseSnapshot(message) {
  if (!message.author?.bot) return null;
  const embed = (message.embeds || []).find(e => /^Loco Lineup · v1 · [a-z]+$/.test(e.footer?.text || ''));
  if (!embed) return null;
  const date = /Datum: (\d{2})\.(\d{2})\.(\d{4})/.exec(embed.description || '');
  const start = /Start: (\d{2}):(\d{2})/.exec(embed.description || '');
  const published = new Date(embed.timestamp).getTime();
  if (!date || !start || !Number.isFinite(published) || +start[1] > 23 || +start[2] > 59) return null;
  const day = `${date[3]}-${date[2]}-${date[1]}`;
  const positions = {};
  for (const f of embed.fields || []) {
    const user = /^<@!?(\d+)>$/.exec(f.value || '');
    if (!GROUPS[f.name] || !user || positions[user[1]]) return null;
    positions[user[1]] = f.name;
  }
  return { day, start: +start[1] * 60 + +start[2], published, positions, messageId: message.id };
}
function resolveLineup(match, snapshots, links) {
  const p = localParts(new Date(match.timestamp));
  const localDay = `${p.year}-${p.month}-${p.day}`;
  const matchMinute = +p.hour * 60 + +p.minute;
  const dayNumber = s => Date.parse(`${s}T12:00:00Z`) / 86400000;
  const byId = new Map();
  for (const [discordId, link] of Object.entries(links || {})) {
    if (!link.playerId) continue;
    const key = String(link.playerId);
    byId.set(key, byId.has(key) ? null : discordId);
  }
  const eligible = snapshots.filter(s => {
    const delta = (dayNumber(localDay) - dayNumber(s.day)) * 1440 + matchMinute - s.start;
    return s.published <= Date.parse(match.timestamp) && delta >= 0 && delta <= 8 * 60;
  }).map(s => ({ ...s, overlap: match.own.players.filter(p => s.positions[byId.get(p.id)]).length }))
    .filter(s => s.overlap >= 3).sort((a, b) => b.published - a.published);
  const chosen = eligible[0];
  for (const player of match.own.players) {
    delete player.lineupPosition;
    const pos = chosen?.positions[byId.get(player.id)];
    // Contradictory EA position groups indicate a substitution or changed lineup.
    if (pos && GROUPS[pos] === player.position) player.lineupPosition = pos;
  }
  match.lineupSource = chosen?.messageId || null;
  return match;
}
function createLineupResolver(client, loadLinks = () => require('../power-ranking/store').load().links) {
  let cache = null; let at = 0;
  return async match => {
    try {
      if (!cache || Date.now() - at > 60000) {
        const rows = [];
        for (const id of CHANNELS) {
          const channel = await client.channels.fetch(id);
          if (!channel?.messages?.fetch) throw new Error(`Aufstellungskanal ${id} nicht lesbar`);
          let before;
          for (let page = 0; page < 3; page++) {
            const messages = await channel.messages.fetch({ limit: 100, ...(before ? { before } : {}) });
            for (const message of messages.values()) { const row = parseSnapshot(message); if (row) rows.push(row); }
            if (messages.size < 100) break;
            before = [...messages.values()].at(-1).id;
          }
        }
        cache = rows; at = Date.now();
      }
      return resolveLineup(match, cache, loadLinks());
    } catch (error) {
      console.error('[friendly-matches] Positionsabgleich nicht verfügbar:', error.message);
      return match;
    }
  };
}
module.exports = { positionLabel, parseSnapshot, resolveLineup, createLineupResolver };
