'use strict';
const { Client, Events } = require('discord.js');
const { createService } = require('./player-form/service');
module.exports = function installPlayerFormHook() {
  if (Client.prototype.__playerFormHook) return;
  Client.prototype.__playerFormHook = true;
  const originalLogin = Client.prototype.login;
  Client.prototype.login = function (...args) {
    const client = this;
    client.once(Events.ClientReady, () => {
      const service = createService(client);
      const tick = () => service.tick().catch(e => console.error('[player-form] Aktualisierung fehlgeschlagen:', e.message));
      tick(); const timer = setInterval(tick, 60 * 1000); timer.unref?.();
      console.log('[player-form] Kanal 1560060808799723601 · Loco-Rolle 1426495393742454834 · automatische Spieler-Formkurven aktiv.');
    });
    return originalLogin.apply(this, args);
  };
};
