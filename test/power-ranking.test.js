'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { scorePerformance } = require('../power-ranking/scoring');
const {
  aggregateRanking,
  mergeClubMembersWithRecentIds,
  paginatePlayers,
  parseMatch,
  weekKey,
} = require('../power-ranking-hook')._test;

test('Punkteformel bewertet die vereinbarten Positionsleistungen', () => {
  assert.equal(scorePerformance({
    position: 'goalkeeper', rating: 7, saves: 6, cleanSheets: 1,
  }), 28);
  assert.equal(scorePerformance({
    position: 'forward', rating: 8, goals: 2, assists: 1, passesMade: 20,
  }), 43);
  assert.equal(scorePerformance({
    position: 'defender', rating: 8, tacklesMade: 5, cleanSheets: 1, passesMade: 40, assists: 1,
  }), 33.25);
});

test('Montag vor 07 Uhr gehört zur vorherigen Rankingwoche', () => {
  assert.equal(weekKey('2026-09-14T04:59:00.000Z'), '2026-W37'); // 06:59 Uhr Berlin
  assert.equal(weekKey('2026-09-14T05:00:00.000Z'), '2026-W38'); // 07:00 Uhr Berlin
});

test('EA-Match wird für den verbundenen Club normalisiert', () => {
  const match = {
    matchId: 'match-1', timestamp: 1788990000,
    clubs: {
      46978: { goals: 2, details: { clubId: '46978', name: 'Loco Squad' } },
      555: { goals: 0, details: { clubId: '555', name: 'Gegner' } },
    },
    players: {
      46978: {
        p1: { playername: 'Choco', pos: 'forward', rating: '8.0', goals: 2, assists: 0, passesmade: 21 },
      },
    },
  };
  const parsed = parseMatch(match, { clubId: '46978' }, '2026-09-09T20:00:00.000Z');
  assert.equal(parsed.id, 'match-1');
  assert.equal(parsed.opponentName, 'Gegner');
  assert.equal(parsed.performances[0].points, 35);
});

test('Gesamtranking summiert nur verknüpfte, berechtigte und aktive Spiele', () => {
  const targetWeek = '2026-W37';
  const data = {
    links: { discord1: { clubId: '46978', playerId: null, playerName: 'Choco' } },
    matches: {
      a: { clubId: '46978', timestamp: '2026-09-10T20:00:00.000Z', excluded: false, performances: [
        { playerId: 'p1', playerName: 'Choco', position: 'forward', rating: 8, goals: 1, assists: 1, passesMade: 10, points: 29.5 },
      ] },
      b: { clubId: '46978', timestamp: '2026-09-10T21:00:00.000Z', excluded: true, performances: [
        { playerId: 'p1', playerName: 'Choco', position: 'forward', rating: 10, goals: 10, points: 135 },
      ] },
    },
  };
  const ranking = aggregateRanking(data, new Set(['discord1']), targetWeek);
  assert.equal(ranking.length, 1);
  assert.equal(ranking[0].points, 29.5);
  assert.equal(ranking[0].matches, 1);
});

test('EA-Spielerauswahl verteilt bis zu 50 Spieler auf 20er-Seiten', () => {
  const players = Array.from({ length: 50 }, (_, index) => ({
    playerId: String(index + 1),
    playerName: `Spieler ${index + 1}`,
  }));
  assert.equal(paginatePlayers(players, 0).items.length, 20);
  assert.equal(paginatePlayers(players, 1).items.length, 20);
  assert.equal(paginatePlayers(players, 2).items.length, 10);
  assert.equal(paginatePlayers(players, 2).pageCount, 3);
  assert.equal(paginatePlayers(players, 99).page, 2);
});

test('vollständige Clubmitgliederliste übernimmt bekannte Match-IDs per Name', () => {
  const members = Array.from({ length: 41 }, (_, index) => ({ playerName: `Spieler ${index + 1}` }));
  const merged = mergeClubMembersWithRecentIds(members, [
    { playerId: 'ea-21', playerName: 'SPIELER 21' },
  ]);
  assert.equal(merged.length, 41);
  assert.equal(merged.find((player) => player.playerName === 'Spieler 21').playerId, 'ea-21');
  assert.equal(paginatePlayers(merged, 2).items.length, 1);
});
