'use strict';
const { isActive, localParts, POLL_MS, candidates, parseMatch, CLUB_ID, CHANNEL_ID, PLATFORM } = require('./model');
const { getFriendlyMatches } = require('../power-ranking/ea-client');
const store = require('./store');
const { buildPayload, LAYOUT_VERSION } = require('./renderer');
const previewRequest = require('./preview-request.json');
const { EmbedBuilder } = require('discord.js');
const { buildAnalysis } = require('./analysis');

// Discord history is also checked, covering a restart after send() but before the local save.
async function recoverPosted(channel, botId, now) {
  const posted = {};
  let before;
  const oldest = now.getTime() - 14 * 60 * 60 * 1000;
  for (let page = 0; page < 10; page++) {
    const messages = await channel.messages.fetch({ limit: 100, ...(before ? { before } : {}) });
    if (!messages.size) return posted;
    let oldestMessage = null;
    for (const message of messages.values()) {
      if (!oldestMessage || message.createdTimestamp < oldestMessage.createdTimestamp) oldestMessage = message;
      if (message.author?.id !== botId) continue;
      for (const embed of message.embeds || []) {
        const match = /^Friendly Match · (.+)$/.exec(embed.footer?.text || '');
        if (match) {
          const layout = (message.embeds || []).map(e => /^Friendly Layout · (\d+)$/.exec(e.footer?.text || '')).find(Boolean);
          posted[match[1]] = { messageId: message.id, postedAt: new Date(message.createdTimestamp).toISOString(), layoutVersion: Math.max(layout ? Number(layout[1]) : 1, (message.embeds || []).some(e => e.title === '🔎 Matchanalyse · Loco Squad') ? 4 : 1) };
        }
      }
    }
    if (messages.size < 100 || oldestMessage.createdTimestamp < oldest) return posted;
    before = oldestMessage.id;
  }
  throw new Error('Friendly-Match-Verlauf zu groß für einen sicheren Abgleich.');
}
function embedLength(embeds) {
  return embeds.reduce((sum, e) => sum + (e.title?.length || 0) + (e.description?.length || 0) + (e.footer?.text?.length || 0)
    + (e.author?.name?.length || 0) + (e.fields || []).reduce((n, f) => n + f.name.length + f.value.length, 0), 0);
}
async function backfillAnalysis(channel, botId, rawMatches, data, save) {
  let updated = 0;
  const available = new Map(rawMatches.map(parseMatch).filter(Boolean).map(m => [m.id, m]));
  for (const [id, entry] of Object.entries(data.posted)) {
    if ((entry.layoutVersion || 1) >= 4 || !available.has(id)) continue;
    try {
      const message = await channel.messages.fetch(entry.messageId);
      if (message.author?.id !== botId || !message.embeds?.some(e => e.footer?.text === `Friendly Match · ${id}`)) throw new Error('Nachricht stimmt nicht mit Bot und Match-ID überein.');
      const embeds = message.embeds.map(e => EmbedBuilder.from(e));
      if (!embeds.some(e => e.data.title === '🔎 Matchanalyse · Loco Squad')) {
        embeds.push(buildAnalysis(available.get(id)));
        if (embeds.length > 10 || embedLength(embeds.map(e => e.toJSON())) > 6000) throw new Error('Discord-Embed-Limit würde überschritten.');
        // Keep the original attachments and every existing statistic; append only the analysis.
        for (const e of embeds) if (/^Friendly Layout · \d+$/.test(e.data.footer?.text || '')) e.setFooter({ text: 'Friendly Layout · 4' });
        await message.edit({ embeds, allowedMentions: { parse: [] } });
        updated++;
        console.log(`[friendly-matches] Matchanalyse bei bestehendem Post ${id} ergänzt.`);
      }
      entry.layoutVersion = 4;
      save(data);
    } catch (error) {
      console.error(`[friendly-matches] Matchanalyse für ${id} konnte nicht nachgetragen werden:`, error.message);
    }
  }
  return updated;
}

function createService(client, options = {}) {
  const deps = {
    load: store.load, save: store.save, fetchMatches: getFriendlyMatches, buildPayload, previewRequest,
    getChannel: () => client.channels.fetch(CHANNEL_ID),
    recover: (channel, now) => recoverPosted(channel, client.user.id, now),
    ...options,
  };
  let running = false;
  let lastSlot = null;
  return {
    async tick(now = new Date()) {
      const p = localParts(now);
      // One last check at 04:00 captures the final games of the evening.
      const closing = Number(p.hour) === 4 && Number(p.minute) === 0;
      if ((!isActive(now) && !closing) || running) return;
      const slot = Math.floor(now.getTime() / POLL_MS);
      if (slot === lastSlot) return;
      lastSlot = slot;
      running = true;
      try {
        const data = deps.load();
        const channel = await deps.getChannel();
        if (!channel?.isTextBased() || typeof channel.send !== 'function') throw new Error(`Statistikkanal ${CHANNEL_ID} nicht erreichbar.`);
        const recovered = await deps.recover(channel, now);
        Object.assign(data.posted, recovered);
        const raw = await deps.fetchMatches(CLUB_ID, PLATFORM, 50);
        if (client.user?.id) await backfillAnalysis(channel, client.user.id, raw, data, deps.save);
        const matches = candidates(raw, now, data.posted);
        const refresh = deps.previewRequest;
        const existing = refresh && data.posted[refresh.matchId];
        if (refresh?.refreshLayoutVersion && existing && (existing.layoutVersion || 1) < refresh.refreshLayoutVersion
          && now.getTime() < new Date(refresh.expiresAt).getTime()) {
          const preview = raw.map(parseMatch).find(match => match?.id === refresh.matchId);
          if (preview) {
            const message = await channel.messages.fetch(existing.messageId);
            if (message.author?.id !== client.user.id) throw new Error('Vorschau-Nachricht gehört nicht diesem Bot.');
            await message.edit({ ...await deps.buildPayload(preview), attachments: [] });
            existing.layoutVersion = LAYOUT_VERSION;
            deps.save(data);
            console.log(`[friendly-matches] Vorschau ${preview.id} auf Layout ${existing.layoutVersion} aktualisiert.`);
          }
        }
        // A short-lived, explicitly requested preview may bypass the evening filter once.
        // It uses the normal match marker, so Discord recovery also prevents replay after redeploy.
        const request = deps.previewRequest;
        if (request && now.getTime() < new Date(request.expiresAt).getTime() && !data.posted[request.matchId]) {
          const preview = raw.map(parseMatch).find(match => match?.id === request.matchId);
          if (preview && new Date(preview.timestamp) <= now && !matches.some(match => match.id === preview.id)) {
            matches.push(preview);
            matches.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
          }
        }
        // Keep only the last 30 days of IDs; older matches are excluded by the session filter.
        for (const [id, entry] of Object.entries(data.posted)) {
          if (new Date(entry.postedAt).getTime() < now.getTime() - 30 * 86400000) delete data.posted[id];
        }
        deps.save(data);
        for (const match of matches) {
          const message = await channel.send(await deps.buildPayload(match));
          data.posted[match.id] = { messageId: message.id, postedAt: now.toISOString(), matchAt: match.timestamp, layoutVersion: LAYOUT_VERSION };
          deps.save(data);
          console.log(`[friendly-matches] ${match.id}: ${match.own.name} ${match.own.goals}:${match.opponent.goals} ${match.opponent.name} gepostet.`);
        }
        return matches.length;
      } finally { running = false; }
    },
  };
}
module.exports = { createService, recoverPosted, backfillAnalysis };
