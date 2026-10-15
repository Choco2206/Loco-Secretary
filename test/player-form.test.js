'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const { playerForm, ingest, findPlayer, summarize } = require('../player-form/model');
const { payload, marker } = require('../player-form/embed');
const { createService, ROLE_ID, members, recover } = require('../player-form/service');
const fixture = require('./fixtures/friendly-match.json');
const member = { id: '1001', displayName: 'Choco', user: { bot: false }, roles: { cache: new Map([[ROLE_ID, true]]) } };
const link = { playerId: '42', playerName: 'Choco2206', clubId: '46978' };
function performance(position, rating, overrides = {}) { return { id: '42', name: 'Choco2206', position, rating, goals: 1, assists: 2, passes: 8, passAttempts: 10, tackles: 3, saves: 1, secondsPlayed: 5500, ...overrides }; }
function match(id, position, rating, overrides = {}) { return { id: String(id), clubId: '18360', timestamp: new Date(Date.UTC(2026, 9, 14, 18, Number(id))).toISOString(), minutes: 92, termination: null, players: [performance(position, rating)], ...overrides }; }
function data(matches) { return { version: 1, matches: Object.fromEntries(matches.map(m => [m.id, m])), messages: {} }; }

test('five against five compares same area only, even for a player alternating positions', () => {
  const rows = [];
  for (let i = 0; i < 10; i++) rows.push(match(i, 'defender', i < 5 ? 6 : 8));
  rows.push(match(10, 'forward', 10), match(11, 'midfielder', 4));
  const form = playerForm(data(rows), link);
  assert.equal(form.positions.defender.count, 10);
  assert.equal(form.positions.defender.comparable, true);
  assert.equal(form.positions.defender.current.rating, 8); assert.equal(form.positions.defender.previous.rating, 6);
  assert.equal(form.positions.forward.count, 1); assert.equal(form.positions.forward.comparable, false);
  assert.equal(form.positions.midfielder.current.rating, 4);
  assert.equal(form.positions.goalkeeper.count, 0);
});
test('short matches, short player appearances, missing duration and other clubs are not counted', () => {
  const rows = [match(0, 'defender', 8), match(1, 'defender', 9, { termination: 'early', minutes: 5 }),
    match(2, 'defender', 9, { players: [performance('defender', 9, { secondsPlayed: 100 })] }),
    match(3, 'defender', 9, { minutes: null }), match(4, 'defender', 9, { clubId: '999' })];
  const form = playerForm(data(rows), link);
  assert.equal(form.positions.defender.count, 1); assert.equal(form.excluded, 3);
});
test('EA account ID takes precedence over names; fallback requires unique matching name', () => {
  const m = { players: [performance('defender', 8), performance('forward', 3, { id: '99', name: 'Wrong' })] };
  assert.equal(findPlayer(m, { playerId: '42', playerName: 'Wrong' }).id, '42');
  assert.equal(findPlayer(m, { playerId: 'missing', playerName: 'Choco2206' }), null);
  assert.equal(findPlayer(m, { playerName: ' choco2206 ' }).id, '42');
  m.players.push(performance('forward', 3, { id: '100' }));
  assert.equal(findPlayer(m, { playerName: 'Choco2206' }), null);
});
test('pass quote uses total attempts; incomplete data remains unknown', () => {
  const rows = [performance('defender', 8), performance('defender', 6, { passes: 9, passAttempts: 30 })];
  assert.equal(summarize(rows).rating, 7);
  assert.equal(summarize(rows).passPercent, 42.5);
  rows[0].passes = null; assert.equal(summarize(rows).passPercent, null);
});
test('ingestion deduplicates available historical games and filters daytime and future', () => {
  const raw = structuredClone(fixture); const d = data([]);
  const now = new Date('2026-10-15T00:00:00Z');
  assert.equal(ingest(d, [raw, raw], now), 1);
  assert.equal(Object.keys(d.matches).length, 1);
  assert.equal(ingest(d, [raw], now), 0);
  raw.matchId = 'day'; raw.timestamp = new Date('2026-10-14T10:00:00Z').getTime() / 1000;
  assert.equal(ingest(d, [raw], now), 0);
  raw.matchId = 'future'; raw.timestamp = new Date('2026-10-15T20:00:00Z').getTime() / 1000;
  assert.equal(ingest(d, [raw], now), 0);
});
test('one embed contains all areas, no misleading trend under ten games, clear unlinked state', () => {
  const p = payload(member, link, data([match(1, 'defender', 8)]));
  const e = p.embeds[0].toJSON();
  assert.equal(e.title, 'Choco2206'); assert.equal(e.footer.text, marker(member.id));
  assert.equal(e.fields.length, 4); assert.match(e.fields[1].value, /1\/10/);
  assert.ok(!e.fields[1].value.includes('↗️')); assert.ok(!e.fields[1].value.includes('zuvor'));
  assert.ok(JSON.stringify(e).length < 6000);
  assert.match(payload(member, null, data([])).embeds[0].toJSON().description, /noch nicht verknüpft/);
  assert.deepEqual(p.allowedMentions, { parse: [] });
});

function harness(options = {}) {
  let state = data([]); let sent = 0; let edited = 0; let deleted = 0; let fetched = 0;
  const history = new Map();
  const channel = { guild: {}, isTextBased: () => true, messages: { fetch: async id => {
    const msg = [...history.values()].find(m => m.id === id); if (!msg) { const e = new Error('missing'); e.code = 10008; throw e; } return msg;
  } }, send: async p => {
    sent++; const id = /^Spieler-Formkurve · (.+)$/.exec(p.embeds[0].toJSON().footer.text)[1];
    const msg = { id: `msg-${sent}`, author: { id: 'bot' }, embeds: p.embeds.map(e => e.toJSON()),
      edit: async next => { edited++; msg.embeds = next.embeds.map(e => e.toJSON()); }, delete: async () => { deleted++; history.delete(id); } };
    history.set(id, msg); return msg;
  } };
  const deps = { load: () => structuredClone(state), save: d => { state = structuredClone(d); },
    ranking: () => ({ links: { [member.id]: link } }), getChannel: async () => channel,
    members: async () => [member], recover: async () => history,
    fetchMatches: async () => { fetched++; return [structuredClone(fixture)]; }, ...options };
  const service = createService({ user: { id: 'bot' } }, deps);
  return { service, history, deps, get sent() { return sent; }, get edited() { return edited; }, get deleted() { return deleted; }, get fetched() { return fetched; }, get state() { return state; } };
}
test('fixed cards remain one per player across ticks and restart, links update without reposting', async () => {
  const h = harness();
  await h.service.tick(new Date('2026-10-15T00:00:00Z')); assert.equal(h.sent, 1);
  await h.service.tick(new Date('2026-10-15T00:01:00Z')); assert.equal(h.fetched, 1);
  await h.service.tick(new Date('2026-10-15T00:10:00Z')); assert.equal(h.sent, 1); assert.equal(h.edited, 0);
  const restarted = createService({ user: { id: 'bot' } }, { ...h.deps, load: () => data([]) });
  await restarted.tick(new Date('2026-10-15T00:20:00Z')); assert.equal(h.sent, 1); assert.equal(h.edited, 1);
  h.deps.ranking = () => ({ links: {} });
  const unlink = createService({ user: { id: 'bot' } }, h.deps);
  await unlink.tick(new Date('2026-10-15T00:30:00Z')); assert.equal(h.sent, 1);
  assert.match(h.history.get(member.id).embeds[0].description, /noch nicht verknüpft/);
});
test('EA outages preserve history; daytime refreshes roster without EA calls', async () => {
  const h = harness(); await h.service.tick(new Date('2026-10-15T00:00:00Z'));
  const failed = createService({ user: { id: 'bot' } }, { ...h.deps, fetchMatches: async () => { throw new Error('EA offline'); } });
  await failed.tick(new Date('2026-10-15T00:10:00Z')); assert.equal(Object.keys(h.state.matches).length, 1);
  const daytime = harness(); await daytime.service.tick(new Date('2026-10-15T10:00:00Z'));
  assert.equal(daytime.fetched, 0); assert.equal(daytime.sent, 1);
});
test('role departure removes only recovered feature cards after successful full member read', async () => {
  const h = harness(); await h.service.tick(new Date('2026-10-15T00:00:00Z'));
  const departed = createService({ user: { id: 'bot' } }, { ...h.deps, members: async () => [] });
  await departed.tick(new Date('2026-10-15T00:10:00Z')); assert.equal(h.deleted, 1);
});
test('ambiguous send succeeds in Discord but fails locally; recovered marker prevents second card', async () => {
  const h = harness(); let fail = true;
  const original = h.deps.save;
  const service = createService({ user: { id: 'bot' } }, { ...h.deps, save: d => {
    if (fail && Object.keys(d.messages).length) { fail = false; throw new Error('disk full'); } original(d);
  } });
  await assert.rejects(service.tick(new Date('2026-10-15T00:00:00Z')), /disk full/);
  await service.tick(new Date('2026-10-15T00:10:00Z')); assert.equal(h.sent, 1);
});
test('roster pagination filters bots and non-role members', async () => {
  const first = new Map(Array.from({ length: 1000 }, (_, i) => [String(i), { id: String(i), user: { bot: true }, roles: { cache: new Map() } }])); first.last = () => first.get('999');
  const second = new Map([[member.id, member]]); const calls = [];
  const result = await members({ members: { list: async p => { calls.push(p); return calls.length === 1 ? first : second; } } });
  assert.deepEqual(result, [member]); assert.equal(calls[1].after, '999');
});

test('manual refresh immediately rereads a new link within the same polling slot without another EA request', async () => {
  const links = {};
  const h = harness({ ranking: () => ({ links }) });
  const now = new Date('2026-10-15T00:00:00Z');
  await h.service.tick(now);
  assert.match(h.history.get(member.id).embeds[0].description, /noch nicht verknüpft/);
  links[member.id] = link;
  await h.service.refresh(new Date('2026-10-15T00:01:00Z'));
  assert.equal(h.sent, 1); assert.equal(h.edited, 1); assert.equal(h.fetched, 1);
  assert.equal(h.history.get(member.id).embeds[0].title, 'Choco2206');
  delete links[member.id];
  await h.service.refresh(new Date('2026-10-15T00:02:00Z'));
  assert.match(h.history.get(member.id).embeds[0].description, /noch nicht verknüpft/);
  assert.equal(h.fetched, 1);
  await h.service.tick(new Date('2026-10-15T00:10:00Z')); assert.equal(h.fetched, 2);
});

test('refresh waits for an active publisher and does not drop the updated association', async () => {
  const links = {}; let release; let entered;
  const enteredPromise = new Promise(resolve => { entered = resolve; });
  const pause = new Promise(resolve => { release = resolve; });
  let once = true;
  const originalPayload = require('../player-form/embed').payload;
  const h = harness({ ranking: () => ({ links }), buildPayload: (m, l, d) => {
    if (once) { once = false; entered(); }
    return originalPayload(m, l, d);
  } });
  // Pause the send after the first run has read the old links.
  const originalSend = h.deps.getChannel;
  const channel = await originalSend(); const send = channel.send;
  channel.send = async p => { await pause; return send(p); };
  const running = h.service.tick(new Date('2026-10-15T00:00:00Z'));
  await enteredPromise; links[member.id] = link;
  const refresh = h.service.refresh(new Date('2026-10-15T00:01:00Z'));
  release(); await Promise.all([running, refresh]);
  assert.equal(h.sent, 1); assert.equal(h.edited, 1);
  assert.equal(h.history.get(member.id).embeds[0].title, 'Choco2206');
});

test('every position shows goals, assists and tackles including seven goals by a midfielder', () => {
  const rows = [];
  for (const [index, position] of ['goalkeeper', 'defender', 'midfielder', 'forward'].entries()) {
    rows.push(match(index * 2, position, 8, { players: [performance(position, 8, { goals: 3, assists: 1 })] }));
    rows.push(match(index * 2 + 1, position, 8, { players: [performance(position, 8, { goals: 4, assists: 2 })] }));
  }
  const p = payload(member, link, data(rows)); const e = p.embeds[0].toJSON();
  for (const field of e.fields) {
    assert.match(field.value, /Tore: \*\*7\*\*/);
    assert.match(field.value, /Vorlagen: \*\*3\*\*/);
    assert.match(field.value, /Tore\/Spiel: \*\*3,5\*\*/);
    assert.match(field.value, /Erfolgreiche Tacklings\/Spiel/);
    assert.ok(field.value.length <= 1024);
  }
  assert.ok(JSON.stringify(e).length < 6000);
});

test('existing form cards are edited with added metrics when stored match data already contains them', async () => {
  const h = harness(); await h.service.tick(new Date('2026-10-15T00:00:00Z'));
  const d = h.state; const own = Object.values(fixture.players['18360'])[0];
  const ownId = Object.keys(fixture.players['18360'])[0];
  const service = createService({ user: { id: 'bot' } }, { ...h.deps,
    ranking: () => ({ links: { [member.id]: { playerId: ownId, playerName: own.playername } } }),
  });
  await service.refresh(new Date('2026-10-15T00:01:00Z'));
  assert.equal(h.sent, 1); assert.equal(h.edited, 1);
  assert.ok(h.history.get(member.id).embeds[0].fields.some(f => f.value.includes('Erfolgreiche Tacklings/Spiel')));
});
