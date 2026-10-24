'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const { backfillAnalysis, recoverPosted } = require('../friendly-matches/service');
const fixture = require('./fixtures/friendly-match.json');
const { EmbedBuilder } = require('discord.js');
function harness() {
  const data = { posted: { [fixture.matchId]: { messageId: 'msg', layoutVersion: 3, imageRepairVersion: 1 } } };
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
test('image layout repair also works without EA; other author or mismatched marker is untouched', async () => {
  const h = harness(); await backfillAnalysis(h.channel, 'bot', [], h.data, h.save); assert.equal(h.edits, 1);
  assert.equal(h.message.embeds.length, 2);
  const untouched = h.edits;
  h.message.author.id = 'other'; await backfillAnalysis(h.channel, 'bot', [fixture], h.data, h.save); assert.equal(h.edits, untouched);
  h.message.author.id = 'bot'; h.message.embeds[1].footer.text = 'Friendly Match · different';
  await backfillAnalysis(h.channel, 'bot', [fixture], h.data, h.save); assert.equal(h.edits, untouched);
});
test('failed edit stays pending for the next check', async () => {
  const h = harness(); const edit = h.message.edit; h.message.edit = async () => { throw new Error('Discord offline'); };
  await backfillAnalysis(h.channel, 'bot', [fixture], h.data, h.save); assert.equal(h.data.posted[fixture.matchId].layoutVersion, 3);
  h.message.edit = edit; await backfillAnalysis(h.channel, 'bot', [fixture], h.data, h.save); assert.equal(h.edits, 1);
});

test('all three original images are re-uploaded into embeds without EA history or a duplicate gallery', async () => {
  const h = harness(); h.data.posted[fixture.matchId].layoutVersion = 4;
  const filenames = ['ergebnis.png', 'loco-squad.png', 'gegner.png'];
  const attachments = filenames.map((name, i) => ({ id: String(i + 1), name, url: `https://cdn.discordapp.com/attachments/1/2/${name}?ex=abc`, proxyURL: `https://media.discordapp.net/attachments/1/2/${name}?ex=abc` }));
  h.message.attachments = new Map(attachments.map(a => [a.id, a]));
  h.message.embeds = [new EmbedBuilder().setImage(attachments[0].url).setFooter({ text: 'Friendly Layout · 4' }).toJSON(),
    new EmbedBuilder().setTitle('Statistics').setFooter({ text: `Friendly Match · ${fixture.matchId}` }).toJSON(),
    new EmbedBuilder().setImage(attachments[1].proxyURL).toJSON(), new EmbedBuilder().setImage(attachments[2].url).toJSON(),
    new EmbedBuilder().setTitle('🔎 Matchanalyse · Loco Squad').addFields({ name: 'Existing analysis', value: 'Keep this text' }).toJSON()];
  let edits = 0;
  h.message.edit = async p => {
    assert.deepEqual(p.files.map(f => f.name), filenames);
    assert.deepEqual(p.files.map(f => f.attachment), attachments.map(a => a.url));
    assert.deepEqual(p.attachments, []);
    assert.equal(p.embeds[0].data.image.url, 'attachment://ergebnis.png');
    assert.equal(p.embeds[2].data.image.url, 'attachment://loco-squad.png');
    assert.equal(p.embeds[3].data.image.url, 'attachment://gegner.png');
    assert.equal(p.embeds[4].data.fields[0].value, 'Keep this text');
    edits++; h.message.embeds = p.embeds.map(e => e.toJSON());
  };
  await backfillAnalysis(h.channel, 'bot', [], h.data, h.save);
  assert.equal(edits, 1);
  await backfillAnalysis(h.channel, 'bot', [], h.data, h.save);
  assert.equal(edits, 1);
});

test('old analysis is replaced in place with comparative analysis while preserving statistic and attachment slots', async () => {
  const h = harness();
  h.data.posted[fixture.matchId] = { messageId: 'msg', layoutVersion: 5, imageRepairVersion: 1, analysisPresent: true, analysisVersion: 1 };
  h.message.embeds[0].footer.text = 'Friendly Layout · 5';
  h.message.embeds.push(new EmbedBuilder().setTitle('🔎 Matchanalyse · Loco Squad').addFields({ name: 'Old analysis', value: 'Old single-team text' }).toJSON());
  await backfillAnalysis(h.channel, 'bot', [fixture], h.data, h.save);
  assert.equal(h.edits, 1); assert.equal(h.message.embeds.length, 3);
  assert.deepEqual(h.message.embeds[1], h.original[1]);
  assert.match(h.message.embeds[2].footer.text, /Analyse v5/);
  assert.match(h.message.embeds[2].fields[0].value, /Mittelfeld Loco/);
  await backfillAnalysis(h.channel, 'bot', [fixture], h.data, h.save); assert.equal(h.edits, 1);
});

function withDuration(seconds) {
  const raw = structuredClone(fixture);
  for (const players of Object.values(raw.players)) for (const p of Object.values(players)) {
    delete p.gameTime; p.secondsPlayed = seconds;
  }
  return raw;
}
test('short old posts are removed once even with current analysis/layout; marker prevents replay', async () => {
  const h = harness(); let deletes = 0;
  Object.assign(h.data.posted[fixture.matchId], { layoutVersion: 5, analysisPresent: true, analysisVersion: 2, durationPolicyVersion: 1 });
  h.message.delete = async () => { deletes++; };
  await backfillAnalysis(h.channel, 'bot', [withDuration(2999)], h.data, h.save);
  assert.equal(deletes, 1); assert.equal(h.edits, 0);
  assert.equal(h.data.posted[fixture.matchId].suppressed, true);
  await backfillAnalysis(h.channel, 'bot', [withDuration(2999)], h.data, h.save);
  assert.equal(deletes, 1);
});
test('legacy duration can remove short posts without EA data; 50 minutes or unknown are retained', async () => {
  for (const minutes of [46, 50, null]) {
    const h = harness(); let deletes = 0;
    h.message.delete = async () => { deletes++; };
    if (minutes !== null) h.message.embeds[1].description = `Freundschaftsspiel · Spieldauer ca. ${minutes}′`;
    await backfillAnalysis(h.channel, 'bot', [], h.data, h.save);
    assert.equal(deletes, minutes === 46 ? 1 : 0);
  }
});
test('exactly 50 minutes is retained; deletion failure retries and unrelated messages are protected', async () => {
  const h = harness(); let deletes = 0;
  h.message.delete = async () => { deletes++; };
  await backfillAnalysis(h.channel, 'bot', [withDuration(3000)], h.data, h.save);
  assert.equal(deletes, 0);
  h.message.author.id = 'other';
  await backfillAnalysis(h.channel, 'bot', [withDuration(300)], h.data, h.save);
  assert.equal(deletes, 0);
  h.message.author.id = 'bot';
  h.message.delete = async () => { throw new Error('Discord offline'); };
  await backfillAnalysis(h.channel, 'bot', [withDuration(300)], h.data, h.save);
  assert.equal(h.data.posted[fixture.matchId].suppressed, undefined);
  h.message.delete = async () => { deletes++; };
  await backfillAnalysis(h.channel, 'bot', [withDuration(300)], h.data, h.save);
  assert.equal(deletes, 1);
});

test('damaged posts regain score and both tables with real PNG uploads and latest analysis in the same message', async () => {
  const h = harness(); delete h.data.posted[fixture.matchId].imageRepairVersion;
  h.message.embeds = [h.message.embeds[1]];
  let payload; let edits = 0;
  h.message.edit = async p => { payload = p; edits++; h.message.embeds = p.embeds.map(e => e.toJSON()); };
  const options = { buildPayload: m => require('../friendly-matches/renderer').buildPayload(m, [null, null]) };
  await backfillAnalysis(h.channel, 'bot', [fixture], h.data, h.save, options);
  assert.equal(edits, 1); assert.equal(payload.embeds.length, 5);
  assert.deepEqual(payload.attachments, []);
  assert.deepEqual(payload.files.map(f => f.name), ['ergebnis.png', 'loco-squad.png', 'gegner.png']);
  for (const file of payload.files) assert.equal(file.attachment.subarray(1, 4).toString(), 'PNG');
  assert.equal(payload.embeds[0].data.image.url, 'attachment://ergebnis.png');
  assert.equal(payload.embeds[2].data.image.url, 'attachment://loco-squad.png');
  assert.equal(payload.embeds[3].data.image.url, 'attachment://gegner.png');
  assert.match(payload.embeds[4].data.footer.text, /Analyse v5/);
  assert.equal(h.data.posted[fixture.matchId].imageRepairVersion, 1);
  await backfillAnalysis(h.channel, 'bot', [fixture], h.data, h.save, options);
  assert.equal(edits, 1);
});

test('failed full image restoration remains pending for retry', async () => {
  const h = harness(); delete h.data.posted[fixture.matchId].imageRepairVersion;
  h.message.edit = async () => { throw new Error('upload failed'); };
  await backfillAnalysis(h.channel, 'bot', [fixture], h.data, h.save, { buildPayload: async () => ({ embeds: [], files: [] }) });
  assert.equal(h.data.posted[fixture.matchId].imageRepairVersion, undefined);
});

test('original attachments restore all missing image slots even after EA data expires', () => {
  const { restoreImageUploads } = require('../friendly-matches/service');
  const names = ['ergebnis.png', 'loco-squad.png', 'gegner.png'];
  const message = { attachments: new Map(names.map((name, i) => [String(i), { name, url: `https://cdn.discordapp.com/attachments/1/2/${name}` }])) };
  const summary = new EmbedBuilder().setTitle('Loco Squad 1 : 2 Gegner').setFooter({ text: 'Friendly Match · game' });
  const analysis = new EmbedBuilder().setTitle('🔎 Matchanalyse · Loco Squad');
  const embeds = [summary, analysis];
  const payload = restoreImageUploads(message, embeds);
  assert.deepEqual(payload.attachments, []);
  assert.deepEqual(payload.files.map(f => f.name), names);
  assert.equal(embeds.length, 5);
  assert.deepEqual([embeds[0], embeds[2], embeds[3]].map(e => e.data.image.url), names.map(name => `attachment://${name}`));
  assert.equal(embeds[1], summary); assert.equal(embeds[4], analysis);
});
