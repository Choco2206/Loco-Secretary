'use strict';
const { isActive, localParts, POLL_MS, candidates, parseMatch, CLUB_ID, CHANNEL_ID, PLATFORM } = require('./model');
const { getFriendlyMatches } = require('../power-ranking/ea-client');
const store = require('./store');
const { buildPayload } = require('./renderer');
const previewRequest = require('./preview-request.json');

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
        if (match) posted[match[1]] = { messageId: message.id, postedAt: new Date(message.createdTimestamp).toISOString() };
      }
    }
    if (messages.size < 100 || oldestMessage.createdTimestamp < oldest) return posted;
    before = oldestMessage.id;
  }
  throw new Error('Friendly-Match-Verlauf zu groß für einen sicheren Abgleich.');
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
        const matches = candidates(raw, now, data.posted);
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
          data.posted[match.id] = { messageId: message.id, postedAt: now.toISOString(), matchAt: match.timestamp };
          deps.save(data);
          console.log(`[friendly-matches] ${match.id}: ${match.own.name} ${match.own.goals}:${match.opponent.goals} ${match.opponent.name} gepostet.`);
        }
        return matches.length;
      } finally { running = false; }
    },
  };
}
module.exports = { createService, recoverPosted };
