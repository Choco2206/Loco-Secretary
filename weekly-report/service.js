'use strict';
const { CHANNEL_ID, CLUB_ID, PLATFORM, isActive, POLL_MS } = require('../friendly-matches/model');
const { getFriendlyMatches } = require('../power-ranking/ea-client');
const store = require('./store');
const { FIRST_WEEK, dueWeeks, boundary, addDays, ingest } = require('./model');
const { marker, payload } = require('./report');
async function recoverReport(channel, botId, key) {
  let before; const earliest = boundary(addDays(key, 7));
  for (let page = 0; page < 100; page++) {
    const batch = await channel.messages.fetch({ limit: 100, ...(before ? { before } : {}) });
    let oldest;
    for (const msg of batch.values()) {
      if (oldest === undefined || msg.createdTimestamp < oldest) oldest = msg.createdTimestamp;
      if (msg.author?.id === botId && msg.embeds?.some(e => e.footer?.text === marker(key))) return msg;
    }
    if (batch.size < 100 || oldest < earliest) return null;
    before = batch.last().id;
  }
  throw new Error('Wochenbericht-Verlauf konnte nicht sicher abgeglichen werden.');
}
async function seedFromPosts(channel, botId) {
  let before; const found = {}; const earliest = boundary(FIRST_WEEK);
  for (let page = 0; page < 100; page++) {
    const batch = await channel.messages.fetch({ limit: 100, ...(before ? { before } : {}) });
    let oldest;
    for (const msg of batch.values()) {
      if (oldest === undefined || msg.createdTimestamp < oldest) oldest = msg.createdTimestamp;
      if (msg.author?.id !== botId) continue;
      const summary = msg.embeds?.find(e => /^Friendly Match · (.+)$/.test(e.footer?.text || ''));
      if (!summary) continue;
      const id = /^Friendly Match · (.+)$/.exec(summary.footer.text)[1];
      const score = /^Loco Squad\s+(\d+)\s*:\s*(\d+)\s+(.+)$/.exec(summary.title || '');
      const timestamp = new Date(summary.timestamp);
      if (!score || !Number.isFinite(timestamp.getTime()) || timestamp.getTime() < earliest) continue;
      const minutes = /Spieldauer(?: ca\.)?\s+(\d+)′/.exec(summary.description || '');
      const duration = minutes ? Number(minutes[1]) : null;
      const early = /Vorzeitig beendet|Abbruch von EA/.test(summary.description || '');
      found[id] = { id, timestamp: timestamp.toISOString(), ownGoals: Number(score[1]), opponentGoals: Number(score[2]), opponentName: score[3], minutes: duration,
        termination: early ? 'early' : null, regular: !early && duration !== null && duration >= 90, source: 'existing_match_post' };
    }
    if (batch.size < 100 || oldest < earliest) return found;
    before = batch.last().id;
  }
  throw new Error('Vorhandene Matchposts konnten nicht vollständig gelesen werden.');
}
function createService(client, options = {}) {
  const deps = { load: store.load, save: store.save, fetchMatches: getFriendlyMatches,
    getChannel: () => client.channels.fetch(CHANNEL_ID), recover: (c, k) => recoverReport(c, client.user.id, k), buildPayload: payload, ...options };
  let running = false; let seeded = false; let historySeeded = false; let lastDaySlot;
  return { async tick(now = new Date()) {
    if (running) return;
    running = true;
    try {
      let data = deps.load();
      if (!historySeeded && client.user?.id) {
        try {
          const existing = await seedFromPosts(await deps.getChannel(), client.user.id);
          data = deps.load();
          for (const [id, match] of Object.entries(existing)) if (!data.matches[id]) data.matches[id] = match;
          deps.save(data); historySeeded = true;
        } catch (error) { console.error('[weekly-report] Rückerfassung bestehender Posts fehlgeschlagen:', error.message); }
      }
      const due = dueWeeks(now, data.reports);
      const slot = Math.floor(now.getTime() / POLL_MS);
      // During the nightly window the existing match feed archives its responses.
      // Outside it, capture every ten minutes so daytime Friendly Matches also count.
      if (!seeded || due.length || (!isActive(now) && lastDaySlot !== slot)) {
        seeded = true; lastDaySlot = slot;
        try {
          const raw = await deps.fetchMatches(CLUB_ID, PLATFORM, 50);
          // Reload after the await: the match feed may have saved more games in the meantime.
          data = deps.load(); ingest(data, raw, now); deps.save(data);
        } catch (error) { console.error('[weekly-report] EA-Abfrage fehlgeschlagen, gespeicherte Spiele bleiben verfügbar:', error.message); }
      }
      if (!due.length) return;
      const channel = await deps.getChannel();
      if (!channel?.isTextBased() || typeof channel.send !== 'function') throw new Error('Spielstatistikkanal für Wochenbericht nicht erreichbar.');
      for (const key of due) {
        data = deps.load();
        if (data.reports[key]) continue;
        let message = await deps.recover(channel, key);
        if (!message) message = await channel.send(deps.buildPayload(data, key));
        // Preserve matches recorded while Discord send/history requests were in flight.
        data = deps.load(); data.reports[key] = { messageId: message.id, postedAt: now.toISOString() }; deps.save(data);
        console.log(`[weekly-report] Woche ${key} veröffentlicht/abgeglichen: ${message.id}`);
      }
    } finally { running = false; }
  } };
}
module.exports = { createService, recoverReport, seedFromPosts };
