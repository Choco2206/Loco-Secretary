'use strict';
const crypto = require('crypto');
const { CLUB_ID, PLATFORM, POLL_MS, isActive, localParts } = require('../friendly-matches/model');
const { getFriendlyMatches } = require('../power-ranking/ea-client');
const rankingStore = require('../power-ranking/store');
const store = require('./store');
const { ingest } = require('./model');
const { marker, payload } = require('./embed');
const CHANNEL_ID = '1560060808799723601';
const ROLE_ID = '1426495393742454834';
async function members(guild) {
  const result = new Map(); let after;
  for (let page = 0; page < 100; page++) {
    const batch = await guild.members.list({ limit: 1000, ...(after ? { after } : {}) });
    for (const member of batch.values()) result.set(member.id, member);
    if (batch.size < 1000) return [...result.values()].filter(m => !m.user.bot && m.roles.cache.has(ROLE_ID));
    const next = batch.last().id;
    if (next === after) throw new Error('Mitgliederliste konnte nicht vollständig gelesen werden.');
    after = next;
  }
  throw new Error('Mitgliederliste zu groß.');
}
async function recover(channel, botId) {
  const result = new Map(); let before;
  for (let page = 0; page < 100; page++) {
    const batch = await channel.messages.fetch({ limit: 100, ...(before ? { before } : {}) });
    for (const msg of batch.values()) {
      if (msg.author?.id !== botId) continue;
      const id = /^Spieler-Formkurve · (\d+)$/.exec(msg.embeds?.[0]?.footer?.text || '')?.[1];
      if (id && !result.has(id)) result.set(id, msg);
    }
    if (batch.size < 100) return result;
    before = batch.last().id;
  }
  throw new Error('Formkurven-Kanalverlauf zu groß für einen sicheren Abgleich.');
}
function fingerprint(p) { return crypto.createHash('sha256').update(JSON.stringify(p.embeds.map(e => e.toJSON()))).digest('hex'); }
function createService(client, options = {}) {
  const deps = { load: store.load, save: store.save, ranking: rankingStore.load,
    fetchMatches: getFriendlyMatches, getChannel: () => client.channels.fetch(CHANNEL_ID),
    members, recover, buildPayload: payload, ...options };
  let running = false; let lastSlot;
  return { async tick(now = new Date()) {
    const slot = Math.floor(now.getTime() / POLL_MS);
    if (running || lastSlot === slot) return;
    lastSlot = slot; running = true;
    try {
      const data = deps.load();
      const parts = localParts(now);
      if (isActive(now) || (Number(parts.hour) === 4 && Number(parts.minute) === 0)) {
        try { ingest(data, await deps.fetchMatches(CLUB_ID, PLATFORM, 50), now); deps.save(data); }
        catch (error) { console.error('[player-form] EA-Abfrage fehlgeschlagen, bestehende Werte bleiben erhalten:', error.message); }
      }
      const channel = await deps.getChannel();
      if (!channel?.isTextBased() || !channel.guild || typeof channel.send !== 'function') throw new Error('Spieler-Formkurven-Kanal nicht erreichbar.');
      const roster = (await deps.members(channel.guild)).sort((a, b) => a.displayName.localeCompare(b.displayName, 'de'));
      const recovered = await deps.recover(channel, client.user.id);
      const links = deps.ranking().links || {};
      // Reject duplicate account assignments instead of giving two people the same statistics.
      const ids = new Map(); const names = new Map();
      for (const member of roster) {
        const link = links[member.id]; if (!link) continue;
        if (link.playerId) { const key = String(link.playerId); ids.set(key, (ids.get(key) || 0) + 1); }
        if (link.playerName) { const key = require('./model').normalizeName(link.playerName); names.set(key, (names.get(key) || 0) + 1); }
      }
      for (const member of roster) {
        let link = links[member.id];
        if (link && ((link.playerId && ids.get(String(link.playerId)) > 1) || (!link.playerId && names.get(require('./model').normalizeName(link.playerName)) > 1))) link = null;
        const p = deps.buildPayload(member, link, data); const hash = fingerprint(p);
        let message = recovered.get(member.id);
        const stored = data.messages[member.id];
        if (!message && stored?.id) {
          try { message = await channel.messages.fetch(stored.id); }
          catch (error) { if (error.code !== 10008) throw error; }
          if (message && (message.author?.id !== client.user.id || message.embeds?.[0]?.footer?.text !== marker(member.id))) throw new Error('Gespeicherter Embed kann nicht sicher zugeordnet werden.');
        }
        if (!message) {
          message = await channel.send(p);
        } else if (stored?.hash !== hash || stored?.id !== message.id) {
          await message.edit(p);
        }
        data.messages[member.id] = { id: message.id, hash };
        deps.save(data);
      }
      // Only remove this feature's own cards after a complete, successful roster read.
      const eligible = new Set(roster.map(m => m.id));
      for (const [id, message] of recovered) {
        if (!eligible.has(id)) {
          await message.delete(); delete data.messages[id]; deps.save(data);
        }
      }
      console.log(`[player-form] ${roster.length} Spieler-Embeds geprüft · ${Object.keys(data.matches).length} Friendly Matches gespeichert.`);
    } finally { running = false; }
  } };
}
module.exports = { CHANNEL_ID, ROLE_ID, members, recover, createService, fingerprint };
