const { Client, Events, ChannelType, PermissionFlagsBits: P } = require('discord.js');

const CATEGORY_ID = '1494693879973417091';
const ROLE_ID = '1567214152974475325';
const REASON = 'GTA-6-Bereich unter Fun Gaming ergänzen, bestehende Kanäle unverändert lassen';
const CHANNELS = [
  ['📢︱𝙂𝙏𝘼-𝙉𝙚𝙬𝙨', ChannelType.GuildText, true, 'Bestätigte GTA-6-News, Trailer und Informationen.'],
  ['💬︱𝙂𝙏𝘼-𝙏𝙖𝙡𝙠', ChannelType.GuildText, false, 'Austausch zu GTA 6. Story-Spoiler bitte verdeckt posten.'],
  ['👥︱𝙇𝙤𝙘𝙤-𝘾𝙧𝙚𝙬', ChannelType.GuildText, false, 'Unsere Loco Crew: Mitspieler, Plattformen und Spielernamen.'],
  ['📅︱𝙂𝙏𝘼-𝘼𝙗𝙚𝙣𝙙𝙚', ChannelType.GuildText, false, 'Verabredungen, Umfragen und gemeinsame GTA-Abende.'],
  ['📸︱𝘾𝙡𝙞𝙥𝙨-𝙪𝙣𝙙-𝘽𝙞𝙡𝙙𝙚𝙧', ChannelType.GuildText, false, 'Eure Clips, Screenshots und Highlights.'],
  ['💡︱𝙏𝙞𝙥𝙥𝙨-𝙪𝙣𝙙-𝙂𝙪𝙞𝙙𝙚𝙨', ChannelType.GuildText, false, 'Hilfreiche Tipps, Anleitungen und Entdeckungen.'],
  ['🏆︱𝘾𝙧𝙚𝙬-𝙍𝙖𝙣𝙠𝙞𝙣𝙜', ChannelType.GuildText, true, 'Platz für Ergebnisse und Ranglisten unserer eigenen Crew-Events.'],
  ['🔊︱𝙂𝙏𝘼-𝙇𝙤𝙪𝙣𝙜𝙚', ChannelType.GuildVoice, false],
  ['🎮︱𝙂𝙏𝘼-𝙎𝙚𝙨𝙨𝙞𝙤𝙣', ChannelType.GuildVoice, false],
];

async function ensureGtaChannels(client) {
  const category = await client.channels.fetch(CATEGORY_ID);
  if (!category || category.type !== ChannelType.GuildCategory) throw new Error('Fun-Gaming-Kategorie nicht gefunden');
  const guild = category.guild;
  if (!await guild.roles.fetch(ROLE_ID)) throw new Error('GTA-6-Rolle nicht gefunden');
  await guild.channels.fetch();
  const me = guild.members.me || await guild.members.fetchMe();
  if (!category.permissionsFor(me)?.has(P.ManageChannels)) throw new Error('Kanäle verwalten fehlt');

  // Never edit, reparent, rename, reorder or change permissions on an existing channel.
  // No position or setPositions calls: Discord appends new children within their type.
  for (const [name, type, readOnly, topic] of CHANNELS) {
    const normalize = value => value.normalize('NFKC').toLowerCase();
    const existing = guild.channels.cache.find(ch =>
      ch.parentId === CATEGORY_ID && normalize(ch.name) === normalize(name));
    if (existing) {
      if (existing.type !== type) throw new Error('Kanalname mit anderem Typ belegt: ' + name);
      console.log('[gta-setup] Bereits vorhanden, unverändert: ' + existing.id + ' ' + existing.name);
      continue;
    }
    const allow = [P.ViewChannel, P.ReadMessageHistory, P.AddReactions, P.UseExternalEmojis];
    const deny = [];
    if (readOnly) {
      deny.push(P.SendMessages, P.SendMessagesInThreads, P.CreatePublicThreads, P.CreatePrivateThreads, P.SendPolls);
    } else {
      allow.push(P.SendMessages, P.SendMessagesInThreads, P.AttachFiles, P.EmbedLinks, P.SendPolls);
    }
    if (type === ChannelType.GuildVoice) allow.push(P.Connect, P.Speak, P.Stream, P.UseVAD);
    const created = await guild.channels.create({
      name, type, parent: CATEGORY_ID, ...(topic ? { topic } : {}),
      permissionOverwrites: [
        { id: guild.id, deny: [P.ViewChannel] },
        { id: ROLE_ID, allow, deny },
        { id: me.id, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory, P.ManageChannels, P.Connect, P.Speak] },
      ],
      reason: REASON,
    });
    console.log('[gta-setup] Erstellt: ' + created.id + ' ' + created.name);
  }
  console.log('[gta-setup] Fertig. Keine bestehenden Kanäle bearbeitet oder umsortiert.');
}

module.exports = function installGtaChannelsHook() {
  if (Client.prototype.__locoGtaChannelsHookInstalled) return;
  Client.prototype.__locoGtaChannelsHookInstalled = true;
  const originalLogin = Client.prototype.login;
  Client.prototype.login = function (...args) {
    this.once(Events.ClientReady, () => {
      ensureGtaChannels(this).catch(error => console.error('[gta-setup] Fehler:', error.message));
    });
    return originalLogin.apply(this, args);
  };
};
