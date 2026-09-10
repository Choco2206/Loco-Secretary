'use strict';

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  EmbedBuilder,
  Events,
  MessageFlags,
  ModalBuilder,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
  UserSelectMenuBuilder,
} = require('discord.js');
const { getFriendlyMatches, searchClubs } = require('./power-ranking/ea-client');
const store = require('./power-ranking/store');
const { POSITION_LABELS, normalizePosition, scorePerformance } = require('./power-ranking/scoring');

const CHANNELS = Object.freeze({
  admin: '1547550736622157844',
  ranking: '1547550537216426045',
  playerOfWeek: '1547551244170568046', // Wird mit Grafik und Special Awards im nächsten Schritt verwendet.
});
const LOCO_SQUAD_ROLE_ID = '1426495393742454834';
const OWNER_USER_ID = '1425580097661833443';
const ACCENT_COLOR = 0xe84a8a;
const POLL_INTERVAL_MS = 10 * 60 * 1000;
const MAX_SESSION_MS = 12 * 60 * 60 * 1000;
const pendingClubSearches = new Map();
let captureRunning = false;
let refreshRunning = false;

function isAdmin(interaction) {
  return interaction.user.id === OWNER_USER_ID
    || interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild);
}

function berlinDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function formatBerlin(value) {
  if (!value) return '–';
  return new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin',
    weekday: 'short', day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(value));
}

function weekKey(value = new Date()) {
  // Durch den Sieben-Stunden-Versatz zählt Montag 00:00–06:59 Uhr noch zur Vorwoche.
  const shifted = new Date(new Date(value).getTime() - 7 * 60 * 60 * 1000);
  const local = berlinDateParts(shifted);
  const date = new Date(Date.UTC(Number(local.year), Number(local.month) - 1, Number(local.day), 12));
  const weekday = date.getUTCDay() || 7;
  const thursday = new Date(date);
  thursday.setUTCDate(thursday.getUTCDate() + 4 - weekday);
  const isoYear = thursday.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4, 12));
  const firstWeekday = firstThursday.getUTCDay() || 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() + 4 - firstWeekday);
  const calendarWeek = 1 + Math.round((thursday - firstThursday) / 604800000);
  return `${isoYear}-W${String(calendarWeek).padStart(2, '0')}`;
}

function eaMatchId(match) {
  return String(match?.matchId ?? match?.match_id ?? match?.id ?? '');
}

function matchTimestamp(match) {
  const raw = match?.timestamp ?? match?.matchTimestamp ?? match?.match_timestamp ?? match?.date;
  if (raw === null || raw === undefined || raw === '') return null;
  if (/^\d+$/.test(String(raw))) {
    const number = Number(raw);
    return new Date(number < 100000000000 ? number * 1000 : number).toISOString();
  }
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function clubMap(match) {
  return match?.clubs || match?.teams || {};
}

function clubEntry(match, clubId) {
  return Object.entries(clubMap(match)).find(([key, club]) =>
    String(key) === String(clubId)
      || String(club?.clubId ?? club?.club_id ?? club?.details?.clubId ?? '') === String(clubId));
}

function clubGoals(club) {
  const value = Number(club?.goals ?? club?.score ?? club?.goalsFor);
  return Number.isFinite(value) ? value : null;
}

function parseMatch(match, configuredClub, sessionStartedAt) {
  const id = eaMatchId(match);
  const ownEntry = clubEntry(match, configuredClub.clubId);
  if (!id || !ownEntry) return null;
  const [rawClubId, ownClub] = ownEntry;
  const opponentEntry = Object.entries(clubMap(match)).find(([key, club]) =>
    String(key) !== String(rawClubId)
      && String(club?.clubId ?? club?.club_id ?? club?.details?.clubId ?? key) !== String(configuredClub.clubId));
  const [, opponentClub = {}] = opponentEntry || [];
  const ownGoals = clubGoals(ownClub);
  const opponentGoals = clubGoals(opponentClub);
  const players = match?.players?.[rawClubId]
    || match?.players?.[configuredClub.clubId]
    || {};
  const performances = [];

  for (const [playerId, player] of Object.entries(players || {})) {
    const position = normalizePosition(player?.pos ?? player?.position);
    const playerName = player?.playername ?? player?.playerName ?? player?.name;
    const rating = Number(player?.rating);
    if (!position || !playerName || !Number.isFinite(rating)) continue;
    const cleanSheets = Math.max(
      Number(player.cleansheetsany) || 0,
      Number(player.cleansheetsdef) || 0,
      Number(player.cleansheetsgk) || 0,
      opponentGoals === 0 ? 1 : 0
    );
    const row = {
      playerId: String(playerId),
      playerName: String(playerName),
      position,
      rating,
      goals: Number(player.goals) || 0,
      assists: Number(player.assists) || 0,
      manOfTheMatch: Number(player.man_of_the_match ?? player.mom) || 0,
      tacklesMade: Number(player.tacklesmade ?? player.tacklesMade) || 0,
      saves: Number(player.saves ?? player.gkSaves) || 0,
      cleanSheets,
      passesMade: Number(player.passesmade ?? player.passesMade) || 0,
    };
    row.points = scorePerformance(row);
    performances.push(row);
  }

  return {
    id,
    clubId: String(configuredClub.clubId),
    timestamp: matchTimestamp(match) || new Date().toISOString(),
    capturedAt: new Date().toISOString(),
    sessionStartedAt,
    ownGoals,
    opponentGoals,
    opponentName: String(opponentClub?.name ?? opponentClub?.clubName ?? opponentClub?.details?.name ?? 'Unbekannter Gegner'),
    excluded: false,
    performances,
  };
}

async function fetchMembers(guild) {
  try {
    await guild.members.list({ limit: 1000 });
  } catch (error) {
    console.error('[power-ranking] Mitgliederliste nicht vollständig geladen:', error.message);
  }
  return [...guild.members.cache.values()]
    .filter((member) => !member.user.bot && member.roles.cache.has(LOCO_SQUAD_ROLE_ID));
}

async function channel(client, id) {
  return client.channels.cache.get(id) || client.channels.fetch(id).catch(() => null);
}

function adminButtons(active) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('pr_club_search').setLabel('EA-Club suchen').setEmoji('🔎').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('pr_start').setLabel('Wertung starten').setEmoji('▶️').setStyle(ButtonStyle.Success).setDisabled(active),
      new ButtonBuilder().setCustomId('pr_stop').setLabel('Wertung beenden').setEmoji('⏹️').setStyle(ButtonStyle.Danger).setDisabled(!active),
      new ButtonBuilder().setCustomId('pr_check').setLabel('EA jetzt prüfen').setEmoji('🔄').setStyle(ButtonStyle.Secondary),
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('pr_manage_matches').setLabel('Spiele verwalten').setEmoji('📋').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('pr_unlink_player').setLabel('EA-Link löschen').setEmoji('🔗').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('pr_refresh').setLabel('Übersicht aktualisieren').setStyle(ButtonStyle.Secondary),
    ),
  ];
}

function platformMenu() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('pr_platform')
      .setPlaceholder('Plattform auswählen')
      .addOptions([
        { label: 'PS5 / Xbox Series / PC', value: 'common-gen5', description: 'Aktuelle Konsolen- und PC-Generation' },
        { label: 'PS4 / Xbox One', value: 'common-gen4', description: 'Vorherige Konsolengeneration' },
      ])
  );
}

function clubNameModal(platform) {
  return new ModalBuilder()
    .setCustomId(`pr_club_modal:${platform}`)
    .setTitle('EA-Club suchen')
    .addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('club_name')
        .setLabel('Exakter Clubname')
        .setPlaceholder('Loco Squad')
        .setRequired(true)
        .setMaxLength(40)
        .setStyle(TextInputStyle.Short)
    ));
}

async function upsertBotMessage(targetChannel, title, payload, storedId) {
  let message = storedId ? await targetChannel.messages.fetch(storedId).catch(() => null) : null;
  if (!message) {
    const messages = await targetChannel.messages.fetch({ limit: 30 }).catch(() => null);
    message = messages && [...messages.values()].find((item) =>
      item.author?.id === targetChannel.client.user.id && item.embeds?.[0]?.title === title);
  }
  if (message) {
    await message.edit(payload);
    return message;
  }
  return targetChannel.send(payload);
}

async function ensureAdminPanel(client, guild) {
  const target = await channel(client, CHANNELS.admin);
  if (!target?.isTextBased()) return;
  const data = store.load();
  const members = (await fetchMembers(guild)).sort((a, b) => a.displayName.localeCompare(b.displayName, 'de'));
  const lines = members.map((member) => {
    const link = data.links[member.id];
    const valid = link && String(link.clubId) === String(data.club?.clubId);
    return valid
      ? `✅ <@${member.id}> · **${link.playerName}**`
      : `❌ <@${member.id}> · ${link ? 'für diesen Club neu verknüpfen' : 'nicht verknüpft'}`;
  });
  const linked = members.filter((member) => String(data.links[member.id]?.clubId) === String(data.club?.clubId)).length;
  const session = data.session;
  const status = session
    ? `🟢 **Wertung läuft**\nGestartet: ${formatBerlin(session.startedAt)} von <@${session.startedBy}>`
    : '🔴 **Wertung ausgeschaltet**';
  const club = data.club
    ? `**EA-Club:** ${data.club.name}\n**Plattform:** ${data.club.platformLabel}\n**Interne Club-ID:** ${data.club.clubId}`
    : '**EA-Club:** noch nicht eingerichtet';
  const embed = new EmbedBuilder()
    .setColor(ACCENT_COLOR)
    .setTitle('👑 Loco Power Ranking · Admin')
    .setDescription([status, '', club, '', `**Verknüpft: ${linked}/${members.length}**`, lines.join('\n') || 'Keine Loco-Squad-Spieler gefunden.'].join('\n'))
    .setFooter({ text: 'Die Club-ID wird automatisch über die EA-Clubsuche ermittelt.' })
    .setTimestamp();
  const message = await upsertBotMessage(target, '👑 Loco Power Ranking · Admin', {
    embeds: [embed], components: adminButtons(Boolean(session)), allowedMentions: { parse: [] },
  }, data.messages.admin);
  if (message.id !== data.messages.admin) store.update((next) => { next.messages.admin = message.id; return next; });
}

function aggregateRanking(data, eligibleDiscordIds, targetWeek = weekKey()) {
  const linkByPlayerId = new Map();
  for (const [discordId, link] of Object.entries(data.links)) {
    if (eligibleDiscordIds.has(discordId)) {
      linkByPlayerId.set(`${link.clubId || 'legacy'}:${link.playerId}`, { discordId, ...link });
    }
  }
  const rows = new Map();
  for (const match of Object.values(data.matches)) {
    if (match.excluded || weekKey(match.timestamp) !== targetWeek) continue;
    for (const performance of match.performances || []) {
      const link = linkByPlayerId.get(`${match.clubId || 'legacy'}:${performance.playerId}`);
      if (!link) continue;
      const row = rows.get(link.discordId) || {
        discordId: link.discordId, playerName: link.playerName, points: 0, matches: 0,
        ratingTotal: 0, goals: 0, assists: 0, saves: 0, cleanSheets: 0,
        manOfTheMatch: 0, positions: {},
      };
      row.points += Number(performance.points ?? scorePerformance(performance));
      row.matches += 1;
      row.ratingTotal += Number(performance.rating) || 0;
      row.goals += Number(performance.goals) || 0;
      row.assists += Number(performance.assists) || 0;
      row.saves += Number(performance.saves) || 0;
      row.cleanSheets += Number(performance.cleanSheets) || 0;
      row.manOfTheMatch += Number(performance.manOfTheMatch) || 0;
      row.positions[performance.position] = (row.positions[performance.position] || 0) + 1;
      rows.set(link.discordId, row);
    }
  }
  return [...rows.values()].map((row) => {
    const position = Object.entries(row.positions)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'forward';
    return {
      ...row,
      position,
      points: Number(row.points.toFixed(2)),
      pointsPerGame: Number((row.points / row.matches).toFixed(2)),
      averageRating: Number((row.ratingTotal / row.matches).toFixed(2)),
    };
  }).sort((a, b) => b.points - a.points
    || b.matches - a.matches
    || b.pointsPerGame - a.pointsPerGame
    || b.averageRating - a.averageRating
    || b.manOfTheMatch - a.manOfTheMatch);
}

function points(value) {
  return Number(value || 0).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
}

function linkButton() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('pr_link_player').setLabel('EA-Profil verknüpfen').setEmoji('🎮').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('pr_show_me').setLabel('Meine Werte').setEmoji('📊').setStyle(ButtonStyle.Secondary)
  );
}

async function ensureRanking(client, guild) {
  if (refreshRunning) return;
  refreshRunning = true;
  try {
    const target = await channel(client, CHANNELS.ranking);
    if (!target?.isTextBased()) return;
    const data = store.load();
    const members = await fetchMembers(guild);
    const eligibleIds = new Set(members.map((member) => member.id));
    const ranking = aggregateRanking(data, eligibleIds);
    const currentWeek = weekKey();
    const list = ranking.slice(0, 15).map((row, index) =>
      `**${index + 1}.** <@${row.discordId}> · ${POSITION_LABELS[row.position]} · **${points(row.points)} Pkt.** · ${row.matches} Sp.`);
    const positionIcons = { goalkeeper: '🧤', defender: '🛡️', midfielder: '⚙️', forward: '⚡' };
    const leaders = Object.keys(POSITION_LABELS).map((position) => {
      const leader = ranking.find((row) => row.position === position);
      return leader
        ? `${positionIcons[position]} **${POSITION_LABELS[position]}:** <@${leader.discordId}> · ${points(leader.points)} Pkt.`
        : `${positionIcons[position]} **${POSITION_LABELS[position]}:** noch keine Wertung`;
    });
    const status = data.session ? '🟢 Wertung läuft' : '🔴 Wertung ausgeschaltet';
    const embed = new EmbedBuilder()
      .setColor(ACCENT_COLOR)
      .setTitle('👑 Loco Power Ranking')
      .setDescription([
        `**${currentWeek.replace('-W', ' · KW ')}** · ${status}`,
        '', '**GESAMTRANKING**', list.join('\n') || '*Noch keine gewerteten Spiele in dieser Woche.*',
        '', '**POSITIONSFÜHRENDE**', ...leaders,
      ].join('\n'))
      .setFooter({ text: 'Montag 07:00 Uhr beginnt eine neue Rankingwoche.' })
      .setTimestamp();
    const message = await upsertBotMessage(target, '👑 Loco Power Ranking', {
      embeds: [embed], components: [linkButton()], allowedMentions: { parse: [] },
    }, data.messages.ranking);
    if (message.id !== data.messages.ranking) store.update((next) => { next.messages.ranking = message.id; return next; });
  } finally {
    refreshRunning = false;
  }
}

async function refreshPanels(client, guild) {
  await ensureAdminPanel(client, guild);
  await ensureRanking(client, guild);
}

async function captureWindow(client, guild, window) {
  if (captureRunning || !window) return { added: 0, skipped: true };
  captureRunning = true;
  try {
    const data = store.load();
    if (!data.club) throw new Error('Es ist noch kein EA-Club eingerichtet.');
    const matches = await getFriendlyMatches(data.club.clubId, data.club.platform, 50);
    const baseline = new Set(window.baselineMatchIds || []);
    const startMs = new Date(window.startedAt).getTime();
    const endMs = window.endedAt ? new Date(window.endedAt).getTime() : Infinity;
    let added = 0;
    store.update((next) => {
      for (const match of matches) {
        const id = eaMatchId(match);
        if (!id || next.matches[id] || baseline.has(id)) continue;
        const timestamp = matchTimestamp(match);
        const time = timestamp ? new Date(timestamp).getTime() : Date.now();
        if (time < startMs || time > endMs) continue;
        const parsed = parseMatch(match, next.club, window.startedAt);
        if (!parsed) continue;
        next.matches[id] = parsed;
        added += 1;
      }
      if (next.session && String(next.session.startedAt) === String(window.startedAt)) {
        next.session.lastCheckedAt = new Date().toISOString();
      }
      return next;
    });
    if (added) await refreshPanels(client, guild);
    return { added, available: matches.length };
  } finally {
    captureRunning = false;
  }
}

async function startSession(client, guild, userId) {
  const data = store.load();
  if (!data.club) throw new Error('Richte zuerst den EA-Club ein.');
  if (data.session) throw new Error('Die Wertung läuft bereits.');
  const matches = await getFriendlyMatches(data.club.clubId, data.club.platform, 50);
  const session = {
    startedAt: new Date().toISOString(),
    startedBy: userId,
    baselineMatchIds: matches.map(eaMatchId).filter(Boolean),
    lastCheckedAt: new Date().toISOString(),
  };
  store.update((next) => { next.session = session; return next; });
  await refreshPanels(client, guild);
  return session;
}

async function stopSession(client, guild, reason = 'manual') {
  const before = store.load();
  if (!before.session) throw new Error('Die Wertung läuft aktuell nicht.');
  const window = { ...before.session, endedAt: new Date().toISOString() };
  const capture = await captureWindow(client, guild, window);
  store.update((next) => {
    next.lastSession = { ...window, stoppedReason: reason };
    next.session = null;
    return next;
  });
  await refreshPanels(client, guild);

  // EA liefert das letzte beendete Spiel gelegentlich verspätet. Drei stille Nachprüfungen fangen das ab.
  for (const delay of [2, 5, 10]) {
    const timer = setTimeout(() => captureWindow(client, guild, window).catch((error) =>
      console.error('[power-ranking] Nachprüfung fehlgeschlagen:', error.message)), delay * 60 * 1000);
    if (typeof timer.unref === 'function') timer.unref();
  }
  return capture;
}

function availablePlayers(matches, clubId) {
  const unique = new Map();
  for (const match of matches) {
    const ownEntry = clubEntry(match, clubId);
    if (!ownEntry) continue;
    const [rawClubId] = ownEntry;
    const players = match?.players?.[rawClubId] || match?.players?.[clubId] || {};
    for (const [playerId, player] of Object.entries(players || {})) {
      const name = player?.playername ?? player?.playerName ?? player?.name;
      if (name) unique.set(String(playerId), String(name));
    }
  }
  return [...unique.entries()].map(([playerId, playerName]) => ({ playerId, playerName }))
    .sort((a, b) => a.playerName.localeCompare(b.playerName, 'de'));
}

async function handlePlayerLink(interaction, client) {
  if (!interaction.member.roles.cache.has(LOCO_SQUAD_ROLE_ID)) {
    return interaction.reply({ content: 'Diese Funktion ist nur für Loco-Squad-Spieler.', flags: MessageFlags.Ephemeral });
  }
  const data = store.load();
  if (!data.club) return interaction.reply({ content: 'Der EA-Club wurde noch nicht eingerichtet.', flags: MessageFlags.Ephemeral });
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const matches = await getFriendlyMatches(data.club.clubId, data.club.platform, 50);
  const claimed = new Map(Object.entries(data.links)
    .filter(([, link]) => String(link.clubId) === String(data.club.clubId))
    .map(([discordId, link]) => [String(link.playerId), discordId]));
  const players = availablePlayers(matches, data.club.clubId)
    .filter((player) => !claimed.has(player.playerId) || claimed.get(player.playerId) === interaction.user.id)
    .slice(0, 25);
  if (!players.length) return interaction.editReply('In den verfügbaren EA-Spielen wurden keine freien Spielerprofile gefunden. Spiele zuerst mindestens eine Partie mit Loco Squad.');
  const menu = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder().setCustomId('pr_player_select').setPlaceholder('Dein EA-Profil auswählen')
      .addOptions(players.map((player) => ({ label: player.playerName.slice(0, 100), value: player.playerId })))
  );
  return interaction.editReply({ content: 'Wähle dein eigenes EA-Spielerprofil aus:', components: [menu] });
}

function recentMatchesMenu(data) {
  const matches = Object.values(data.matches).sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp))).slice(0, 25);
  if (!matches.length) return null;
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder().setCustomId('pr_match_toggle').setPlaceholder('Spiel ein-/ausschließen')
      .addOptions(matches.map((match) => ({
        label: `${match.excluded ? '🚫' : '✅'} ${match.ownGoals ?? '?'}:${match.opponentGoals ?? '?'} vs. ${match.opponentName}`.slice(0, 100),
        description: `${formatBerlin(match.timestamp)} · ${match.performances?.length || 0} Spielerwerte`.slice(0, 100),
        value: match.id,
      })))
  );
}

async function archiveWeekIfNeeded(client, guild) {
  const current = weekKey();
  const data = store.load();
  const previous = data.currentWeekKey;
  if (!previous) {
    store.update((next) => { next.currentWeekKey = current; return next; });
    return;
  }
  if (previous === current) return;
  const members = await fetchMembers(guild);
  const eligibleIds = new Set(members.map((member) => member.id));
  const ranking = aggregateRanking(data, eligibleIds, previous);
  store.update((next) => {
    next.weeklyArchive[previous] ||= { closedAt: new Date().toISOString(), ranking };
    next.currentWeekKey = current;
    return next;
  });
  await ensureRanking(client, guild);
}

async function handleInteraction(interaction, client) {
  const id = interaction.customId || '';
  if (!id.startsWith('pr_')) return;

  try {
    if (interaction.isButton() && id === 'pr_club_search') {
      if (!isAdmin(interaction)) return interaction.reply({ content: 'Diese Funktion ist nur für die Teamleitung.', flags: MessageFlags.Ephemeral });
      return interaction.reply({ content: 'Wähle zuerst die Plattform des Clubs:', components: [platformMenu()], flags: MessageFlags.Ephemeral });
    }
    if (interaction.isStringSelectMenu() && id === 'pr_platform') {
      if (!isAdmin(interaction)) return interaction.reply({ content: 'Diese Funktion ist nur für die Teamleitung.', flags: MessageFlags.Ephemeral });
      return interaction.showModal(clubNameModal(interaction.values[0]));
    }
    if (interaction.isModalSubmit() && id.startsWith('pr_club_modal:')) {
      if (!isAdmin(interaction)) return interaction.reply({ content: 'Diese Funktion ist nur für die Teamleitung.', flags: MessageFlags.Ephemeral });
      const platform = id.split(':')[1];
      const platformLabel = platform === 'common-gen5' ? 'PS5 / Xbox Series / PC' : 'PS4 / Xbox One';
      const clubName = interaction.fields.getTextInputValue('club_name').trim();
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const clubs = (await searchClubs(clubName, platform)).slice(0, 25);
      if (!clubs.length) return interaction.editReply(`EA hat keinen Club mit dem Namen **${clubName}** gefunden.`);
      pendingClubSearches.set(interaction.user.id, { platform, platformLabel, clubs, expiresAt: Date.now() + 10 * 60 * 1000 });
      const menu = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder().setCustomId('pr_club_select').setPlaceholder('Gefundenen EA-Club auswählen')
          .addOptions(clubs.map((club) => ({ label: club.name.slice(0, 100), value: club.clubId, description: `EA Club-ID ${club.clubId}`.slice(0, 100) })))
      );
      return interaction.editReply({ content: 'Wähle den richtigen Club aus. Die ID speichert der Bot automatisch:', components: [menu] });
    }
    if (interaction.isStringSelectMenu() && id === 'pr_club_select') {
      if (!isAdmin(interaction)) return interaction.reply({ content: 'Diese Funktion ist nur für die Teamleitung.', flags: MessageFlags.Ephemeral });
      const search = pendingClubSearches.get(interaction.user.id);
      if (!search || search.expiresAt < Date.now()) return interaction.update({ content: 'Die Clubsuche ist abgelaufen. Starte sie bitte erneut.', components: [] });
      const club = search.clubs.find((item) => item.clubId === interaction.values[0]);
      if (!club) return interaction.update({ content: 'Dieser Club konnte nicht mehr zugeordnet werden.', components: [] });
      await interaction.deferUpdate();
      store.update((data) => {
        data.club = { ...club, platform: search.platform, platformLabel: search.platformLabel, linkedAt: new Date().toISOString() };
        data.session = null;
        data.lastSession = null;
        return data;
      });
      pendingClubSearches.delete(interaction.user.id);
      await refreshPanels(client, interaction.guild);
      return interaction.editReply({ content: `✅ **${club.name}** wurde verbunden. Die Club-ID **${club.clubId}** hat der Bot automatisch übernommen.`, components: [] });
    }
    if (interaction.isButton() && id === 'pr_start') {
      if (!isAdmin(interaction)) return interaction.reply({ content: 'Diese Funktion ist nur für die Teamleitung.', flags: MessageFlags.Ephemeral });
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const session = await startSession(client, interaction.guild, interaction.user.id);
      return interaction.editReply(`🟢 Die Wertung läuft ab jetzt. Start: **${formatBerlin(session.startedAt)}**.`);
    }
    if (interaction.isButton() && id === 'pr_stop') {
      if (!isAdmin(interaction)) return interaction.reply({ content: 'Diese Funktion ist nur für die Teamleitung.', flags: MessageFlags.Ephemeral });
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const result = await stopSession(client, interaction.guild);
      return interaction.editReply(`⏹️ Wertung beendet. Bei der Abschlussprüfung wurden **${result.added || 0}** neue Spiele gefunden. Weitere Nachprüfungen laufen automatisch.`);
    }
    if (interaction.isButton() && id === 'pr_check') {
      if (!isAdmin(interaction)) return interaction.reply({ content: 'Diese Funktion ist nur für die Teamleitung.', flags: MessageFlags.Ephemeral });
      const data = store.load();
      const window = data.session || data.lastSession;
      if (!window) return interaction.reply({ content: 'Es gibt noch keinen Wertungszeitraum, den ich prüfen könnte.', flags: MessageFlags.Ephemeral });
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const result = await captureWindow(client, interaction.guild, window);
      return interaction.editReply(`🔄 EA geprüft: **${result.added || 0}** neue Spiele übernommen.`);
    }
    if (interaction.isButton() && id === 'pr_manage_matches') {
      if (!isAdmin(interaction)) return interaction.reply({ content: 'Diese Funktion ist nur für die Teamleitung.', flags: MessageFlags.Ephemeral });
      const menu = recentMatchesMenu(store.load());
      return interaction.reply({ content: menu ? 'Wähle ein Spiel aus. Gewertete Spiele werden ausgeschlossen, ausgeschlossene wieder aktiviert.' : 'Es wurden noch keine Spiele erfasst.', components: menu ? [menu] : [], flags: MessageFlags.Ephemeral });
    }
    if (interaction.isButton() && id === 'pr_unlink_player') {
      if (!isAdmin(interaction)) return interaction.reply({ content: 'Diese Funktion ist nur für die Teamleitung.', flags: MessageFlags.Ephemeral });
      const menu = new ActionRowBuilder().addComponents(
        new UserSelectMenuBuilder().setCustomId('pr_unlink_user').setPlaceholder('Spieler auswählen').setMinValues(1).setMaxValues(1)
      );
      return interaction.reply({ content: 'Wessen EA-Verknüpfung möchtest du löschen?', components: [menu], flags: MessageFlags.Ephemeral });
    }
    if (interaction.isUserSelectMenu() && id === 'pr_unlink_user') {
      if (!isAdmin(interaction)) return interaction.reply({ content: 'Diese Funktion ist nur für die Teamleitung.', flags: MessageFlags.Ephemeral });
      const userId = interaction.values[0];
      let removed = null;
      store.update((data) => {
        removed = data.links[userId] || null;
        delete data.links[userId];
        return data;
      });
      await interaction.update({ content: removed ? `✅ Die EA-Verknüpfung von <@${userId}> wurde gelöscht.` : 'Dieser Spieler hatte keine EA-Verknüpfung.', components: [] });
      await refreshPanels(client, interaction.guild);
      return;
    }
    if (interaction.isStringSelectMenu() && id === 'pr_match_toggle') {
      if (!isAdmin(interaction)) return interaction.reply({ content: 'Diese Funktion ist nur für die Teamleitung.', flags: MessageFlags.Ephemeral });
      const matchId = interaction.values[0];
      let excluded = false;
      store.update((data) => {
        if (!data.matches[matchId]) return data;
        data.matches[matchId].excluded = !data.matches[matchId].excluded;
        excluded = data.matches[matchId].excluded;
        return data;
      });
      await ensureRanking(client, interaction.guild);
      return interaction.update({ content: excluded ? '🚫 Das Spiel wurde aus dem Ranking entfernt.' : '✅ Das Spiel wird wieder im Ranking gewertet.', components: [] });
    }
    if (interaction.isButton() && id === 'pr_refresh') {
      if (!isAdmin(interaction)) return interaction.reply({ content: 'Diese Funktion ist nur für die Teamleitung.', flags: MessageFlags.Ephemeral });
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      await refreshPanels(client, interaction.guild);
      return interaction.editReply('✅ Admin-Übersicht und Ranking wurden aktualisiert.');
    }
    if (interaction.isButton() && id === 'pr_link_player') return handlePlayerLink(interaction, client);
    if (interaction.isStringSelectMenu() && id === 'pr_player_select') {
      if (!interaction.member.roles.cache.has(LOCO_SQUAD_ROLE_ID)) return interaction.reply({ content: 'Diese Funktion ist nur für Loco-Squad-Spieler.', flags: MessageFlags.Ephemeral });
      const playerId = interaction.values[0];
      const data = store.load();
      const claimedBy = Object.entries(data.links).find(([discordId, link]) =>
        String(link.clubId) === String(data.club.clubId)
          && String(link.playerId) === playerId
          && discordId !== interaction.user.id);
      if (claimedBy) return interaction.update({ content: 'Dieses EA-Profil wurde inzwischen bereits verknüpft.', components: [] });
      const player = availablePlayers(await getFriendlyMatches(data.club.clubId, data.club.platform, 50), data.club.clubId)
        .find((item) => item.playerId === playerId);
      if (!player) return interaction.update({ content: 'Das EA-Profil wurde nicht mehr in den verfügbaren Spielen gefunden.', components: [] });
      store.update((next) => {
        next.links[interaction.user.id] = { ...player, clubId: String(data.club.clubId), linkedAt: new Date().toISOString() };
        return next;
      });
      await interaction.update({ content: `✅ Dein Discord-Profil ist jetzt mit **${player.playerName}** verbunden.`, components: [] });
      await refreshPanels(client, interaction.guild);
      return;
    }
    if (interaction.isButton() && id === 'pr_show_me') {
      const data = store.load();
      const link = data.links[interaction.user.id];
      if (!link || String(link.clubId) !== String(data.club?.clubId)) return interaction.reply({ content: 'Du hast für den aktuellen EA-Club noch kein Spielerprofil verknüpft.', flags: MessageFlags.Ephemeral });
      const members = await fetchMembers(interaction.guild);
      const ranking = aggregateRanking(data, new Set(members.map((member) => member.id)));
      const index = ranking.findIndex((row) => row.discordId === interaction.user.id);
      if (index < 0) return interaction.reply({ content: `**${link.playerName}** ist verknüpft, hat in dieser Woche aber noch keine gewerteten Spiele.`, flags: MessageFlags.Ephemeral });
      const row = ranking[index];
      return interaction.reply({
        content: [`**Deine Wochenwerte · Platz ${index + 1}**`, `EA-Profil: **${link.playerName}**`, `Punkte: **${points(row.points)}**`, `Spiele: **${row.matches}**`, `Punkte/Spiel: **${points(row.pointsPerGame)}**`, `Ø Rating: **${points(row.averageRating)}**`, `Tore: **${row.goals}** · Assists: **${row.assists}**`].join('\n'),
        flags: MessageFlags.Ephemeral,
      });
    }
  } catch (error) {
    console.error('[power-ranking] Interaction fehlgeschlagen:', error);
    const payload = { content: `Da ist etwas schiefgelaufen: ${error.message}`, flags: MessageFlags.Ephemeral };
    if (interaction.deferred || interaction.replied) return interaction.editReply({ content: payload.content, components: [] }).catch(() => null);
    return interaction.reply(payload).catch(() => null);
  }
}

module.exports = function installPowerRankingHook() {
  if (Client.prototype.__locoPowerRankingHookInstalled) return;
  Client.prototype.__locoPowerRankingHookInstalled = true;
  const originalLogin = Client.prototype.login;

  Client.prototype.login = function patchedLogin(...args) {
    const client = this;
    client.once(Events.ClientReady, async () => {
      try {
        store.load();
        const admin = await channel(client, CHANNELS.admin);
        const guild = admin?.guild;
        if (!guild) throw new Error('Admin-Panel-Kanal nicht erreichbar.');
        await archiveWeekIfNeeded(client, guild);
        await refreshPanels(client, guild);
        console.log('[power-ranking] Loco Power Ranking aktiv.');
      } catch (error) {
        console.error('[power-ranking] Start fehlgeschlagen:', error.message);
      }

      const pollTimer = setInterval(async () => {
        try {
          const data = store.load();
          if (!data.session) return;
          const admin = await channel(client, CHANNELS.admin);
          if (!admin?.guild) return;
          if (Date.now() - new Date(data.session.startedAt).getTime() >= MAX_SESSION_MS) {
            await stopSession(client, admin.guild, 'automatic_timeout');
            await admin.send({ content: '⏹️ Die Ranking-Wertung wurde nach 12 Stunden automatisch beendet.', allowedMentions: { parse: [] } });
            return;
          }
          await captureWindow(client, admin.guild, data.session);
        } catch (error) {
          console.error('[power-ranking] Automatische EA-Prüfung fehlgeschlagen:', error.message);
        }
      }, POLL_INTERVAL_MS);
      if (typeof pollTimer.unref === 'function') pollTimer.unref();

      const weekTimer = setInterval(async () => {
        try {
          const admin = await channel(client, CHANNELS.admin);
          if (admin?.guild) await archiveWeekIfNeeded(client, admin.guild);
        } catch (error) {
          console.error('[power-ranking] Wochenwechsel fehlgeschlagen:', error.message);
        }
      }, 60 * 1000);
      if (typeof weekTimer.unref === 'function') weekTimer.unref();
    });

    client.on(Events.InteractionCreate, (interaction) => handleInteraction(interaction, client));
    client.on(Events.GuildMemberUpdate, (oldMember, newMember) => {
      if (oldMember.roles.cache.has(LOCO_SQUAD_ROLE_ID) !== newMember.roles.cache.has(LOCO_SQUAD_ROLE_ID)) {
        setTimeout(() => refreshPanels(client, newMember.guild).catch(console.error), 1000);
      }
    });
    client.on(Events.GuildMemberRemove, (member) => {
      setTimeout(() => refreshPanels(client, member.guild).catch(console.error), 1000);
    });
    return originalLogin.apply(this, args);
  };
};

module.exports._test = {
  aggregateRanking,
  availablePlayers,
  matchTimestamp,
  parseMatch,
  weekKey,
};
