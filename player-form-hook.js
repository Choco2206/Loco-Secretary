'use strict';
const { Client, Events } = require('discord.js');
const { createService } = require('./player-form/service');
const { createStore } = require('./player-form/store');
const { locolinho } = require('./power-ranking/store');
const services = new WeakMap();
module.exports = function installPlayerFormHook() {
  if (Client.prototype.__playerFormHook) return;
  Client.prototype.__playerFormHook = true;
  const originalLogin = Client.prototype.login;
  Client.prototype.login = function (...args) {
    const client = this;
    client.once(Events.ClientReady, () => {
      const clubServices = new Map([
        ['Loco Squad', createService(client)],
        ['Locolinho', createService(client, {
          ...createStore('playerFormLocolinho.json'),
          ranking: locolinho.load,
          clubId: locolinho.defaults().club.clubId,
          channelId: '1570488623860547725',
          roleId: '1570482104788197409',
          rankingChannel: '1570488814567428106',
        })],
      ]);
      services.set(client, clubServices);
      for (const [clubName, service] of clubServices) {
        const tick = () => service.tick().catch(error => console.error(`[player-form] ${clubName}:`, error.message));
        tick();
        const timer = setInterval(tick, 60 * 1000);
        timer.unref?.();
      }
    });
    return originalLogin.apply(this, args);
  };
};

module.exports.refresh = async function refreshPlayerForms(client, clubName = 'Loco Squad') {
  const service = services.get(client)?.get(clubName);
  if (!service) throw new Error('Die Spieler-Formkurve ist noch nicht gestartet.');
  return service.refresh();
};
