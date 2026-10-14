'use strict';
const { Client, Events } = require('discord.js');
const { createService } = require('./weekly-report/service');
module.exports = function installWeeklyReportHook() {
  if (Client.prototype.__weeklyReportHook) return;
  Client.prototype.__weeklyReportHook = true;
  const originalLogin = Client.prototype.login;
  Client.prototype.login = function (...args) {
    const client = this;
    client.once(Events.ClientReady, () => {
      const service = createService(client);
      const tick = () => service.tick().catch(e => console.error('[weekly-report] Prüfung fehlgeschlagen:', e.message));
      tick();
      const start = setTimeout(() => { tick(); const timer = setInterval(tick, 60000); timer.unref?.(); }, 60000 - Date.now() % 60000);
      start.unref?.();
      console.log('[weekly-report] Montag 07:30 Europe/Berlin · Spielstatistikkanal · Loco-Squad-Markierung aktiv.');
    });
    return originalLogin.apply(this, args);
  };
};
