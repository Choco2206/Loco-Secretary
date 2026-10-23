'use strict';
// Community-observed FC event IDs. They are counters, not a timeline or pass network.
// https://github.com/Interactive-63/eafc-pro-clubs-api-research
const IDS = {
  forward: 30, backward: 32, sideways: 34, short: 24, medium: 26, long: 28,
  crosses: 36, through: 152, firstTime: 143, switches: 144,
  interceptions: 6, aerialAttack: 265, aerialDefense: 266,
  lostDef: 105, lostMid: 106, lostAttack: 107,
  wonDef: 108, wonMid: 109, wonAttack: 110,
  dribbles: 174, secondAssists: 115, shotsOnTarget: 217,
};
function decodeEvents(raw) {
  const buckets = [0, 1, 2, 3].map(i => raw[`match_event_aggregate_${i}`]);
  if (!buckets.every(b => typeof b === 'string') || !buckets.some(b => b.trim())) return null;
  const events = new Map();
  for (const bucket of buckets) {
    for (const token of bucket.split(',').filter(Boolean)) {
      const match = /^(\d+):(\d+)$/.exec(token.trim());
      if (!match || events.has(Number(match[1])) || !Number.isSafeInteger(Number(match[2]))) return null;
      events.set(Number(match[1]), Number(match[2]));
    }
  }
  const value = id => events.get(id) || 0;
  const result = Object.fromEntries(Object.entries(IDS).map(([key, id]) => [key, value(id)]));
  // A partial event stream must not present a convincing but incomplete pass breakdown.
  const named = Number(raw.passesmade ?? raw.passesMade);
  const attempted = Number(raw.passattempts ?? raw.passAttempts);
  result.passingComplete = Number.isFinite(named) && value(215) + value(153) === named
    && Number.isFinite(attempted) && named + value(216) === attempted;
  return result;
}
module.exports = { decodeEvents };
