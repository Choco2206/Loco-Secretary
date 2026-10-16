'use strict';
const { isActive, localParts, POLL_MS, candidates, parseMatch, CLUB_ID, CHANNEL_ID, PLATFORM } = require('./model');
const { getFriendlyMatches } = require('../power-ranking/ea-client');
const store = require('./store');
const { buildPayload, LAYOUT_VERSION } = require('./renderer');
const previewRequest = require('./preview-request.json');
const { EmbedBuilder } = require('discord.js');
const { buildAnalysis, ANALYSIS_VERSION } = require('./analysis');

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
          posted[match[1]] = { messageId: message.id, postedAt: new Date(message.createdTimestamp).toISOString(), layoutVersion: Math.max(layout ? Number(layout[1]) : 1, (message.embeds || []).some(e => e.title === '🔎 Matchanalyse · Loco Squad') ? 4 : 1), analysisPresent: (message.embeds || []).some(e => e.title === '🔎 Matchanalyse · Loco Squad'), analysisVersion: Number(/^Analyse v(\d+)/.exec((message.embeds || []).find(e => e.title === '🔎 Matchanalyse · Loco Squad')?.footer?.text || '')?.[1] || 1) };
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
function restoreAttachmentReferences(message, embeds) {
  const attachments = [...(message.attachments?.values() || [])];
  const byName = new Map();
  for (const attachment of attachments) if (!byName.has(attachment.name)) byName.set(attachment.name, attachment);
  for (const embed of embeds) {
    for (const key of ['image', 'thumbnail']) {
      const url = embed.data[key]?.url;
      if (!url || url.startsWith('attachment://')) continue;
      const exact = attachments.find(a => a.url === url || a.proxyURL === url);
      let filename;
      try { filename = decodeURIComponent(new URL(url).pathname.split('/').pop()); } catch { continue; }
      const attachment = exact || byName.get(filename);
      if (!attachment) continue;
      // Reconnect the embedded image to the uploaded file instead of displaying it as a separate gallery.
      const reference = `attachment://${attachment.name}`;
      if (key === 'image') embed.setImage(reference); else embed.setThumbnail(reference);
      byName.set(attachment.name, attachment);
    }
  }
  // Retain the existing uploads, choosing one ID per filename; no second upload is required.
  return [...byName.values()].map(a => ({ id: a.id, filename: a.name }));
}
async function backfillAnalysis(channel, botId, rawMatches, data, save) {
  let updated = 0;
  const available = new Map(rawMatches.map(parseMatch).filter(Boolean).map(m => [m.id, m]));
  for (const [id, entry] of Object.entries(data.posted)) {
    if ((entry.layoutVersion || 1) >= 5 && entry.analysisPresent && ((entry.analysisVersion || 1) >= ANALYSIS_VERSION || !available.has(id))) continue;
    try {
      const message = await channel.messages.fetch(entry.messageId);
      if (message.author?.id !== botId || !message.embeds?.some(e => e.footer?.text === `Friendly Match · ${id}`)) throw new Error('Nachricht stimmt nicht mit Bot und Match-ID überein.');
      const before = message.embeds.map(e => typeof e.toJSON === 'function' ? e.toJSON() : e);
      const embeds = before.map(e => EmbedBuilder.from(e));
      const analysisIndex = embeds.findIndex(e => e.data.title === '🔎 Matchanalyse · Loco Squad');
      if (available.has(id) && (analysisIndex < 0 || (entry.analysisVersion || 1) < ANALYSIS_VERSION)) {
        const others = embeds.filter((_, index) => index !== analysisIndex);
        const analysis = buildAnalysis(available.get(id), Math.max(500, 6000 - embedLength(others.map(e => e.toJSON()))));
        if (analysisIndex < 0) embeds.push(analysis); else embeds[analysisIndex] = analysis;
      }
      const attachments = restoreAttachmentReferences(message, embeds);
      if (embeds.length > 10 || embedLength(embeds.map(e => e.toJSON())) > 6000) throw new Error('Discord-Embed-Limit würde überschritten.');
      for (const e of embeds) if (/^Friendly Layout · \d+$/.test(e.data.footer?.text || '')) e.setFooter({ text: 'Friendly Layout · 5' });
      if (JSON.stringify(before) !== JSON.stringify(embeds.map(e => e.toJSON()))) {
        await message.edit({ embeds, ...(message.attachments ? { attachments } : {}), allowedMentions: { parse: [] } });
        updated++;
        console.log(`[friendly-matches] Bestehender Post ${id}: Bildverweise repariert und verfügbare Matchanalyse ergänzt.`);
      }
      entry.layoutVersion = 5;
      entry.analysisPresent = embeds.some(e => e.data.title === '🔎 Matchanalyse · Loco Squad');
      entry.analysisVersion = Number(/^Analyse v(\d+)/.exec(embeds.find(e => e.data.title === '🔎 Matchanalyse · Loco Squad')?.data.footer?.text || '')?.[1] || 1);
      save(data);
    } catch (error) {
      console.error(`[friendly-matches] Post ${id} konnte nicht nachgepflegt werden:`, error.message);
    }
  }
  return updated;
}

function createService(client, options = {}) {
  const deps = {
    load: store.load, save: store.save, fetchMatches: getFriendlyMatches, buildPayload, previewRequest, onMatches: () => {},
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
        if (client.user?.id) await backfillAnalysis(channel, client.user.id, [], data, deps.save);
        const raw = await deps.fetchMatches(CLUB_ID, PLATFORM, 50);
        await deps.onMatches(raw, now);
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
          data.posted[match.id] = { messageId: message.id, postedAt: now.toISOString(), matchAt: match.timestamp, layoutVersion: LAYOUT_VERSION, analysisPresent: true, analysisVersion: ANALYSIS_VERSION };
          deps.save(data);
          console.log(`[friendly-matches] ${match.id}: ${match.own.name} ${match.own.goals}:${match.opponent.goals} ${match.opponent.name} gepostet.`);
        }
        return matches.length;
      } finally { running = false; }
    },
  };
}
module.exports = { createService, recoverPosted, backfillAnalysis, restoreAttachmentReferences };
