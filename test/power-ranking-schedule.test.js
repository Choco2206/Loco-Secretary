'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { scheduledWindow } = require('../power-ranking-hook')._test;
test('Berlin daily window includes evening and midnight but excludes 04:00 and daytime', () => {
  for (const [date, active] of [
    ['2026-10-21T17:59:00Z', false], ['2026-10-21T18:00:00Z', true],
    ['2026-10-22T00:00:00Z', true], ['2026-10-22T02:00:00Z', false],
  ]) assert.equal(scheduledWindow(new Date(date)).active, active);
  const w = scheduledWindow(new Date('2026-10-22T00:00:00Z'));
  assert.equal(w.startedAt, '2026-10-21T18:00:00.000Z');
  assert.equal(w.endedAt, '2026-10-22T02:00:00.000Z');
});
test('DST nights end at Berlin 04:00 after seven or nine real hours', () => {
  for (const [date, hours] of [['2026-03-29T00:30:00Z', 7], ['2026-10-25T01:30:00Z', 9]]) {
    const w = scheduledWindow(new Date(date));
    assert.equal((new Date(w.endedAt) - new Date(w.startedAt)) / 3600000, hours);
    assert.equal(w.active, true);
  }
});
