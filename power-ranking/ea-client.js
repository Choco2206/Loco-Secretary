'use strict';

const EA_BASE_URL = 'https://proclubs.ea.com/api/fc';
const REQUEST_TIMEOUT_MS = 25000;
const MAX_ATTEMPTS = 3;
let queueTail = Promise.resolve();
let nextRequestAt = 0;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function browserHeaders() {
  return {
    accept: 'application/json, text/plain, */*',
    'accept-language': 'de-DE,de;q=0.9,en;q=0.8',
    referer: 'https://proclubs.ea.com/',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36',
  };
}

async function queuedFetch(url) {
  const run = async () => {
    const waitMs = Math.max(0, nextRequestAt - Date.now());
    if (waitMs) await sleep(waitMs);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      if (typeof timeout.unref === 'function') timeout.unref();
      try {
        const response = await fetch(url, { headers: browserHeaders(), signal: controller.signal });
        if (!response.ok) {
          const error = new Error(`EA Clubs antwortet mit HTTP ${response.status}.`);
          error.status = response.status;
          throw error;
        }
        return response.json();
      } finally {
        clearTimeout(timeout);
      }
    } finally {
      nextRequestAt = Date.now() + 750;
    }
  };
  const current = queueTail.then(run, run);
  queueTail = current.catch(() => null);
  return current;
}

async function fetchJson(path, params) {
  const url = new URL(`${EA_BASE_URL}/${path}`);
  for (const [key, value] of Object.entries(params || {})) {
    if (value !== null && value !== undefined && value !== '') url.searchParams.set(key, String(value));
  }

  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      return await queuedFetch(url);
    } catch (error) {
      lastError = error?.name === 'AbortError'
        ? new Error('EA Clubs hat nicht rechtzeitig geantwortet.')
        : error;
      const retryable = error?.name === 'AbortError' || error?.status === 429 || Number(error?.status) >= 500;
      if (!retryable || attempt === MAX_ATTEMPTS) break;
      await sleep(attempt * attempt * 1000);
    }
  }
  throw lastError || new Error('EA Clubs Anfrage fehlgeschlagen.');
}

function arrayFrom(payload, keys) {
  if (Array.isArray(payload)) return payload;
  for (const key of keys) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }
  return payload && typeof payload === 'object'
    ? Object.values(payload).filter((entry) => entry && typeof entry === 'object')
    : [];
}

function normalizeClub(raw) {
  const clubId = raw?.clubId ?? raw?.club_id ?? raw?.id;
  const name = raw?.name ?? raw?.clubName ?? raw?.club_name;
  if (clubId === null || clubId === undefined || !name) return null;
  return { clubId: String(clubId), name: String(name) };
}

async function searchClubs(clubName, platform) {
  const payload = await fetchJson('allTimeLeaderboard/search', { platform, clubName });
  const unique = new Map();
  for (const raw of arrayFrom(payload, ['clubs', 'items', 'results', 'leaderboard'])) {
    const club = normalizeClub(raw);
    if (club) unique.set(club.clubId, club);
  }
  return [...unique.values()];
}

async function getFriendlyMatches(clubId, platform, maxResultCount = 50) {
  const payload = await fetchJson('clubs/matches', {
    platform,
    clubIds: clubId,
    matchType: 'friendlyMatch',
    maxResultCount,
  });
  return Array.isArray(payload) ? payload : (payload?.matches || []);
}

async function getClubMembers(clubId, platform) {
  const payload = await fetchJson('members/stats', { platform, clubId });
  const members = Array.isArray(payload?.members) ? payload.members : [];
  return members
    .map((member) => ({
      playerName: String(member?.name ?? member?.playername ?? member?.playerName ?? '').trim(),
    }))
    .filter((member) => member.playerName);
}

module.exports = { EA_BASE_URL, getClubMembers, getFriendlyMatches, searchClubs };
