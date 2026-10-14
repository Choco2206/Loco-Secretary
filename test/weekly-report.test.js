'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const { FIRST_WEEK, boundary, currentWeek, dueWeeks, ingest, weekData } = require('../weekly-report/model');
const { payload, ROLE_ID, marker } = require('../weekly-report/report');
const { createService, recoverReport } = require('../weekly-report/service');
const fixture = require('./fixtures/friendly-match.json');
function state() { return { version: 1, matches: {}, reports: {} }; }
function row(id, time, ownGoals = 2, opponentGoals = 1, regular = true) { return { id, timestamp: time, ownGoals, opponentGoals, opponentName: 'Opponent', regular, minutes: regular ? 92 : 5, termination: regular ? null : 'early' }; }

test('Monday 07:30 Berlin boundaries, including both DST changes', () => {
  assert.equal(new Date(boundary('2026-10-12')).toISOString(), '2026-10-12T05:30:00.000Z');
  assert.equal(new Date(boundary('2026-10-26')).toISOString(), '2026-10-26T06:30:00.000Z');
  assert.equal((boundary('2026-10-26') - boundary('2026-10-19')) / 3600000, 169);
  assert.equal((boundary('2026-03-30') - boundary('2026-03-23')) / 3600000, 167);
  assert.equal(currentWeek(new Date('2026-10-19T05:29:59Z')), '2026-10-12');
  assert.equal(currentWeek(new Date('2026-10-19T05:30:00Z')), '2026-10-19');
});
test('weekly reporting is first due October 19 and catches missed deadlines without repeating recorded weeks', () => {
  assert.deepEqual(dueWeeks(new Date('2026-10-19T05:29:59Z'), {}), []);
  assert.deepEqual(dueWeeks(new Date('2026-10-19T05:30:00Z'), {}), [FIRST_WEEK]);
  assert.deepEqual(dueWeeks(new Date('2026-10-26T06:30:00Z'), { [FIRST_WEEK]: {} }), ['2026-10-19']);
});
test('week includes opening instant, excludes closing instant, separates early matches and computes WDL and goals', () => {
  const d = state();
  const rows = [row('a', '2026-10-12T05:30:00Z', 2, 1), row('b', '2026-10-18T23:00:00Z', 1, 1), row('c', '2026-10-18T23:30:00Z', 0, 2),
    row('d', '2026-10-18T23:45:00Z', 3, 0, false), row('outside', '2026-10-19T05:30:00Z', 10, 0)];
  d.matches = Object.fromEntries(rows.map(m => [m.id, m]));
  const w = weekData(d, FIRST_WEEK);
  assert.deepEqual(w.regular, { games: 3, wins: 1, draws: 1, losses: 1, goals: 3, against: 4 });
  assert.equal(w.other.games, 1); assert.equal(w.all.games, 4); assert.equal(w.all.goals, 6);
});
test('available matches seed first week, duplicate IDs count once, daytime matches count, old/future games do not', () => {
  const d = state(); const raw = structuredClone(fixture);
  ingest(d, [raw, raw], new Date('2026-10-15T00:00:00Z')); assert.equal(Object.keys(d.matches).length, 1);
  raw.matchId = 'day'; raw.timestamp = new Date('2026-10-14T10:00:00Z').getTime() / 1000;
  ingest(d, [raw], new Date('2026-10-15T00:00:00Z')); assert.equal(Object.keys(d.matches).length, 2);
  raw.matchId = 'old'; raw.timestamp = new Date('2026-10-12T05:29:59Z').getTime() / 1000;
  ingest(d, [raw], new Date('2026-10-15T00:00:00Z')); assert.equal(Object.keys(d.matches).length, 2);
});
test('report includes dates, exact role mention, combined balance and every result embedded without a text attachment', () => {
  const d = state(); for (let i = 0; i < 25; i++) d.matches[i] = row(String(i), new Date(Date.UTC(2026, 9, 14, 19, i)).toISOString());
  const p = payload(d, FIRST_WEEK); const e = p.embeds[0].toJSON();
  assert.match(e.title, /12\.10\.2026 bis 19\.10\.2026/); assert.equal(e.footer.text, marker(FIRST_WEEK));
  assert.ok(p.content.includes(`<@&${ROLE_ID}>`)); assert.deepEqual(p.allowedMentions, { parse: [], roles: [ROLE_ID] });
  assert.equal(p.files.length, 1); assert.equal(p.files[0].name.endsWith('.png'), true);
  assert.deepEqual(p.files[0].attachment.subarray(0, 4), Buffer.from([137, 80, 78, 71]));
  assert.equal(e.image.url, `attachment://${p.files[0].name}`);
  assert.ok(!e.fields.some(f => /Vorzeitig|Regulär/.test(f.name)));
  assert.equal(e.fields[0].value, '25');
  assert.ok(e.fields.every(f => f.value.length <= 1024)); assert.ok(JSON.stringify(e).length < 6000);
  assert.match(payload(state(), FIRST_WEEK).embeds[0].toJSON().fields.at(-1).value, /Keine Friendly Matches/);
});
function harness(extra = {}) {
  let d = state(); let sends = 0; let fetches = 0; const history = new Map();
  const channel = { isTextBased: () => true, send: async p => { sends++; const msg = { id: `report-${sends}`, embeds: p.embeds.map(e => e.toJSON()) }; history.set(msg.embeds[0].footer.text, msg); return msg; } };
  const deps = { load: () => structuredClone(d), save: next => { d = structuredClone(next); }, fetchMatches: async () => { fetches++; return [fixture]; },
    getChannel: async () => channel, recover: async (c, k) => history.get(marker(k)) || null, ...extra };
  return { service: createService({}, deps), deps, history, get d() { return d; }, get sends() { return sends; }, get fetches() { return fetches; } };
}
test('deadline publishes once, repeated ticks and restart do not send or ping again', async () => {
  const h = harness();
  await h.service.tick(new Date('2026-10-15T00:00:00Z')); assert.equal(h.sends, 0); assert.equal(Object.keys(h.d.matches).length, 1);
  await h.service.tick(new Date('2026-10-19T05:30:00Z')); assert.equal(h.sends, 1);
  await h.service.tick(new Date('2026-10-19T05:31:00Z')); assert.equal(h.sends, 1);
  const restarted = createService({}, h.deps); await restarted.tick(new Date('2026-10-19T06:00:00Z')); assert.equal(h.sends, 1);
});
test('send accepted before failed local save is recovered without a second role ping', async () => {
  const h = harness(); const save = h.deps.save; let fail = true;
  const service = createService({}, { ...h.deps, save: next => { if (fail && next.reports[FIRST_WEEK]) { fail = false; throw new Error('disk full'); } save(next); } });
  await assert.rejects(service.tick(new Date('2026-10-19T05:30:00Z')), /disk full/);
  await service.tick(new Date('2026-10-19T05:31:00Z')); assert.equal(h.sends, 1); assert.ok(h.d.reports[FIRST_WEEK]);
});
test('active-night capture is shared; daytime capture runs on ten-minute cadence', async () => {
  const h = harness(); await h.service.tick(new Date('2026-10-15T00:00:00Z')); assert.equal(h.fetches, 1);
  await h.service.tick(new Date('2026-10-15T00:10:00Z')); assert.equal(h.fetches, 1);
  await h.service.tick(new Date('2026-10-15T10:00:00Z')); assert.equal(h.fetches, 2);
  await h.service.tick(new Date('2026-10-15T10:01:00Z')); assert.equal(h.fetches, 2);
  await h.service.tick(new Date('2026-10-15T10:10:00Z')); assert.equal(h.fetches, 3);
});
test('failed Discord send remains pending and successful retry produces one report', async () => {
  const h = harness(); const channel = await h.deps.getChannel(); const send = channel.send; let fail = true;
  channel.send = async p => { if (fail) { fail = false; throw new Error('Discord unavailable'); } return send(p); };
  await assert.rejects(h.service.tick(new Date('2026-10-19T05:30:00Z')), /Discord unavailable/);
  assert.equal(h.d.reports[FIRST_WEEK], undefined);
  await h.service.tick(new Date('2026-10-19T05:31:00Z')); assert.equal(h.sends, 1);
});

test('Discord history recovery accepts only this bot and the exact week marker', async () => {
  const messages = new Map([
    ['foreign', { id: 'foreign', author: { id: 'other' }, createdTimestamp: boundary('2026-10-19'), embeds: [{ footer: { text: marker(FIRST_WEEK) } }] }],
    ['own', { id: 'own', author: { id: 'bot' }, createdTimestamp: boundary('2026-10-19'), embeds: [{ footer: { text: marker(FIRST_WEEK) } }] }],
  ]);
  const found = await recoverReport({ messages: { fetch: async () => messages } }, 'bot', FIRST_WEEK);
  assert.equal(found.id, 'own');
});

test('match feed archives available week games even if they are outside its current posting session', async () => {
  const d = state(); const feedData = { posted: {} };
  const feed = require('../friendly-matches/service').createService({}, {
    load: () => feedData, save: () => {}, fetchMatches: async () => [fixture],
    getChannel: async () => ({ isTextBased: () => true, send: async () => { throw new Error('Old game must not be reposted'); } }),
    recover: async () => ({}), previewRequest: null, onMatches: (raw, now) => ingest(d, raw, now),
  });
  await feed.tick(new Date('2026-10-15T00:00:00Z'));
  assert.equal(Object.keys(d.matches).length, 1);
  assert.equal(Object.keys(feedData.posted).length, 0);
});

test('first-week backfill recovers existing own match posts after EA history has expired', async () => {
  const { seedFromPosts } = require('../weekly-report/service');
  const summary = { title: 'Loco Squad 2 : 1 Opponent', description: 'Freundschaftsspiel · Spieldauer ca. 92′', timestamp: '2026-10-14T20:00:00Z', footer: { text: 'Friendly Match · historical-id' } };
  const messages = new Map([
    ['own', { id: 'own', createdTimestamp: new Date(summary.timestamp).getTime(), author: { id: 'bot' }, embeds: [summary] }],
    ['foreign', { id: 'foreign', createdTimestamp: new Date(summary.timestamp).getTime(), author: { id: 'other' }, embeds: [{ ...summary, footer: { text: 'Friendly Match · spoof' } }] }],
  ]);
  const found = await seedFromPosts({ messages: { fetch: async () => messages } }, 'bot');
  assert.deepEqual(Object.keys(found), ['historical-id']);
  assert.equal(found['historical-id'].regular, true); assert.equal(found['historical-id'].ownGoals, 2);
});

test('more than ten and more than 225 results remain in a single message with every row and no txt files', () => {
  for (const count of [14, 70, 230]) {
    const d = state(); for (let i = 0; i < count; i++) d.matches[i] = row(String(i), new Date(Date.UTC(2026, 9, 14, 19, 0, i)).toISOString());
    const p = payload(d, FIRST_WEEK);
    assert.ok(p.embeds.length <= 10); assert.ok(p.files.length <= 9);
    assert.ok(p.files.every(f => f.name.endsWith('.png')));
    assert.equal(p.embeds[0].data.fields[0].value, String(count));
    assert.equal(p.files.length, Math.ceil(count / Math.max(25, Math.ceil(count / 9))));
    assert.ok(!p.embeds.some(e => /Letzte 10/.test(e.data.title || '')));
  }
});
