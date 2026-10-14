'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { isActive, sessionKey, parseMatch, candidates } = require('../friendly-matches/model');
const { createService, recoverPosted } = require('../friendly-matches/service');
const { renderTable, renderScore, buildPayload, marker } = require('../friendly-matches/renderer');
const fixture = require('./fixtures/friendly-match.json');
const copy = () => JSON.parse(JSON.stringify(fixture));
function match(id, timestamp) { const m = copy(); m.matchId = id; m.timestamp = Math.floor(new Date(timestamp).getTime() / 1000); return m; }

test('Berlin night window spans midnight, boundaries, summer/winter and DST repeated hours', () => {
  assert.equal(isActive(new Date('2026-10-14T17:59:00Z')), false);
  assert.equal(isActive(new Date('2026-10-14T18:00:00Z')), true);
  assert.equal(isActive(new Date('2026-10-15T01:59:00Z')), true);
  assert.equal(isActive(new Date('2026-10-15T02:00:00Z')), false);
  assert.equal(isActive(new Date('2026-12-14T19:00:00Z')), true);
  assert.equal(isActive(new Date('2026-12-15T03:00:00Z')), false);
  assert.equal(sessionKey(new Date('2026-10-14T23:00:00Z')), '2026-10-14');
  assert.equal(sessionKey(new Date('2026-10-25T00:30:00Z')), '2026-10-24');
  assert.equal(sessionKey(new Date('2026-10-25T01:30:00Z')), '2026-10-24');
  assert.equal(isActive(new Date('2026-03-29T01:30:00Z')), true);
});

test('actual EA shape produces the same 0:4 statistics as the supplied reference', () => {
  const parsed = parseMatch(fixture);
  assert.equal(parsed.own.name, 'Loco Squad');
  assert.equal(parsed.opponent.name, 'TSG Purion');
  assert.equal(parsed.own.goals, 0); assert.equal(parsed.opponent.goals, 4);
  assert.equal(parsed.minutes, 92);
  assert.equal(parsed.own.shots, 7); assert.equal(parsed.opponent.shots, 10);
  assert.equal(parsed.own.passes, 159); assert.equal(parsed.opponent.passes, 95);
  assert.equal(parsed.own.passPercent, 83); assert.equal(parsed.opponent.passPercent, 76);
  assert.equal(parsed.own.tacklePercent, 20); assert.equal(parsed.opponent.tacklePercent, 30);
  assert.equal(parsed.own.saves, 2); assert.equal(parsed.opponent.saves, 0);
  assert.equal(parsed.own.players[0].name, 'ZeroSchnitzel');
  assert.equal(parsed.opponent.players.find(p => p.motm).name, 'gncfatih12');
});

test('all new matches are chronological; previous night, outside hours, duplicates and future are excluded', () => {
  const now = new Date('2026-10-14T20:00:00Z');
  const recent = match('2', '2026-10-14T19:50:00Z');
  const earlier = match('1', '2026-10-14T18:30:00Z');
  const values = [recent, earlier, recent, match('old', '2026-10-13T19:00:00Z'), match('day', '2026-10-14T17:00:00Z'), match('future', '2026-10-14T21:00:00Z')];
  assert.deepEqual(candidates(values, now).map(m => m.id), ['1', '2']);
  assert.deepEqual(candidates(values, now, { 1: {} }).map(m => m.id), ['2']);
  const bad = copy(); bad.clubs['18360'].matchType = 'leagueMatch'; assert.equal(parseMatch(bad), null);
  const empty = copy(); delete empty.players['107716']; assert.equal(parseMatch(empty), null);
  const missing = copy(); delete missing.players['18360'][Object.keys(missing.players['18360'])[0]].passesmade;
  assert.equal(parseMatch(missing).own.passes, null);
});

function harness(extra = {}) {
  let data = { version: 1, posted: {} }; const sends = [];
  const channel = { isTextBased: () => true, send: async payload => { sends.push(payload); return { id: `message-${sends.length}` }; } };
  let fetches = 0;
  const service = createService({}, {
    previewRequest: null, load: () => structuredClone(data), save: value => { data = structuredClone(value); },
    getChannel: async () => channel, recover: async () => ({}),
    fetchMatches: async () => { fetches++; return [match('2', '2026-10-14T19:55:00Z'), match('1', '2026-10-14T19:50:00Z')]; },
    buildPayload: async m => ({ id: m.id }), ...extra,
  });
  return { service, sends, channel, get data() { return data; }, get fetches() { return fetches; } };
}
test('poll cadence and persisted IDs prevent repeated posts', async () => {
  const h = harness();
  await h.service.tick(new Date('2026-10-14T17:59:00Z')); assert.equal(h.fetches, 0);
  await h.service.tick(new Date('2026-10-14T20:00:00Z')); assert.deepEqual(h.sends.map(x => x.id), ['1', '2']);
  await h.service.tick(new Date('2026-10-14T20:01:00Z')); assert.equal(h.fetches, 1);
  await h.service.tick(new Date('2026-10-14T20:10:00Z')); assert.equal(h.fetches, 2); assert.equal(h.sends.length, 2);
  const restarted = harness({ load: () => structuredClone(h.data) });
  await restarted.service.tick(new Date('2026-10-14T20:20:00Z')); assert.equal(restarted.sends.length, 0);
});
test('send failure leaves unposted match available and recovered Discord ID avoids ambiguous-send duplication', async () => {
  let attempt = 0;
  const h = harness({ recover: async () => attempt > 0 ? { 1: { messageId: 'already-sent', postedAt: '2026-10-14T20:00:00Z' } } : {} });
  h.channel.send = async payload => { attempt++; if (attempt === 1) throw new Error('timeout after Discord accepted'); h.sends.push(payload); return { id: 'second' }; };
  await assert.rejects(h.service.tick(new Date('2026-10-14T20:00:00Z')), /timeout/);
  assert.equal(h.data.posted['1'], undefined);
  await h.service.tick(new Date('2026-10-14T20:10:00Z'));
  assert.deepEqual(h.sends.map(x => x.id), ['2']);
});
test('04:00 closing check includes pre-04:00 game, then no daytime polling', async () => {
  const h = harness({ fetchMatches: async () => [match('last', '2026-10-15T01:59:00Z'), match('late', '2026-10-15T02:00:00Z')] });
  await h.service.tick(new Date('2026-10-15T02:00:00Z')); assert.deepEqual(h.sends.map(x => x.id), ['last']);
  await h.service.tick(new Date('2026-10-15T02:10:00Z')); assert.equal(h.sends.length, 1);
});
test('Discord recovery checks only own reports and scans beyond first page', async () => {
  const now = new Date('2026-10-14T20:00:00Z'); const calls = [];
  const first = new Map(Array.from({ length: 100 }, (_, i) => [String(i), { id: String(i), createdTimestamp: now.getTime() - i * 1000, author: { id: 'bot' }, embeds: [] }]));
  first.get('1').embeds = [{ footer: { text: marker('owned') } }];
  first.get('2').author.id = 'other'; first.get('2').embeds = [{ footer: { text: marker('spoof') } }];
  const second = new Map([['older', { id: 'older', createdTimestamp: now.getTime() - 100000, author: { id: 'bot' }, embeds: [{ footer: { text: marker('earlier') } }] }]]);
  const channel = { messages: { fetch: async options => { calls.push(options); return calls.length === 1 ? first : second; } } };
  const recovered = await recoverPosted(channel, 'bot', now);
  assert.deepEqual(Object.keys(recovered), ['owned', 'earlier']); assert.equal(calls[1].before, '99');
});
test('renderer creates three PNG attachments and valid Discord embed sizes without needing logo network', async () => {
  const parsed = parseMatch(fixture);
  const png = Buffer.from([137, 80, 78, 71]);
  assert.deepEqual(renderTable(parsed.own).subarray(0, 4), png);
  assert.deepEqual((await renderScore(parsed, [null, null])).subarray(0, 4), png);
  const payload = await buildPayload(parsed, [null, null]);
  assert.equal(payload.embeds[0].toJSON().image.url, 'attachment://ergebnis.png');
  assert.equal(payload.embeds[0].toJSON().fields, undefined);
  assert.equal(payload.embeds[1].toJSON().image, undefined);
  assert.equal(payload.files.length, 3); assert.equal(payload.embeds.length, 4);
  assert.equal(payload.embeds[1].toJSON().footer.text, marker(parsed.id));
  assert.ok(payload.files.every(f => f.attachment.length < 8 * 1024 * 1024));
  const json = payload.embeds.map(e => e.toJSON());
  assert.ok(JSON.stringify(json).length < 6000);
  assert.deepEqual(payload.allowedMentions, { parse: [] });
});

test('requested historical preview posts once, including across restart; expires without replay', async () => {
  const request = { matchId: fixture.matchId, expiresAt: '2026-10-14T20:30:00Z' };
  const h = harness({ previewRequest: request, fetchMatches: async () => [copy()] });
  await h.service.tick(new Date('2026-10-14T18:30:00Z'));
  assert.deepEqual(h.sends.map(x => x.id), [fixture.matchId]);
  await h.service.tick(new Date('2026-10-14T18:40:00Z'));
  assert.equal(h.sends.length, 1);
  const restarted = harness({ previewRequest: request, fetchMatches: async () => [copy()], recover: async () => structuredClone(h.data.posted) });
  await restarted.service.tick(new Date('2026-10-14T18:50:00Z'));
  assert.equal(restarted.sends.length, 0);
  const expired = harness({ previewRequest: request, fetchMatches: async () => [copy()] });
  await expired.service.tick(new Date('2026-10-14T20:30:00Z'));
  assert.equal(expired.sends.length, 0);
});

test('existing preview is edited once to the new layout without sending another match', async () => {
  let edits = 0; let sends = 0; let stored;
  const request = { matchId: fixture.matchId, expiresAt: '2026-10-14T20:30:00Z', refreshLayoutVersion: 2 };
  let version = 1;
  const channel = { isTextBased: () => true, send: async () => { sends++; }, messages: {
    fetch: async id => {
      assert.equal(id, 'preview-message');
      return { author: { id: 'bot' }, edit: async payload => { assert.deepEqual(payload.attachments, []); edits++; version = 2; } };
    },
  } };
  const service = createService({ user: { id: 'bot' } }, {
    previewRequest: request, load: () => stored || { posted: {} }, save: d => { stored = structuredClone(d); },
    getChannel: async () => channel, fetchMatches: async () => [copy()], buildPayload: async () => ({ embeds: [] }),
    recover: async () => ({ [fixture.matchId]: { messageId: 'preview-message', postedAt: '2026-10-14T18:30:00Z', layoutVersion: version } }),
  });
  await service.tick(new Date('2026-10-14T18:40:00Z'));
  await service.tick(new Date('2026-10-14T18:50:00Z'));
  assert.equal(edits, 1); assert.equal(sends, 0);
  assert.equal(stored.posted[fixture.matchId].layoutVersion, 2);
});
