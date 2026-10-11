'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { Collection } = require('discord.js');
const { loadImage } = require('@napi-rs/canvas');
const { weekDetails, renderAward, awardPayload, publishAward, awardMarker } = require('../power-ranking/weekly-award');

const ranking = [
  { discordId: '1', playerName: 'Sieger', points: 321.75, matches: 18, averageRating: 8.42, manOfTheMatch: 5 },
  { discordId: '2', playerName: 'Zweiter', points: 290 },
  { discordId: '3', playerName: 'Dritter', points: 280 },
];

test('Wochenzeitraum stimmt auch bei ISO-Jahreswechsel', () => {
  assert.deepEqual(weekDetails('2026-W41'), { label: 'KW 41', range: '05.10.2026 – 11.10.2026', starts: '05.10.2026', ends: '12.10.2026' });
  assert.equal(weekDetails('2026-W01').range, '29.12.2025 – 04.01.2026');
});

test('Siegergrafik wird vollständig als PNG gerendert, auch ohne Avatar', async () => {
  const buffer = await renderAward(ranking[0], '2026-W41', 'Ein sehr langer Spielername für die Grafik');
  const image = await loadImage(buffer);
  assert.equal(image.width, image.height);
  assert.ok(image.width >= 1024);
  assert.equal(buffer.subarray(1, 4).toString(), 'PNG');
});

test('Wochenpost erwähnt genau das Podium und hängt die Grafik an', () => {
  const payload = awardPayload(ranking, '2026-W41', Buffer.from('test'));
  assert.deepEqual(payload.allowedMentions, { parse: [], users: ['1', '2', '3'] });
  assert.match(payload.embeds[0].data.description, /Platz 2.*<@2>/);
  assert.match(payload.embeds[0].data.description, /Platz 3.*<@3>/);
  assert.equal(payload.embeds[0].data.image.url, 'attachment://loco-der-woche.png');
  assert.equal(payload.files.length, 1);
});

test('Bereits akzeptierter Discord-Post wird nach fehlender Speicherung wiedergefunden', async () => {
  let rendered = false;
  let publication;
  await publishAward({
    target: { messages: { fetch: async () => new Collection([['existing', {
      id: 'existing', author: { id: 'bot' }, embeds: [{ footer: { text: awardMarker('2026-W41') } }],
    }]]) }, send: async () => assert.fail('Doppelter Post') },
    guild: {}, botId: 'bot', key: '2026-W41', archive: { publicationStatus: 'pending', ranking },
    render: async () => { rendered = true; }, savePublication: (value) => { publication = value; },
  });
  assert.equal(rendered, false);
  assert.equal(publication.messageId, 'existing');
  assert.equal(publication.publicationStatus, 'posted');
});

test('Fehlgeschlagener Versand bleibt offen und wird erneut versucht', async () => {
  const archive = { publicationStatus: 'pending', ranking };
  let fail = true;
  let posts = 0;
  const args = {
    target: { messages: { fetch: async () => new Collection() }, send: async () => {
      if (fail) throw new Error('Discord offline');
      posts += 1;
      return { id: 'new-post' };
    } },
    guild: { members: { fetch: async () => null } }, botId: 'bot', key: '2026-W41', archive,
    render: async () => Buffer.from('test'), savePublication: (value) => Object.assign(archive, value),
  };
  await assert.rejects(publishAward(args), /Discord offline/);
  assert.equal(archive.publicationStatus, 'pending');
  fail = false;
  await publishAward(args);
  await publishAward(args);
  assert.equal(posts, 1);
  assert.equal(archive.publicationStatus, 'posted');
});

test('Leere Wertungswochen produzieren keinen erfundenen Sieger', async () => {
  let publication;
  await publishAward({ target: {}, key: '2026-W41', archive: { publicationStatus: 'pending', ranking: [] }, savePublication: (value) => { publication = value; } });
  assert.equal(publication.publicationStatus, 'empty');
});
