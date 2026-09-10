'use strict';

const SCORING = Object.freeze({
  goalkeeper: Object.freeze({ rating: 1.5, goal: 10, assist: 7.5, cleanSheet: 10, tackle: 0, tenPasses: 0, save: 1.25, manOfTheMatch: 3 }),
  defender: Object.freeze({ rating: 1.25, goal: 10, assist: 7.5, cleanSheet: 8, tackle: 0.75, tenPasses: 1, save: 0, manOfTheMatch: 3 }),
  midfielder: Object.freeze({ rating: 1.1, goal: 10, assist: 7.5, cleanSheet: 3, tackle: 0.5, tenPasses: 1, save: 0, manOfTheMatch: 3 }),
  forward: Object.freeze({ rating: 1, goal: 12.5, assist: 8, cleanSheet: 0, tackle: 0, tenPasses: 1, save: 0, manOfTheMatch: 3 }),
});

const POSITION_LABELS = Object.freeze({
  goalkeeper: 'Torwart',
  defender: 'Abwehr',
  midfielder: 'Mittelfeld',
  forward: 'Sturm',
});

function normalizePosition(value) {
  const key = String(value || '').trim().toLowerCase();
  if (['goalkeeper', 'gk', 'torwart'].includes(key)) return 'goalkeeper';
  if (['defender', 'defence', 'defense', 'verteidiger'].includes(key)) return 'defender';
  if (['midfielder', 'midfield', 'mittelfeldspieler'].includes(key)) return 'midfielder';
  if (['forward', 'attacker', 'striker', 'stürmer'].includes(key)) return 'forward';
  return null;
}

function scorePerformance(row) {
  const position = normalizePosition(row?.position);
  const scoring = SCORING[position];
  if (!scoring) return 0;

  const passesBlocks = Math.floor(Math.max(0, Number(row.passesMade) || 0) / 10);
  const points =
    (Number(row.rating) || 0) * scoring.rating
    + (Number(row.goals) || 0) * scoring.goal
    + (Number(row.assists) || 0) * scoring.assist
    + (Number(row.cleanSheets) || 0) * scoring.cleanSheet
    + (Number(row.tacklesMade) || 0) * scoring.tackle
    + passesBlocks * scoring.tenPasses
    + (Number(row.saves) || 0) * scoring.save
    + (Number(row.manOfTheMatch) || 0) * scoring.manOfTheMatch;

  return Number(points.toFixed(2));
}

module.exports = { POSITION_LABELS, SCORING, normalizePosition, scorePerformance };
