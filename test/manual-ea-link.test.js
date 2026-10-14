'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const { adminButtons, manualEaModal, resolveManualProfile, assignManualProfile, handleInteraction } = require('../power-ranking-hook')._test;

test('admin panel has manual assignment button within Discord row limits', () => {
  const rows = adminButtons(false).map(r => r.toJSON());
  assert.ok(rows.every(r => r.components.length <= 5));
  assert.ok(rows.flatMap(r => r.components).some(b => b.custom_id === 'pr_admin_link'));
  const modal = manualEaModal('123').toJSON(); assert.equal(modal.custom_id, 'pr_admin_link_modal:123');
});
test('exact EA name resolves ID when available, numeric ID works, missing and ambiguous inputs fail', () => {
  const members = [{ playerName: 'Choco2206' }]; const recent = [{ playerName: 'Choco2206', playerId: '42' }];
  assert.equal(resolveManualProfile(' choco2206 ', members, recent).playerId, '42');
  assert.equal(resolveManualProfile('42', members, recent).playerId, '42');
  assert.equal(resolveManualProfile('Choco2206', members, []).playerId, null);
  assert.throws(() => resolveManualProfile('wrong', members, recent), /nicht gefunden/);
  assert.throws(() => resolveManualProfile('Choco2206', members, [...recent, { playerName: 'Choco2206', playerId: '43' }]), /nicht eindeutig/);
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
  for (const [id, kind] of [['pr_admin_link', 'button'], ['pr_admin_link_user', 'select'], ['pr_admin_link_modal:123', 'modal']]) {
    let reply;
    await handleInteraction({ customId: id, user: { id: 'unprivileged' }, memberPermissions: { has: () => false },
      isButton: () => kind === 'button', isUserSelectMenu: () => kind === 'select', isModalSubmit: () => kind === 'modal',
      reply: async p => { reply = p; } }, {});
    assert.match(reply.content, /Teamleitung/);
  }
});
