const { Client, Events, ChannelType, PermissionFlagsBits: P } = require('discord.js');

const FUN_CATEGORY_ID = '1494693879973417091';
const GTA_CATEGORY_NAME = '🌴︱𝙂𝙏𝘼-𝟲';
const ROLE_ID = '1567214152974475325';
const REASON = 'GTA-6-Kanäle in eigene Kategorie direkt unter Fun Gaming verschieben';
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
  const funCategory = await client.channels.fetch(FUN_CATEGORY_ID);
  if (!funCategory || funCategory.type !== ChannelType.GuildCategory) throw new Error('Fun-Gaming-Kategorie nicht gefunden');
  const guild = funCategory.guild;
  if (!await guild.roles.fetch(ROLE_ID)) throw new Error('GTA-6-Rolle nicht gefunden');
  await guild.channels.fetch();
  const me = guild.members.me || await guild.members.fetchMe();
  if (!me.permissions.has(P.ManageChannels)) throw new Error('Kanäle verwalten fehlt');

  const normalizeName = value => value.normalize('NFKC').toLowerCase();
  let category = guild.channels.cache.find(ch =>
    ch.type === ChannelType.GuildCategory && normalizeName(ch.name) === normalizeName(GTA_CATEGORY_NAME));
  if (!category) {
    category = await guild.channels.create({
      name: GTA_CATEGORY_NAME,
      type: ChannelType.GuildCategory,
      permissionOverwrites: [
        { id: guild.id, deny: [P.ViewChannel] },
        { id: ROLE_ID, allow: [P.ViewChannel, P.ReadMessageHistory, P.Connect, P.Speak] },
        { id: me.id, allow: [P.ViewChannel, P.ManageChannels, P.SendMessages, P.ReadMessageHistory, P.Connect, P.Speak] },
      ],
      reason: REASON,
    });
  }
  // Move only our category, leaving the relative order of all other categories intact.
  const categories = [...guild.channels.cache.values()]
    .filter(ch => ch.type === ChannelType.GuildCategory)
    .sort((a, b) => a.position - b.position || (BigInt(a.id) < BigInt(b.id) ? -1 : 1));
  if (categories[categories.findIndex(ch => ch.id === funCategory.id) + 1]?.id !== category.id) {
    const position = category.position < funCategory.position ? funCategory.position : funCategory.position + 1;
    await category.setPosition(position, { reason: REASON });
  }

  // Only the nine explicitly named GTA channels may be migrated.
  // Preserve their permission overwrites and messages. Never delete channels.
  for (const [name, type, readOnly, topic] of CHANNELS) {
    const normalize = value => value.normalize('NFKC').toLowerCase();
    const existing = guild.channels.cache.find(ch =>
      (ch.parentId === category.id || ch.parentId === FUN_CATEGORY_ID) && normalize(ch.name) === normalize(name));
    if (existing) {
      if (existing.type !== type) throw new Error('Kanalname mit anderem Typ belegt: ' + name);
      if (existing.parentId === FUN_CATEGORY_ID) {
        await existing.setParent(category.id, { lockPermissions: false, reason: REASON });
        console.log('[gta-setup] Verschoben: ' + existing.id + ' ' + existing.name);
      }
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
      name, type, parent: category.id, ...(topic ? { topic } : {}),
      permissionOverwrites: [
        { id: guild.id, deny: [P.ViewChannel] },
        { id: ROLE_ID, allow, deny },
        { id: me.id, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory, P.ManageChannels, P.Connect, P.Speak] },
      ],
      reason: REASON,
    });
    console.log('[gta-setup] Erstellt: ' + created.id + ' ' + created.name);
  }
  console.log('[gta-setup] Fertig. Nur GTA-Kanäle migriert; übrige Kanäle und deren relative Reihenfolge unverändert.');
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
