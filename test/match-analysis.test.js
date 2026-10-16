'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const { parseMatch } = require('../friendly-matches/model');
const { buildAnalysis, midfield, finishing, goalkeeper } = require('../friendly-matches/analysis');
const { buildPayload } = require('../friendly-matches/renderer');
const fixture = require('./fixtures/friendly-match.json');
function match() { return parseMatch(structuredClone(fixture)); }

test('analysis uses actual midfield totals and specific results from the reference match', () => {
  const m = match(); const e = buildAnalysis(m).toJSON();
  assert.equal(e.fields.length, 5);
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

test('both teams contextualize midfield, shots, tackles and saves without inventing exact position or blame', () => {
  const m = match(); const e = buildAnalysis(m).toJSON();
  assert.ok(!e.fields[0].value.includes('Gegner-Mittelfeld:'));
  assert.match(e.fields[0].value, /Passaufwand im Mittelfeld/);
  assert.match(e.fields[0].value, /AirLuk21/);
  assert.ok(!e.fields[1].value.includes('Gegner:'));
  assert.ok(!e.fields[2].value.includes('Gegner-Tacklings:'));
  assert.ok(!e.fields[3].value.includes('Flayz'));
  assert.match(e.fields[3].value, /ZeroSchnitzel/);
  assert.match(e.fields[4].name, /Nachbesprechung/);
  assert.ok(!JSON.stringify(e).includes(' LS '));
});

test('opponent keeper saves are considered without treating total shots as shots on target', () => {
  const m = match(); const oppKeeper = m.opponent.players.find(p => p.position === 'goalkeeper'); oppKeeper.saves = 6;
  m.own.shots = 12; m.own.goals = 2;
  m.own.players.forEach(p => { p.goals = 0; }); m.own.players[0].goals = 2;
  const text = finishing(m);
  assert.match(text, /vom gegnerischen Torwart abgewehrt/);
  assert.match(text, /2 Tore aus 12 Schüssen/);
  assert.ok(!text.includes('8 Schüsse aufs Tor'));
});

test('small individual samples do not trigger named pass or tackling criticism', () => {
  const m = match();
  m.own.players.forEach(p => { p.name = 'TinySample'; p.passAttempts = 2; p.passes = 0; p.tackleAttempts = 1; p.tackles = 0; });
  assert.ok(!midfield(m).includes('**TinySample'));
  assert.ok(!require('../friendly-matches/analysis').defense(m).includes('**TinySample'));
});

test('missing keeper saves never turn into a claim that no saves were made', () => {
  const m = match(); m.own.players.find(p => p.position === 'goalkeeper').saves = null;
  assert.ok(!goalkeeper(m).includes('Keine Parade bei Gegentoren'));
});

test('analysis respects a reduced message budget while retaining all five categories', () => {
  const e = buildAnalysis(match(), 1600).toJSON();
  const count = (e.title?.length || 0) + (e.footer?.text?.length || 0) + e.fields.reduce((n, f) => n + f.name.length + f.value.length, 0);
  assert.ok(count <= 1600); assert.equal(e.fields.length, 5);
});

test('opponent figures change the assessment without printing opponent stat blocks or names', () => {
  const m = match();
  const before = midfield(m);
  m.opponent.players.filter(p => p.position === 'midfielder').forEach(p => { p.passes = 100; p.passAttempts = 100; });
  const after = midfield(m);
  assert.notEqual(before, after);
  assert.match(after, /Passsicherheit.*Ansatzpunkt/);
  for (const text of [before, after, finishing(m), goalkeeper(m), require('../friendly-matches/analysis').defense(m)]) {
    assert.doesNotMatch(text, /Gegner-Mittelfeld:|Gegner-Tacklings:|Gegner: \d|Flayz_FRAQ/);
  }
});
