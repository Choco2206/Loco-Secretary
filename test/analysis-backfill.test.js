'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const { backfillAnalysis, recoverPosted } = require('../friendly-matches/service');
const fixture = require('./fixtures/friendly-match.json');
const { EmbedBuilder } = require('discord.js');
function harness() {
  const data = { posted: { [fixture.matchId]: { messageId: 'msg', layoutVersion: 3 } } };
  let edits = 0; let saved = 0;
  const original = [new EmbedBuilder().setImage('https://example.org/existing-score.png').setFooter({ text: 'Friendly Layout · 3' }).toJSON(),
    new EmbedBuilder().setTitle('Existing statistics').setFooter({ text: `Friendly Match · ${fixture.matchId}` }).addFields({ name: 'Schüsse', value: '7 : 10' }).toJSON()];
  const message = { id: 'msg', author: { id: 'bot' }, createdTimestamp: Date.now(), embeds: structuredClone(original), edit: async p => {
    assert.equal(p.files, undefined); assert.equal(p.attachments, undefined);
    edits++; message.embeds = p.embeds.map(e => e.toJSON());
  } };
  const channel = { messages: { fetch: async () => message } };
  return { data, original, message, channel, save: () => saved++, get edits() { return edits; }, get saved() { return saved; } };
}
test('existing match post receives analysis once without replacement posts or lost images/statistics', async () => {
  const h = harness();
  assert.equal(await backfillAnalysis(h.channel, 'bot', [fixture], h.data, h.save), 1);
  assert.equal(h.edits, 1); assert.equal(h.message.embeds.length, 3);
  assert.equal(h.message.embeds[0].image.url, h.original[0].image.url);
  assert.deepEqual(h.message.embeds[1], h.original[1]);
  assert.equal(h.message.embeds[2].title, '🔎 Matchanalyse · Loco Squad');
  assert.equal(await backfillAnalysis(h.channel, 'bot', [fixture], h.data, h.save), 0);
  h.data.posted[fixture.matchId].layoutVersion = 3;
  await backfillAnalysis(h.channel, 'bot', [fixture], h.data, h.save); assert.equal(h.edits, 1);
});
test('unavailable API match, other author and mismatched match marker do not modify messages', async () => {
  const h = harness(); await backfillAnalysis(h.channel, 'bot', [], h.data, h.save); assert.equal(h.edits, 0);
  h.message.author.id = 'other'; await backfillAnalysis(h.channel, 'bot', [fixture], h.data, h.save); assert.equal(h.edits, 0);
  h.message.author.id = 'bot'; h.message.embeds[1].footer.text = 'Friendly Match · different';
  await backfillAnalysis(h.channel, 'bot', [fixture], h.data, h.save); assert.equal(h.edits, 0);
});
test('failed edit stays pending for the next check', async () => {
  const h = harness(); const edit = h.message.edit; h.message.edit = async () => { throw new Error('Discord offline'); };
  await backfillAnalysis(h.channel, 'bot', [fixture], h.data, h.save); assert.equal(h.data.posted[fixture.matchId].layoutVersion, 3);
  h.message.edit = edit; await backfillAnalysis(h.channel, 'bot', [fixture], h.data, h.save); assert.equal(h.edits, 1);
});
