'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { Collection } = require('discord.js');
const { loadImage } = require('@napi-rs/canvas');
const { weekDetails, renderAward, awardPayload, awardTextPayload, publishAward, awardMarker } = require('../power-ranking/weekly-award');

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

test('Bildpost markiert Loco Squad, separater Hype-Text erwähnt genau das Podium', () => {
  const payload = awardPayload(ranking, '2026-W41', Buffer.from('test'));
  assert.deepEqual(payload.allowedMentions, { parse: [], roles: ['1426495393742454834'] });
  assert.match(payload.content, /<@&1426495393742454834>/);
  const text = awardTextPayload(ranking, '2026-W41');
  assert.deepEqual(text.allowedMentions, { parse: [], users: ['1', '2', '3'] });
  assert.match(text.content, /Platz 2.*<@2>/);
  assert.match(text.content, /Platz 3.*<@3>/);
  assert.match(text.content, /<@1>, herzlichen Glückwunsch/);
  assert.ok(text.content.length <= 2000);
  assert.equal(payload.embeds[0].data.image.url, 'attachment://loco-der-woche.png');
  assert.equal(payload.files.length, 1);
});

test('Bereits akzeptierter Discord-Post wird nach fehlender Speicherung wiedergefunden', async () => {
  let rendered = false;
  let publication;
  await publishAward({
    target: { messages: { fetch: async () => new Collection([['existing', {
      id: 'existing', author: { id: 'bot' }, embeds: [{ footer: { text: awardMarker('2026-W41') } }],
    }]]) }, send: async (payload) => {
      assert.equal(payload.files, undefined);
      return { id: 'text-post' };
    } },
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
  assert.equal(posts, 2);
  assert.equal(archive.publicationStatus, 'posted');
});

test('Fehler zwischen Bild und Text erzeugt beim nächsten Versuch kein zweites Bild', async () => {
  const archive = { publicationStatus: 'pending', ranking };
  const sent = new Collection();
  let failText = true;
  let images = 0;
  let texts = 0;
  const args = {
    target: { messages: { fetch: async () => sent }, send: async (payload) => {
      if (!payload.files && failText) throw new Error('Text fehlgeschlagen');
      payload.files ? images++ : texts++;
      const message = { id: String(sent.size + 1), author: { id: 'bot' }, content: payload.content, embeds: (payload.embeds || []).map((embed) => embed.data) };
      sent.set(message.id, message);
      return message;
    } },
    guild: { members: { fetch: async () => null } }, botId: 'bot', key: '2026-W41', archive,
    render: async () => Buffer.from('test'), savePublication: (value) => Object.assign(archive, value),
  };
  await assert.rejects(publishAward(args), /Text fehlgeschlagen/);
  assert.equal(archive.publicationStatus, 'pending');
  failText = false;
  await publishAward(args);
  assert.equal(images, 1);
  assert.equal(texts, 1);
  assert.equal(archive.publicationStatus, 'posted');
});

test('Leere Wertungswochen produzieren keinen erfundenen Sieger', async () => {
  let publication;
  await publishAward({ target: {}, key: '2026-W41', archive: { publicationStatus: 'pending', ranking: [] }, savePublication: (value) => { publication = value; } });
  assert.equal(publication.publicationStatus, 'empty');
});

test('Alle drei Plätze zeigen vollständige Leistungswerte innerhalb des Discord-Limits', () => {
  const rows = ranking.map((row, i) => ({ ...row, matches: 26, averageRating: 7.68,
    manOfTheMatch: 3, goals: i + 1, assists: i + 4, cleanSheets: i + 7,
    tacklesMade: i + 10, passesMade: i + 100, saves: i + 13 }));
  const text = awardTextPayload(rows, '2026-W41').content;
  for (const label of ['Spiele:', 'Tore:', 'Vorlagen:', 'Zu-null:', 'Tacklings:', 'Erfolgreiche Pässe:', 'Paraden:']) {
    assert.equal(text.split(label).length - 1, 3);
  }
  assert.ok(text.length <= 2000, `Textlänge: ${text.length}`);
  assert.match(text, /Vorlagen: \*\*6\*\*/);
  assert.match(text, /Pässe zählen je volle 10 pro Spiel/);
});

test('Archivierter Wochenbeitrag wird einmal bearbeitet ohne neuen Post oder Ping', async () => {
  const archive = { publicationStatus: 'posted', ranking, textMessageId: 'text' };
  let edits = 0;
  const args = {
    archive, key: '2026-W41', botId: 'bot',
    target: { messages: { fetch: async (id) => {
      assert.equal(id, 'text');
      return { author: { id: 'bot' }, edit: async (payload) => {
        edits++;
        assert.deepEqual(payload.allowedMentions, { parse: [] });
        assert.match(payload.content, /Tacklings:/);
      } };
    } }, send: async () => assert.fail('Kein neuer Beitrag') },
    savePublication: (value) => Object.assign(archive, value),
  };
  await publishAward(args);
  await publishAward(args);
  assert.equal(edits, 1);
});
