'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const { parseMatch } = require('../friendly-matches/model');
const { buildAnalysis, midfield, finishing, goalkeeper } = require('../friendly-matches/analysis');
const { buildPayload } = require('../friendly-matches/renderer');
const fixture = require('./fixtures/friendly-match.json');
function match() { return parseMatch(structuredClone(fixture)); }

test('analysis uses actual midfield totals and specific results from the reference match', () => {
  const m = match(); const e = buildAnalysis(m).toJSON();
  assert.equal(e.fields.length, 4);
  assert.match(e.fields[0].value, /84\/107/); assert.match(e.fields[0].value, /23 Fehlpässe/);
  assert.match(e.fields[1].value, /0 Tore aus 7 Schüssen/);
  assert.match(e.fields[2].value, /8\/40 erfolgreich/);
  assert.match(e.fields[3].value, /2 Paraden/);
  assert.ok(!JSON.stringify(e).includes('Torwart ist schuld'));
});
test('the fifth embed follows the opponent table, all Discord fields and message limits hold', async () => {
  const p = await buildPayload(match(), [null, null]); const embeds = p.embeds.map(e => e.toJSON());
  assert.equal(embeds[3].image.url, 'attachment://gegner.png'); assert.equal(embeds[4].title, '🔎 Matchanalyse · Loco Squad');
  const length = embeds.reduce((sum, e) => sum + (e.title?.length || 0) + (e.description?.length || 0) + (e.footer?.text.length || 0) + (e.fields || []).reduce((n, f) => n + f.name.length + f.value.length, 0), 0);
  assert.ok(length < 6000); assert.ok(embeds.every(e => (e.fields || []).every(f => f.value.length <= 1024)));
});
test('aborted and durationless matches do not produce regular performance verdicts', () => {
  const m = match(); m.termination = 'early'; m.minutes = 5;
  const e = buildAnalysis(m).toJSON(); assert.match(e.description, /5′/);
  assert.ok(e.fields.every(f => f.value.includes('Keine reguläre Leistungsbewertung')));
  m.termination = null; m.durationSeconds = null;
  assert.match(buildAnalysis(m).toJSON().description, /Spielzeit fehlt/);
});
test('missing data, no shots, awarded goals and inconsistent data are not scored as normal', () => {
  const m = match(); m.own.players.filter(p => p.position === 'midfielder')[0].passes = null;
  assert.match(midfield(m), /Keine vollständigen/);
  m.own.shots = 0; assert.match(finishing(m), /keinen erfassten Abschluss/);
  m.own.goals = 3; assert.match(finishing(m), /keine Abschlussbewertung/);
  assert.ok(!finishing(m).includes('100 % Ausbeute'));
});
test('keeper analysis handles absent keeper, partial appearances and multiple keepers', () => {
  const m = match(); const keeper = m.own.players.find(p => p.position === 'goalkeeper');
  keeper.secondsPlayed = 100; assert.match(goalkeeper(m), /nicht während der gesamten/);
  m.own.players.push({ ...keeper, id: 'other', secondsPlayed: 200 }); assert.match(goalkeeper(m), /Mehrere Torwarte/);
  m.own.players = m.own.players.filter(p => p.position !== 'goalkeeper'); assert.match(goalkeeper(m), /Kein menschlicher Torwart/);
});
