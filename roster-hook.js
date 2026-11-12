const path = require('path');
const { Client, Events, EmbedBuilder, AttachmentBuilder } = require('discord.js');

const ROSTER_TITLE = 'Aktuelle Kaderliste';
const ACCENT_COLOR = 0xe84a8a;
const ROSTER_BANNER_PATH = path.join(__dirname, 'assets', 'kaderliste-banner.png');
const ROSTER_BANNER_NAME = 'kaderliste-banner.png';

const ROSTERS = [
  {
    channelId: '1543944303607414865',
    roleId: '1426495393742454834',
    clubName: 'Loco Squad',
    roleLabel: 'Loco-Squad-Rolle',
    banner: true,
  },
  {
    channelId: '1570488474052595762',
    roleId: '1570482104788197409',
    clubName: 'Locolinho',
    roleLabel: 'Locolinho-Rolle',
  },
];

const HP_POSITIONS = [
  { key: 'TW', roleId: '1486360144785834114', group: 'goalkeeper' },
  { key: 'AIV', roleId: '1486360230857019443', group: 'defense' },
  { key: 'IV', roleId: '1486360317264003142', group: 'defense' },
  { key: 'ZDM', roleId: '1486360379394359417', group: 'midfield' },
  { key: 'ZOM', roleId: '1486381628476493944', group: 'midfield' },
  { key: 'LM/RM', roleId: '1486360560466530396', group: 'midfield' },
  { key: 'ST', roleId: '1486360695900606625', group: 'attack' },
];

const GROUPS = [
  { key: 'goalkeeper', title: '🧤 Torwart' },
  { key: 'defense', title: '🛡️ Verteidigung' },
  { key: 'midfield', title: '⚙️ Mittelfeld' },
  { key: 'attack', title: '⚽ Sturm' },
  { key: 'unassigned', title: '❓ Keine Hauptposition' },
];

const RELEVANT_ROLE_IDS = new Set([
  ...ROSTERS.map((roster) => roster.roleId),
  ...HP_POSITIONS.map((position) => position.roleId),
]);

const updateTimers = new Map();

function getMainPosition(member) {
  return HP_POSITIONS.find((position) => member.roles.cache.has(position.roleId)) || null;
}

function formatMembers(entries) {
  if (entries.length === 0) return '*Aktuell nicht besetzt*';

  return entries
    .sort((a, b) => {
      const positionA = HP_POSITIONS.findIndex((position) => position.key === a.position);
      const positionB = HP_POSITIONS.findIndex((position) => position.key === b.position);
      if (positionA !== positionB) return positionA - positionB;
      return a.member.displayName.localeCompare(b.member.displayName, 'de');
    })
    .map(({ member, position }) => `• <@${member.id}>${position ? ` **(${position})**` : ''}`)
    .join('\n');
}

async function loadGuildMembers(guild) {
  try {
    await guild.members.list({ limit: 1000 });
  } catch (error) {
    console.error('[roster] Mitgliederliste konnte nicht vollständig geladen werden:', error.message);
  }

  return [...guild.members.cache.values()];
}

function buildRosterEmbed(members, config) {
  const roster = Object.fromEntries(GROUPS.map((group) => [group.key, []]));

  const players = members
    .filter((member) => !member.user.bot && member.roles.cache.has(config.roleId))
    .sort((a, b) => a.displayName.localeCompare(b.displayName, 'de'));

  for (const member of players) {
    const position = getMainPosition(member);
    const groupKey = position?.group || 'unassigned';
    roster[groupKey].push({
      member,
      position: position?.key || null,
    });
  }

  const embed = new EmbedBuilder()
    .setColor(ACCENT_COLOR)
    .setTitle(ROSTER_TITLE)
    .setDescription([
      `Das ist unser aktueller Kader von **${config.clubName}**.`,
      `Die Liste aktualisiert sich automatisch anhand der **${config.roleLabel}** und der jeweiligen **Hauptposition**.`,
    ].join('\n'))
    .addFields(
      GROUPS.map((group) => ({
        name: `${group.title} (${roster[group.key].length})`,
        value: formatMembers(roster[group.key]),
      }))
    )
    .setFooter({ text: `${players.length} Mitglieder mit der Rolle ${config.clubName}` })
    .setTimestamp();

  if (config.banner) embed.setImage(`attachment://${ROSTER_BANNER_NAME}`);
  return embed;
}

async function resolveRosterChannel(client, config) {
  const channel = client.channels.cache.get(config.channelId)
    || await client.channels.fetch(config.channelId).catch(() => null);
  if (channel?.guild && channel.isTextBased()) return channel;

  console.error('[roster] Kaderlisten-Kanal nicht erreichbar:', config.channelId);
  return null;
}

async function refreshRoster(client, channel, members, config) {
  const embed = buildRosterEmbed(members, config);
  const messages = await channel.messages.fetch({ limit: 30 });
  const existing = [...messages.values()].find((message) =>
    message.author?.id === client.user.id &&
    message.embeds?.[0]?.title === ROSTER_TITLE
  );

  const payload = {
    embeds: [embed],
    allowedMentions: { parse: [] },
    files: config.banner
      ? [new AttachmentBuilder(ROSTER_BANNER_PATH, { name: ROSTER_BANNER_NAME })]
      : [],
  };

  if (existing) {
    await existing.edit({
      ...payload,
      attachments: [],
    });
  } else {
    await channel.send(payload);
  }
}

const refreshes = new Map();

function refreshGuildRosters(client, guild) {
  const previous = refreshes.get(guild.id) || Promise.resolve();
  const refresh = previous.catch(() => {}).then(async () => {
    const channels = await Promise.all(ROSTERS.map((config) => resolveRosterChannel(client, config)));
    const targets = ROSTERS.map((config, index) => ({ config, channel: channels[index] }))
      .filter(({ channel }) => channel?.guild.id === guild.id);
    if (!targets.length) return;

    const members = await loadGuildMembers(guild);
    await Promise.all(targets.map(async ({ config, channel }) => {
      try {
        await refreshRoster(client, channel, members, config);
      } catch (error) {
        console.error(`[roster] Aktualisierung für ${config.clubName} fehlgeschlagen:`, error.message);
      }
    }));
  }).finally(() => {
    if (refreshes.get(guild.id) === refresh) refreshes.delete(guild.id);
  });

  refreshes.set(guild.id, refresh);
  return refresh;
}

function scheduleRosterRefresh(client, guild) {
  const previousTimer = updateTimers.get(guild.id);
  if (previousTimer) clearTimeout(previousTimer);

  const timer = setTimeout(async () => {
    updateTimers.delete(guild.id);
    try {
      await refreshGuildRosters(client, guild);
    } catch (error) {
      console.error('[roster] Aktualisierung fehlgeschlagen:', error.message);
    }
  }, 1000);

  updateTimers.set(guild.id, timer);
}

function relevantRolesSignature(member) {
  return [...member.roles.cache.values()]
    .filter((role) => RELEVANT_ROLE_IDS.has(role.id))
    .map((role) => role.id)
    .sort()
    .join(',');
}

module.exports = function installRosterHook() {
  if (Client.prototype.__locoRosterHookInstalled) return;
  Client.prototype.__locoRosterHookInstalled = true;

  const originalLogin = Client.prototype.login;

  Client.prototype.login = function patchedLogin(...args) {
    const client = this;

    client.once(Events.ClientReady, async () => {
      try {
        const channels = await Promise.all(ROSTERS.map((config) => resolveRosterChannel(client, config)));
        const guilds = new Map(channels.filter(Boolean).map(({ guild }) => [guild.id, guild]));
        await Promise.all([...guilds.values()].map((guild) => refreshGuildRosters(client, guild)));
      } catch (error) {
        console.error('[roster] Start fehlgeschlagen:', error.message);
      }
    });

    client.on(Events.GuildMemberUpdate, (oldMember, newMember) => {
      if (relevantRolesSignature(oldMember) !== relevantRolesSignature(newMember)) {
        scheduleRosterRefresh(client, newMember.guild);
      }
    });

    client.on(Events.GuildMemberRemove, (member) => {
      scheduleRosterRefresh(client, member.guild);
    });

    client.on(Events.GuildMemberAdd, (member) => {
      scheduleRosterRefresh(client, member.guild);
    });

    return originalLogin.apply(this, args);
  };
};
