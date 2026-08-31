const path = require('path');
const { Client, Events, EmbedBuilder, AttachmentBuilder } = require('discord.js');

const ROSTER_CHANNEL_ID = '1543944303607414865';
const LOCO_SQUAD_ROLE_ID = '1426495393742454834';
const ROSTER_TITLE = 'Aktuelle Kaderliste';
const ACCENT_COLOR = 0xe84a8a;
const ROSTER_BANNER_PATH = path.join(__dirname, 'assets', 'kaderliste-banner.png');
const ROSTER_BANNER_NAME = 'kaderliste-banner.png';

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
  LOCO_SQUAD_ROLE_ID,
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

async function buildRosterEmbed(guild) {
  const members = await loadGuildMembers(guild);
  const roster = Object.fromEntries(GROUPS.map((group) => [group.key, []]));

  const players = members
    .filter((member) => !member.user.bot && member.roles.cache.has(LOCO_SQUAD_ROLE_ID))
    .sort((a, b) => a.displayName.localeCompare(b.displayName, 'de'));

  for (const member of players) {
    const position = getMainPosition(member);
    const groupKey = position?.group || 'unassigned';
    roster[groupKey].push({
      member,
      position: position?.key || null,
    });
  }

  return new EmbedBuilder()
    .setColor(ACCENT_COLOR)
    .setTitle(ROSTER_TITLE)
    .setDescription([
      'Das ist unser aktueller Kader von **Loco Squad**.',
      'Die Liste aktualisiert sich automatisch anhand der **Loco-Squad-Rolle** und der jeweiligen **Hauptposition**.',
    ].join('\n'))
    .addFields(
      GROUPS.map((group) => ({
        name: `${group.title} (${roster[group.key].length})`,
        value: formatMembers(roster[group.key]),
      }))
    )
    .setImage(`attachment://${ROSTER_BANNER_NAME}`)
    .setFooter({ text: `${players.length} Mitglieder mit der Rolle Loco Squad` })
    .setTimestamp();
}

async function refreshRoster(client, guild) {
  const channel = client.channels.cache.get(ROSTER_CHANNEL_ID)
    || await client.channels.fetch(ROSTER_CHANNEL_ID).catch(() => null);

  if (!channel?.isTextBased()) {
    console.error('[roster] Kaderlisten-Kanal nicht erreichbar:', ROSTER_CHANNEL_ID);
    return;
  }

  const embed = await buildRosterEmbed(guild);
  const banner = new AttachmentBuilder(ROSTER_BANNER_PATH, { name: ROSTER_BANNER_NAME });
  const messages = await channel.messages.fetch({ limit: 30 });
  const existing = [...messages.values()].find((message) =>
    message.author?.id === client.user.id &&
    message.embeds?.[0]?.title === ROSTER_TITLE
  );

  const payload = {
    embeds: [embed],
    allowedMentions: { parse: [] },
    files: [banner],
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

function scheduleRosterRefresh(client, guild) {
  const previousTimer = updateTimers.get(guild.id);
  if (previousTimer) clearTimeout(previousTimer);

  const timer = setTimeout(async () => {
    updateTimers.delete(guild.id);
    try {
      await refreshRoster(client, guild);
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
        const channel = client.channels.cache.get(ROSTER_CHANNEL_ID)
          || await client.channels.fetch(ROSTER_CHANNEL_ID).catch(() => null);
        if (channel?.guild) {
          await refreshRoster(client, channel.guild);
          console.log('[roster] Automatische Loco-Kaderliste aktiv.');
        }
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
