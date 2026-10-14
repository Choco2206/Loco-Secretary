'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const { adminButtons, adminPlayerSelectionPayload, assignManualProfile, handleInteraction } = require('../power-ranking-hook')._test;

test('admin panel has manual assignment button within Discord row limits', () => {
  const rows = adminButtons(false).map(r => r.toJSON());
  assert.ok(rows.every(r => r.components.length <= 5));
  assert.ok(rows.flatMap(r => r.components).some(b => b.custom_id === 'pr_admin_link'));
  const p = adminPlayerSelectionPayload({ players: [{ playerName: 'Choco2206', playerId: '42' }], page: 0, targetId: '123', clubId: '18360', clubName: 'Loco Squad' });
  assert.equal(p.components[0].toJSON().components[0].custom_id, 'pr_admin_player_select');
});
test('club roster selection paginates all members without requiring typed names', () => {
  const players = Array.from({ length: 53 }, (_, i) => ({ playerName: `EA-${i}`, playerId: String(i) }));
  const p = adminPlayerSelectionPayload({ players, page: 2, targetId: '123', clubId: '18360', clubName: 'Loco Squad' });
  const select = p.components[0].toJSON().components[0];
  assert.equal(select.options.length, 13); assert.equal(select.options[0].value, '40');
  assert.equal(p.components[1].toJSON().components[0].custom_id, 'pr_admin_player_previous');
  assert.match(p.content, /18360/); assert.match(p.content, /123/);
});
test('assignment replaces selected account only, records admin and blocks account collisions including old club links', () => {
  const data = { club: { clubId: '18360' }, links: { target: { playerName: 'old', playerId: '1' }, other: { playerName: 'taken', playerId: '99', clubId: '46978' } } };
  assert.throws(() => assignManualProfile(data, 'target', { playerName: 'new', playerId: '99' }, 'admin', '18360'), /bereits/);
  assert.throws(() => assignManualProfile(data, 'target', { playerName: 'TAKEN', playerId: null }, 'admin', '18360'), /bereits/);
  assert.equal(data.links.target.playerName, 'old');
  assignManualProfile(data, 'target', { playerName: 'Choco2206', playerId: '42' }, 'admin', '18360');
  assert.equal(data.links.target.playerId, '42'); assert.equal(data.links.target.linkedBy, 'admin'); assert.equal(data.links.target.clubId, '18360');
  assert.throws(() => assignManualProfile(data, 'target', { playerName: 'new', playerId: '44' }, 'admin', 'old-club'), /geändert/);
});
test('permission checks protect button, user select and modal without reading or writing data', async () => {
  for (const [id, kind] of [['pr_admin_link', 'button'], ['pr_admin_link_user', 'select'], ['pr_admin_player_select', 'string']]) {
    let reply;
    await handleInteraction({ customId: id, user: { id: 'unprivileged' }, memberPermissions: { has: () => false },
      isButton: () => kind === 'button', isUserSelectMenu: () => kind === 'select', isModalSubmit: () => false, isStringSelectMenu: () => kind === 'string',
      reply: async p => { reply = p; } }, {});
    assert.match(reply.content, /Teamleitung/);
  }
});
