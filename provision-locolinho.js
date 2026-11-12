// Run once in the Secretary service: node provision-locolinho.js
require('dotenv').config({ quiet: true });
const { REST, Routes, ChannelType, PermissionFlagsBits } = require('discord.js');

const sourceId = '1544644642811936849';
const roleId = '1570482104788197409';
const statsId = '1570161388481945661';
const categoryName = '🏆 • Locolinho';
const channelNames = [
  '📢︱Ankündigungen', '💬︱Chat-Locolinho', '📋︱Kaderliste',
  '🔢︱Trikotnummer', '🧠︱Spielkonzept', '🎮︱Controller-Basics',
  '🏟️︱Club-Facilities', '📋︱Aufstellung-Liga',
  '📊︱Spielstatistiken-Locolinho', '📈︱Spieler-Formkurve',
  '🔥︱VPG-Germany', '🅿️︱ProLeague', '🦁︱RPL', '🇩🇪︱DCB',
  '🥇︱Liga-Ruhmeshalle', '⚡︱Loco-Linio-Power-Ranking',
  '👑︱Loco-Linio-der-Woche', '🎙️︱Liga Day',
  '🎙️︱Locolinho Talk / Chillzone', '🎙️︱Privat',
];

async function provision() {
  const token = process.env.DISCORD_TOKEN;
  if (!token) throw new Error('DISCORD_TOKEN is missing');
  const rest = new REST({ version: '10' }).setToken(token);
  const source = await rest.get(Routes.channel(sourceId));
  const guildId = source.guild_id;
  if (source.type !== ChannelType.GuildCategory || !guildId) {
    throw new Error('The source must be a guild category');
  }
  const route = Routes.guildChannels(guildId);
  const [roles, channels, bot] = await Promise.all([
    rest.get(Routes.guildRoles(guildId)),
    rest.get(route),
    rest.get(Routes.user('@me')),
  ]);
  if (!roles.some(role => role.id === roleId)) throw new Error('Locolinho role not found');

  const categories = channels.filter(channel =>
    channel.type === ChannelType.GuildCategory && channel.name === categoryName);
  if (categories.length > 1) throw new Error('Multiple matching Locolinho categories');

  const view = PermissionFlagsBits.ViewChannel.toString();
  const permissionOverwrites = [
    { id: guildId, type: 0, deny: view },
    { id: roleId, type: 0, allow: view },
    { id: bot.id, type: 1, allow: view },
  ];
  const stats = channels.find(channel => channel.id === statsId);
  if (!stats || stats.type !== ChannelType.GuildText || stats.parent_id === sourceId) {
    throw new Error('Expected existing Locolinho stats channel outside the source category');
  }

  const category = categories[0] ?? await rest.post(route, {
    body: { name: categoryName, type: ChannelType.GuildCategory, permission_overwrites: permissionOverwrites },
  });
  if (categories.length) {
    await rest.patch(Routes.channel(category.id), {
      body: { permission_overwrites: permissionOverwrites },
    });
  }
  const positions = [];
  for (const [position, label] of channelNames.entries()) {
    const type = position < 17 ? ChannelType.GuildText : ChannelType.GuildVoice;
    const name = type === ChannelType.GuildText ? label.toLowerCase() : label;
    const existing = position === 8 ? stats : channels.find(channel =>
      channel.parent_id === category.id && channel.type === type && channel.name === name);
    const channel = existing
      ? await rest.patch(Routes.channel(existing.id), {
        body: { name, parent_id: category.id, permission_overwrites: permissionOverwrites },
      })
      : await rest.post(route, {
        body: { name, type, parent_id: category.id, permission_overwrites: permissionOverwrites },
      });
    positions.push({ id: channel.id, position });
  }
  await rest.patch(route, { body: positions });
  console.log('Locolinho category %s provisioned with %s channels', category.id, positions.length);
}

provision().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
