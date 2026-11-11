'use strict';
const { Client, Events } = require('discord.js');
const { createService } = require('./friendly-matches/service');
const { createStore } = require('./friendly-matches/store');
const LOCOLINHO = { clubId: '492736', clubName: 'Locolinho', channelId: '1570161388481945661' };
module.exports = function installFriendlyMatchesHook() {
  if (Client.prototype.__friendlyMatchesHook) return;
  Client.prototype.__friendlyMatchesHook = true;
  const originalLogin = Client.prototype.login;
  Client.prototype.login = function (...args) {
    const client = this;
    client.once(Events.ClientReady, () => {
      const services = [
        ['Loco Squad', createService(client, { onMatches: require('./weekly-report/store').recordMatches })],
        [LOCOLINHO.clubName, createService(client, {
          ...createStore('friendlyMatchesLocolinho.json'),
          club: LOCOLINHO,
          repairMatches: [],
          previewRequest: null,
        })],
      ];
      for (const [name, service] of services) {
        const tick = () => service.tick().catch(error => console.error(`[friendly-matches] ${name}: Prüfung fehlgeschlagen:`, error.message));
        tick();
        const timer = setInterval(tick, 60 * 1000);
        timer.unref?.();
        console.log(`[friendly-matches] ${name} · täglich 20–04 Uhr Europe/Berlin · alle 10 Minuten.`);
      }
    });
    return originalLogin.apply(this, args);
  };
};
