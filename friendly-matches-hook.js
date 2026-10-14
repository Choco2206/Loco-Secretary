'use strict';
const { Client, Events } = require('discord.js');
const { createService } = require('./friendly-matches/service');
module.exports = function installFriendlyMatchesHook() {
  if (Client.prototype.__friendlyMatchesHook) return;
  Client.prototype.__friendlyMatchesHook = true;
  const originalLogin = Client.prototype.login;
  Client.prototype.login = function (...args) {
    const client = this;
    client.once(Events.ClientReady, () => {
      const service = createService(client);
      const tick = () => service.tick().catch(error => console.error('[friendly-matches] Prüfung fehlgeschlagen:', error.message));
      tick();
      const timer = setInterval(tick, 60 * 1000);
      timer.unref?.();
      console.log('[friendly-matches] Club 18360 · Kanal 1559992305467916399 · täglich 20–04 Uhr Europe/Berlin · alle 10 Minuten.');
    });
    return originalLogin.apply(this, args);
  };
};
