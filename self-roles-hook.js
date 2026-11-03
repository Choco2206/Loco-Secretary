const {
  Client, Events, ChannelType, PermissionFlagsBits: P, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags,
} = require('discord.js');

const CHANNEL_ID = '1567217317593616474';
const TITLE = 'Wähle deine Bereiche';
const PREFIX = 'loco_self_role:';
const CHOICES = [
  { key: 'tcup', label: 'T-Cup', emoji: '🏆', id: '1482531092488654978' },
  { key: 'fun', label: 'Fun Gaming', emoji: '🎮', name: 'fungaming' },
  { key: 'gta', label: 'GTA 6', emoji: '🌴', id: '1567214152974475325' },
];
const locks = new Set();
const normalize = name => name.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]/g, '');

function findRole(guild, choice) {
  if (choice.id) return guild.roles.cache.get(choice.id) || null;
  const matches = [...guild.roles.cache.values()].filter(role => normalize(role.name) === choice.name);
  return matches.length === 1 ? matches[0] : null;
}

function canAssign(role, me) {
  const privileged = [P.Administrator, P.ManageGuild, P.ManageRoles, P.ManageChannels, P.KickMembers, P.BanMembers, P.ModerateMembers];
  return role && role.id !== role.guild.id && !role.managed &&
    me.permissions.has(P.ManageRoles) && role.position < me.roles.highest.position &&
    !privileged.some(permission => role.permissions.has(permission));
}

async function setup(client) {
  const channel = await client.channels.fetch(CHANNEL_ID);
  if (!channel || channel.type !== ChannelType.GuildText) throw new Error('Rollenauswahl-Textkanal nicht gefunden');
  await channel.guild.roles.fetch();
  const me = channel.guild.members.me || await channel.guild.members.fetchMe();
  // Missing channel-management permissions must not prevent posting the panel.
  async function optionalStep(label, action) {
    try { await action(); }
    catch (error) {
      if (Number(error.code) !== 50013 && Number(error.code) !== 50001) throw error;
      console.warn('[self-roles] ' + label + ': ' + error.message +
        '. Bitte Loco Secretary im Auswahlkanal die nötigen Rechte geben.');
    }
  }
  if (channel.name !== '🎭︱𝙍𝙤𝙡𝙡𝙚𝙣𝙖𝙪𝙨𝙬𝙖𝙝𝙡') {
    await optionalStep('Kanal umbenennen (Kanäle verwalten fehlt)', () =>
      channel.setName('🎭︱𝙍𝙤𝙡𝙡𝙚𝙣𝙖𝙪𝙨𝙬𝙖𝙝𝙡', 'Rollenauswahl im Loco-Schriftstil'));
  }
  // Only this selection channel is changed. Parent and position stay untouched.
  await optionalStep('Kanalrechte setzen (Rollen verwalten fehlt)', () =>
    channel.permissionOverwrites.edit(channel.guild.id, {
      ViewChannel: true, ReadMessageHistory: true, SendMessages: false,
      SendMessagesInThreads: false, CreatePublicThreads: false, CreatePrivateThreads: false,
    }));
  await optionalStep('Bot-Kanalrechte setzen (Rollen verwalten fehlt)', () =>
    channel.permissionOverwrites.edit(me.id, {
      ViewChannel: true, ReadMessageHistory: true, SendMessages: true, EmbedLinks: true,
    }));
  const effective = channel.permissionsFor(me);
  const required = [
    ['Kanal ansehen', P.ViewChannel], ['Nachrichtenverlauf anzeigen', P.ReadMessageHistory],
    ['Nachrichten senden', P.SendMessages], ['Links einbetten', P.EmbedLinks],
  ];
  const missing = required.filter(([, permission]) => !effective?.has(permission));
  if (missing.length) throw new Error('Im Rollenauswahl-Kanal fehlen: ' + missing.map(([label]) => label).join(', '));
  if (!me.permissions.has(P.ManageRoles)) console.warn('[self-roles] Rollen verwalten fehlt. Rollenbuttons bleiben deaktiviert.');
  const row = new ActionRowBuilder().addComponents(CHOICES.map(choice => {
    const role = findRole(channel.guild, choice);
    const available = canAssign(role, me);
    if (!available) console.error('[self-roles] Rolle fehlt, ist nicht eindeutig oder nicht zuweisbar: ' + choice.label);
    return new ButtonBuilder().setCustomId(PREFIX + choice.key).setLabel(choice.label)
      .setEmoji(choice.emoji).setStyle(ButtonStyle.Secondary).setDisabled(!available);
  }));
  const embed = new EmbedBuilder().setColor(0xe84a8a).setTitle(TITLE)
    .setDescription('Schalte dir die Bereiche frei, die dich interessieren. Du kannst mehrere Rollen auswählen.\n\n🏆 **T-Cup**\n🎮 **Fun Gaming**\n🌴 **GTA 6**\n\n**Button drücken:** Rolle erhalten.\n**Erneut drücken:** Rolle entfernen.')
    .setFooter({ text: 'LOCO SQUAD • Deine Bereiche, deine Wahl' });
  const messages = await channel.messages.fetch({ limit: 100 }).catch(error => {
    throw new Error('Rollenauswahl-Nachrichten lesen: ' + error.message);
  });
  const existing = messages.find(message => message.author.id === client.user.id &&
    (message.embeds.some(item => item.title === TITLE) ||
     message.components.some(action => action.components.some(button => button.customId?.startsWith(PREFIX)))));
  const payload = { embeds: [embed], components: [row], allowedMentions: { parse: [] } };
  try {
    if (existing) await existing.edit(payload);
    else await channel.send(payload);
  } catch (error) { throw new Error('Rollenauswahl-Panel senden: ' + error.message); }
  console.log('[self-roles] Rollenauswahl bereit: ' + channel.id);
}

async function handle(interaction) {
  if (!interaction.isButton() || !interaction.customId.startsWith(PREFIX)) return;
  if (interaction.channelId !== CHANNEL_ID || !interaction.inGuild()) return;
  const choice = CHOICES.find(item => PREFIX + item.key === interaction.customId);
  if (!choice) return;
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const lock = interaction.guildId + ':' + interaction.user.id;
  if (locks.has(lock)) {
    await interaction.editReply('Deine vorherige Auswahl wird noch verarbeitet. Bitte kurz warten.');
    return;
  }
  locks.add(lock);
  try {
    await interaction.guild.roles.fetch();
    const role = findRole(interaction.guild, choice);
    const me = interaction.guild.members.me || await interaction.guild.members.fetchMe();
    if (!canAssign(role, me)) {
      await interaction.editReply('Diese Rolle kann ich gerade nicht vergeben. Bitte melde dich bei einem Admin.');
      return;
    }
    const member = await interaction.guild.members.fetch({ user: interaction.user.id, force: true });
    const hasRole = member.roles.cache.has(role.id);
    if (hasRole) await member.roles.remove(role, 'Selbstauswahl durch Mitglied');
    else await member.roles.add(role, 'Selbstauswahl durch Mitglied');
    await interaction.editReply(hasRole
      ? 'Die Rolle **' + choice.label + '** wurde entfernt.'
      : 'Du hast jetzt die Rolle **' + choice.label + '**. Die zugehörigen Bereiche sind für dich freigeschaltet.');
  } finally {
    locks.delete(lock);
  }
}

module.exports = function installSelfRolesHook() {
  if (Client.prototype.__locoSelfRolesInstalled) return;
  Client.prototype.__locoSelfRolesInstalled = true;
  const originalLogin = Client.prototype.login;
  Client.prototype.login = function (...args) {
    this.once(Events.ClientReady, () => setup(this).catch(error => console.error('[self-roles] Setup:', error.message)));
    this.on(Events.InteractionCreate, interaction => {
      handle(interaction).catch(async error => {
        console.error('[self-roles] Auswahl:', error.message);
        const payload = { content: 'Die Rolle konnte gerade nicht geändert werden. Bitte versuche es erneut oder melde dich bei einem Admin.', allowedMentions: { parse: [] } };
        try {
          if (interaction.deferred || interaction.replied) await interaction.editReply(payload);
          else await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral });
        } catch (replyError) { console.error('[self-roles] Antwort:', replyError.message); }
      });
    });
    return originalLogin.apply(this, args);
  };
};
