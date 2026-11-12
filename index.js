require('dotenv').config();

const {
  Client,
  GatewayIntentBits,
  Partials,
  AuditLogEvent,
  Events,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  MessageFlags,
  ChannelType,
  PermissionFlagsBits,
} = require('discord.js');

const roleAnnouncementData = require('./data/roleAnnouncement.json');

const POSITION_ORDER = ['TW', 'AIV', 'IV', 'ZDM', 'ZOM', 'LMRM', 'ST'];

const POSITION_LABELS = {
  TW: 'TW',
  AIV: 'AIV',
  IV: 'IV',
  ZDM: 'ZDM',
  ZOM: 'ZOM',
  LMRM: 'LM/RM',
  ST: 'ST',
};

const CONFIG = {
  locoVoteBotId: '1478770226651992134',
  ownerUserId: '1425580097661833443',

  channels: {
    welcome: '1426178803960516742',
    goodbye: '1426178916455944242',
    announcements: '1426178139234631700',
    positions: '1439254263112011787',
  },

  roles: {
    locoSquad: '1426495393742454834',
    tCup: '1482531092488654978',
    tester: '1426495653751816284',
    aushilfen: '1433124858102812692',

    hpPositions: {
      TW: '1486360144785834114',
      AIV: '1486360230857019443',
      IV: '1486360317264003142',
      ZDM: '1486360379394359417',
      ZOM: '1486381628476493944',
      LMRM: '1486360560466530396',
      ST: '1486360695900606625',
    },

    npPositions: {
      TW: '1486360825542348931',
      AIV: '1486360894568009831',
      IV: '1486360958480945335',
      ZDM: '1486361416830025788',
      ZOM: '1486381783824994374',
      LMRM: '1486362463409668127',
      ST: '1486362611753685103',
    },
  },

  branding: {
    accentColor: 0xe84a8a,
    footer: 'Loco Secretary • cute, organized & a little dangerous',
  },

  welcome: {
    enabled: true,
    message: (member) => `${member} 🔥

🐺 **A new cutie joined the pack…**

Na schau mal an... frischer Wind im Rudel.  
Willkommen bei **LOCO SQUAD** 🔴⚫  

Und nur damit du direkt weißt, worauf du dich hier eingelassen hast, Süßer:  
**„Loco“ heißt bei uns chaotisch, ehrgeizig, laut, loyal – aber am Ende immer ein Rudel, das zusammenhält.** 💋  

**Bevor du loslegst:**

→ Wähle zuerst deine **Hauptposition + Nebenpositionen** in <#1439254263112011787>  
→ Lies dir kurz <#1426178300522532935> durch  
→ Check regelmäßig <#1426178139234631700> für wichtige News  

Wenn du Fragen hast, melde dich bei <@1425580097661833443>  
oder schreib einfach in **💬│chat**.

📱 **Außerhalb von Discord findest du uns auch hier:**

👉 Instagram: https://www.instagram.com/locosquad.fc/?hl=de  
👉 TikTok: https://www.tiktok.com/@loco.squad.esports  

Also benehm dich, bring Präsenz mit  
und zeig, dass du nicht nur cute gejoint bist, sondern auch ins Rudel passt. 😏🐺  

**#WeAreLoco**  
**#JoinThePack**`,
  },

  goodbye: {
    enabled: true,
    leaveVariants: [
      {
        title: '🐺 Looks like someone left the pack…',
        description: (userText) => `${userText}

Hm… sieht so aus, als hätte sich jemand aus dem Rudel geschlichen.

Vielleicht war es zu **loco**,  
zu laut  
oder einfach ein bisschen zu chaotisch hier. 😏

So oder so – wir wünschen dir trotzdem alles Gute auf deinem Weg.

Das Rudel zieht weiter.  
Und bei Loco bleibt es… nun ja… **interessant.** 🔴⚫

**#WeAreLoco**`,
      },
      {
        title: '👋 The pack moves on',
        description: (userText) => `${userText}

Manche Wege trennen sich eben wieder.

Wir wünschen dir trotzdem alles Gute  
und das Rudel zieht weiter – wie immer mit Fokus nach vorne. 🔴⚫`,
      },
    ],
    kickVariants: [
      {
        title: '🚪 The pack just made a decision',
        description: (userText) => `${userText}

Manchmal passt jemand einfach nicht mehr so richtig ins Rudel.

Deshalb wurde entschieden,  
dass sich unsere Wege hier trennen.

Keine großen Dramen –  
nur ein bisschen **Loco Ordnung im Chaos.** 🔴⚫

Das Rudel bleibt fokussiert.`,
      },
      {
        title: '🚪 Removed from the pack',
        description: (userText) => `${userText}

Hier wurde gerade eine klare Entscheidung getroffen.

Das Rudel zieht weiter –  
mit Struktur, Fokus und ohne unnötiges Theater. 🔴⚫`,
      },
    ],
    banVariants: [
      {
        title: '⛔ Someone pushed it a little too far…',
        description: (userText) => `${userText}

Tja… manche lernen es auf die charmante Art,  
andere leider nicht.

Deshalb wurde hier gerade ein **Ticket aus dem Loco-Universum gelöst.**

Das Rudel bleibt,  
der Fokus bleibt  
und das Chaos bleibt…

nur eben **ohne diese Person.** 🔴⚫`,
      },
      {
        title: '⛔ Banned from the Loco universe',
        description: (userText) => `${userText}

Hier war die Grenze dann wohl endgültig erreicht.

Rudel, Fokus und Ordnung bleiben bestehen –  
nur eben ohne diesen Part der Geschichte. 🔴⚫`,
      },
    ],
  },

  roleAnnouncement: {
    enabled: true,
    batchWindowMs: 10_000,
  },

  positionPanel: {
    enabled: true,
    title: '📍 Loco Positionen',
  },

  squadChannels: {
    enabled: true,
    categoryName: '🏆・Loco Squad',
    roles: [
      { id: '1426495393742454834', names: ['Loco Squad'] },
    ],
    channels: [
      '📋・Aufstellung',
      '🏟️・Club-Facilities',
      '🥇・Liga-Ruhmeshalle',
    ],
  },

  cupChannels: {
    enabled: true,
    categoryName: '🏆・Cups',
    roles: [
      { id: '1426495393742454834', names: ['Loco Squad'] },
      { id: '1482531092488654978', names: ['T-Cup', 'T Cup', 'TCup'] },
    ],
    channels: [
      '📋・Aufstellung',
      '🏟️・Club-Facilities',
      '🏆・Cup-Ruhmeshalle',
    ],
  },

  voiceChannels: [
    {
      name: 'Liga D',
      roles: [
        { id: '1426495393742454834', names: ['Loco Squad'] },
      ],
    },
    {
      name: 'Loco Talk / Chillzone',
      roles: [
        { id: '1426495393742454834', names: ['Loco Squad'] },
      ],
    },
    {
      name: 'Cup Talk',
      roles: [
        { id: '1426495393742454834', names: ['Loco Squad'] },
        { id: '1482531092488654978', names: ['T-Cup', 'T Cup', 'TCup'] },
      ],
    },
  ],
};

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildModeration,
  ],
  partials: [Partials.GuildMember, Partials.User, Partials.Message, Partials.Channel],
});

const recentBanIds = new Set();
const pendingRoleAnnouncements = new Map();
const roleAnnouncementTimers = new Map();

function getChannel(channelId) {
  if (!channelId) return null;
  return client.channels.cache.get(channelId) ?? null;
}

function pickRandom(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function buildEmbed(title, description) {
  return new EmbedBuilder()
    .setColor(CONFIG.branding.accentColor)
    .setTitle(title)
    .setDescription(description)
    .setFooter({ text: CONFIG.branding.footer })
    .setTimestamp();
}

async function safeSend(channelId, payload, label = 'unknown') {
  try {
    const channel = getChannel(channelId);
    if (!channel || !channel.isTextBased()) return null;
    return await channel.send(payload);
  } catch (error) {
    console.error(`[${label}] Send error:`, error.message);
    return null;
  }
}

/* -------------------- GESCHÜTZTE TEAM-KANÄLE -------------------- */

function readOnlyCategoryPermissions(guild, roleIds) {
  const readOnlyPermissions = {
    allow: [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.ReadMessageHistory,
      PermissionFlagsBits.AddReactions,
      PermissionFlagsBits.UseExternalEmojis,
      PermissionFlagsBits.UseExternalStickers,
    ],
    deny: [
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.SendMessagesInThreads,
      PermissionFlagsBits.AttachFiles,
      PermissionFlagsBits.EmbedLinks,
      PermissionFlagsBits.CreatePublicThreads,
      PermissionFlagsBits.CreatePrivateThreads,
      PermissionFlagsBits.MentionEveryone,
      PermissionFlagsBits.SendVoiceMessages,
      PermissionFlagsBits.SendPolls,
    ],
  };

  return [
    {
      id: guild.roles.everyone.id,
      deny: [PermissionFlagsBits.ViewChannel],
    },
    ...roleIds.map((roleId) => ({ id: roleId, ...readOnlyPermissions })),
  ];
}

async function ensureReadOnlyChannelArea(guild, areaConfig) {
  try {
    let category = guild.channels.cache.find(
      (channel) =>
        channel.type === ChannelType.GuildCategory &&
        channel.name === areaConfig.categoryName
    );

    const permissionOverwrites = readOnlyCategoryPermissions(guild, areaConfig.resolvedRoleIds);

    if (!category) {
      try {
        category = await guild.channels.create({
          name: areaConfig.categoryName,
          type: ChannelType.GuildCategory,
          permissionOverwrites,
          reason: 'Geschützten Loco-Bereich eingerichtet',
        });
      } catch (error) {
        throw new Error(`Kategorie konnte nicht erstellt werden: ${error.message}`);
      }
      console.log(`[protectedChannels] Kategorie ${category.name} erstellt.`);
    } else {
      try {
        await category.permissionOverwrites.set(
          permissionOverwrites,
          'Berechtigungen des geschützten Loco-Bereichs aktualisiert'
        );
      } catch (error) {
        throw new Error(`Kategorieberechtigungen konnten nicht gesetzt werden: ${error.message}`);
      }
      console.log(`[protectedChannels] Berechtigungen für ${category.name} aktualisiert.`);
    }

    for (const channelName of areaConfig.channels) {
      const existing = guild.channels.cache.find(
        (channel) =>
          channel.type === ChannelType.GuildText &&
          channel.parentId === category.id &&
          channel.name === channelName
      );

      if (existing) {
        if (!existing.permissionsLocked) {
          try {
            await existing.lockPermissions();
          } catch (error) {
            throw new Error(`Berechtigungen für ${channelName} konnten nicht synchronisiert werden: ${error.message}`);
          }
        }
        continue;
      }

      try {
        await guild.channels.create({
          name: channelName,
          type: ChannelType.GuildText,
          parent: category.id,
          reason: 'Geschützten Loco-Bereich eingerichtet',
        });
      } catch (error) {
        throw new Error(`Kanal ${channelName} konnte nicht erstellt werden: ${error.message}`);
      }
      console.log(`[protectedChannels] Kanal ${channelName} erstellt.`);
    }
  } catch (error) {
    console.error(`[protectedChannels] ${areaConfig.categoryName} fehlgeschlagen:`, error.message);
  }
}

function normalizeRoleName(name) {
  return name.toLocaleLowerCase('de').replace(/[^a-z0-9]/g, '');
}

function resolveAreaRoles(guild, roleConfigs) {
  return roleConfigs.map((roleConfig) => {
    const roleById = guild.roles.cache.get(roleConfig.id);
    if (roleById) return roleById;

    const wantedNames = new Set(roleConfig.names.map(normalizeRoleName));
    return guild.roles.cache.find((role) => wantedNames.has(normalizeRoleName(role.name))) || null;
  });
}

function voiceChannelPermissions(guild, roleIds) {
  const voiceAndChatPermissions = {
    allow: [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.Connect,
      PermissionFlagsBits.Speak,
      PermissionFlagsBits.Stream,
      PermissionFlagsBits.UseVAD,
      PermissionFlagsBits.UseEmbeddedActivities,
      PermissionFlagsBits.UseSoundboard,
      PermissionFlagsBits.UseExternalSounds,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.ReadMessageHistory,
      PermissionFlagsBits.AttachFiles,
      PermissionFlagsBits.EmbedLinks,
      PermissionFlagsBits.AddReactions,
      PermissionFlagsBits.UseExternalEmojis,
      PermissionFlagsBits.UseExternalStickers,
      PermissionFlagsBits.SendVoiceMessages,
      PermissionFlagsBits.SendPolls,
    ],
  };

  return [
    {
      id: guild.roles.everyone.id,
      deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect],
    },
    ...roleIds.map((roleId) => ({ id: roleId, ...voiceAndChatPermissions })),
  ];
}

async function ensureVoiceChannels(guild) {
  for (const voiceConfig of CONFIG.voiceChannels) {
    const resolvedRoles = resolveAreaRoles(guild, voiceConfig.roles);
    const missingRoles = voiceConfig.roles.filter((roleConfig, index) => !resolvedRoles[index]);

    if (missingRoles.length > 0) {
      console.error(
        `[voiceChannels] ${voiceConfig.name} nicht erstellt: Rollen fehlen (` +
        `${missingRoles.map((role) => role.names[0]).join(', ')}).`
      );
      continue;
    }

    const permissionOverwrites = voiceChannelPermissions(
      guild,
      resolvedRoles.map((role) => role.id)
    );

    try {
      let channel = guild.channels.cache.find(
        (candidate) =>
          candidate.type === ChannelType.GuildVoice &&
          candidate.name === voiceConfig.name
      );

      if (!channel) {
        channel = await guild.channels.create({
          name: voiceConfig.name,
          type: ChannelType.GuildVoice,
          parent: null,
          permissionOverwrites,
          reason: 'Geschützten Loco-Sprachkanal eingerichtet',
        });
        console.log(`[voiceChannels] Sprachkanal ${channel.name} erstellt.`);
        continue;
      }

      if (channel.parentId !== null) {
        await channel.setParent(null, { lockPermissions: false });
      }

      await channel.permissionOverwrites.set(
        permissionOverwrites,
        'Berechtigungen des geschützten Loco-Sprachkanals aktualisiert'
      );
      console.log(`[voiceChannels] Sprachkanal ${channel.name} aktualisiert.`);
    } catch (error) {
      console.error(`[voiceChannels] ${voiceConfig.name} fehlgeschlagen:`, error.message);
    }
  }
}

async function ensureProtectedChannels() {
  const anchorChannel = client.channels.cache.get(CONFIG.channels.welcome)
    || await client.channels.fetch(CONFIG.channels.welcome).catch(() => null);
  const guild = anchorChannel?.guild;

  if (!guild) {
    console.error('[protectedChannels] Konfigurierter Loco-Secretary-Server nicht gefunden.');
    return;
  }

  await guild.roles.fetch();
  await guild.channels.fetch();

  const botMember = guild.members.me || await guild.members.fetchMe().catch(() => null);
  const missingBotPermissions = [
    [PermissionFlagsBits.ManageChannels, 'Kanäle verwalten'],
    [PermissionFlagsBits.ManageRoles, 'Rollen verwalten'],
  ]
    .filter(([permission]) => !botMember?.permissions.has(permission))
    .map(([, label]) => label);

  if (missingBotPermissions.length > 0) {
    console.error(
      `[protectedChannels] Der Bot-Rolle fehlen: ${missingBotPermissions.join(', ')}. ` +
      'Bitte diese Rechte in den Servereinstellungen aktivieren und den Bot neu starten.'
    );
    return;
  }

  const areas = [CONFIG.squadChannels, CONFIG.cupChannels].filter((area) => area.enabled);
  for (const area of areas) {
    const resolvedRoles = resolveAreaRoles(guild, area.roles);
    const missingRoles = area.roles.filter((roleConfig, index) => !resolvedRoles[index]);
    if (missingRoles.length > 0) {
      console.error(
        `[protectedChannels] ${area.categoryName} nicht erstellt: Rollen fehlen (` +
        `${missingRoles.map((role) => role.names[0]).join(', ')}).`
      );
      continue;
    }

    await ensureReadOnlyChannelArea(guild, {
      ...area,
      resolvedRoleIds: resolvedRoles.map((role) => role.id),
    });
  }

  await ensureVoiceChannels(guild);
}

function extractUniqueMentions(content) {
  const matches = content.match(/<@!?\d+>/g) || [];
  return [...new Set(matches)];
}

function getMemberHPKey(member) {
  for (const key of POSITION_ORDER) {
    const roleId = CONFIG.roles.hpPositions[key];
    if (member.roles.cache.has(roleId)) {
      return key;
    }
  }

  return null;
}

function getMemberNPKeys(member) {
  return POSITION_ORDER.filter((key) => {
    const roleId = CONFIG.roles.npPositions[key];
    return member.roles.cache.has(roleId);
  });
}

function buildRolePositionText(positionKey) {
  if (!positionKey) {
    return 'Mit seinem Join bekommt unser Rudel weitere Tiefe und neue Möglichkeiten für den Kader.';
  }

  const snippets = roleAnnouncementData.positions[positionKey];
  if (!snippets || !Array.isArray(snippets) || snippets.length === 0) {
    return 'Mit seinem Join bekommt unser Rudel weitere Tiefe und neue Möglichkeiten für den Kader.';
  }

  return pickRandom(snippets);
}

function buildRoleAnnouncementEmbed(member) {
  const hpKey = getMemberHPKey(member);
  const mention = `${member}`;
  const title = pickRandom(roleAnnouncementData.titles);
  const intro = pickRandom(roleAnnouncementData.intros);
  const hype = pickRandom(roleAnnouncementData.hype);
  const ending = pickRandom(roleAnnouncementData.endings);
  const positionLine = hpKey ? `**Hauptposition:** ${POSITION_LABELS[hpKey]}` : '**Hauptposition:** Noch nicht ausgewählt';
  const positionText = buildRolePositionText(hpKey);

  const description = [
    intro,
    '',
    `${mention} gehört ab sofort offiziell zu **LOCO SQUAD** 🔴⚫`,
    '',
    hype,
    '',
    positionLine,
    positionText,
    '',
    ending,
  ].join('\n');

  return new EmbedBuilder()
    .setColor(CONFIG.branding.accentColor)
    .setTitle(title)
    .setDescription(description)
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
    .setFooter({ text: CONFIG.branding.footer })
    .setTimestamp();
}

async function detectKick(guild, memberId) {
  try {
    const audit = await guild.fetchAuditLogs({
      limit: 10,
      type: AuditLogEvent.MemberKick,
    });

    const entry = audit.entries.find((log) => {
      const targetMatches = log.target?.id === memberId;
      const createdRecently = Date.now() - log.createdTimestamp < 20_000;
      return targetMatches && createdRecently;
    });

    return entry || null;
  } catch (error) {
    console.error('[detectKick] Audit log read failed:', error.message);
    return null;
  }
}

function queueRoleAnnouncement(guild, userId) {
  const guildId = guild.id;

  if (!pendingRoleAnnouncements.has(guildId)) {
    pendingRoleAnnouncements.set(guildId, new Set());
  }

  pendingRoleAnnouncements.get(guildId).add(userId);

  if (roleAnnouncementTimers.has(guildId)) return;

  const timer = setTimeout(async () => {
    try {
      const ids = [...(pendingRoleAnnouncements.get(guildId) || [])];
      pendingRoleAnnouncements.delete(guildId);
      roleAnnouncementTimers.delete(guildId);

      if (ids.length === 0) return;

      const members = await Promise.all(
        ids.map(async (id) => {
          try {
            return await guild.members.fetch(id);
          } catch {
            return null;
          }
        })
      );

      const validMembers = members.filter(Boolean);
      if (validMembers.length === 0) return;

      if (validMembers.length === 1) {
        const embed = buildRoleAnnouncementEmbed(validMembers[0]);
        await safeSend(
          CONFIG.channels.announcements,
          { embeds: [embed] },
          'roleAnnouncement-single'
        );
        return;
      }

      const title = pickRandom(roleAnnouncementData.titles);
      const intro = pickRandom(roleAnnouncementData.intros);
      const hype = pickRandom(roleAnnouncementData.hype);
      const ending = pickRandom(roleAnnouncementData.endings);

      const mentions = validMembers.map((m) => `${m}`).join(' ');
      const uniqueHPs = [...new Set(validMembers.map((member) => getMemberHPKey(member)).filter(Boolean))];

      const positionLine =
        uniqueHPs.length > 0
          ? `**Hauptpositionen im neuen Batch:** ${uniqueHPs.map((key) => POSITION_LABELS[key]).join(' / ')}`
          : '**Hauptpositionen im neuen Batch:** Noch nicht ausgewählt';

      const description = [
        intro,
        '',
        `${mentions}`,
        '',
        `gehören ab sofort offiziell zu **LOCO SQUAD** 🔴⚫`,
        '',
        hype,
        '',
        positionLine,
        'Das Rudel wächst weiter — mehr Tiefe, mehr Optionen und mehr Möglichkeiten für das, was wir hier gemeinsam aufbauen.',
        '',
        ending,
      ].join('\n');

      const embed = buildEmbed(title, description);

      await safeSend(
        CONFIG.channels.announcements,
        { embeds: [embed] },
        'roleAnnouncement-batch'
      );
    } catch (error) {
      console.error('[queueRoleAnnouncement] Batch failed:', error.message);
    }
  }, CONFIG.roleAnnouncement.batchWindowMs);

  roleAnnouncementTimers.set(guildId, timer);
}

/* -------------------- POSITION PANEL -------------------- */

function createPositionPanelEmbed() {
  return new EmbedBuilder()
    .setColor(CONFIG.branding.accentColor)
    .setTitle(CONFIG.positionPanel.title)
    .setDescription(
      [
        'Hi Loco 👋',
        '',
        'bitte wähle hier deine **Hauptposition** und danach deine **Nebenpositionen** aus.',
        '',
        '**Wichtig:**',
        '• genau **1 Hauptposition**',
        '• bis zu **5 Nebenpositionen**',
        '• bitte realistisch auswählen',
        '',
        'Das hilft bei Kaderplanung, Übersicht und Aufstellungen.',
      ].join('\n')
    )
    .setFooter({ text: CONFIG.branding.footer })
    .setTimestamp();
}

function createPositionButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('positions_select_hp')
      .setLabel('Hauptposition wählen')
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId('positions_select_np')
      .setLabel('Nebenpositionen wählen')
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId('positions_show')
      .setLabel('Meine Positionen')
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId('positions_reset')
      .setLabel('Zurücksetzen')
      .setStyle(ButtonStyle.Danger),

    new ButtonBuilder()
      .setCustomId('positions_overview')
      .setLabel('Übersicht')
      .setStyle(ButtonStyle.Secondary)
  );
}

function createHPMenu() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('positions_hp_menu')
      .setPlaceholder('Wähle deine Hauptposition')
      .setMinValues(1)
      .setMaxValues(1)
      .addOptions(
        POSITION_ORDER.map((key) => ({
          label: POSITION_LABELS[key],
          value: key,
        }))
      )
  );
}

function createNPMenu(currentHPKey = null) {
  const options = POSITION_ORDER
    .filter((key) => key !== currentHPKey)
    .map((key) => ({
      label: POSITION_LABELS[key],
      value: key,
    }));

  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('positions_np_menu')
      .setPlaceholder('Wähle bis zu 5 Nebenpositionen')
      .setMinValues(0)
      .setMaxValues(Math.min(5, options.length))
      .addOptions(options)
  );
}

function createOverviewMenu() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('positions_overview_menu')
      .setPlaceholder('Welche Übersicht möchtest du sehen?')
      .setMinValues(1)
      .setMaxValues(1)
      .addOptions([
        {
          label: 'Loco Squad',
          value: 'loco_squad',
          description: 'Nur Mitglieder mit der Rolle Loco Squad',
        },
        {
          label: 'T Cup / Tester / Aushilfen',
          value: 'others_group',
          description: 'Zusammengeführte Übersicht der drei Gruppen',
        },
      ])
  );
}

function splitIntoChunks(text, maxLength = 1900) {
  if (text.length <= maxLength) return [text];

  const chunks = [];
  let current = '';

  for (const block of text.split('\n\n')) {
    const candidate = current ? `${current}\n\n${block}` : block;
    if (candidate.length <= maxLength) {
      current = candidate;
    } else {
      if (current) chunks.push(current);

      if (block.length <= maxLength) {
        current = block;
      } else {
        const lines = block.split('\n');
        let lineChunk = '';

        for (const line of lines) {
          const lineCandidate = lineChunk ? `${lineChunk}\n${line}` : line;
          if (lineCandidate.length <= maxLength) {
            lineChunk = lineCandidate;
          } else {
            if (lineChunk) chunks.push(lineChunk);
            lineChunk = line;
          }
        }

        current = lineChunk;
      }
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

function buildPositionsSummary(member) {
  const hpKey = getMemberHPKey(member);
  const npKeys = getMemberNPKeys(member);

  return [
    '**Deine Positionen**',
    `Hauptposition: ${hpKey ? POSITION_LABELS[hpKey] : 'Keine'}`,
    `Nebenpositionen: ${npKeys.length ? npKeys.map((key) => POSITION_LABELS[key]).join(', ') : 'Keine'}`,
  ].join('\n');
}

function buildHPOverview(members) {
  const result = [];

  for (const pos of POSITION_ORDER) {
    const roleId = CONFIG.roles.hpPositions[pos];
    const matchingMembers = members.filter((member) => member.roles.cache.has(roleId));

    if (matchingMembers.length === 0) {
      result.push(`**${POSITION_LABELS[pos]}:**\naktuell keinen Spieler mit HP dort.`);
    } else {
      const lines = matchingMembers.map((member) => `<@${member.id}>`);
      result.push(`**${POSITION_LABELS[pos]}:**\n${lines.join('\n')}`);
    }
  }

  return result.join('\n\n');
}

async function replyWithChunks(interaction, text) {
  const chunks = splitIntoChunks(text);

  await interaction.reply({
    content: chunks[0],
    flags: MessageFlags.Ephemeral,
  });

  for (let i = 1; i < chunks.length; i += 1) {
    await interaction.followUp({
      content: chunks[i],
      flags: MessageFlags.Ephemeral,
    });
  }
}

async function ensurePositionPanelMessage() {
  if (!CONFIG.positionPanel.enabled) return;

  try {
    const channel = getChannel(CONFIG.channels.positions);
    if (!channel || !channel.isTextBased()) {
      console.error('[positionPanel] Kanal nicht gefunden oder nicht textbasiert.');
      return;
    }

    const fetched = await channel.messages.fetch({ limit: 20 });

    const existingMessage = [...fetched.values()].find((msg) => {
      if (msg.author?.id !== client.user.id) return false;
      const firstEmbed = msg.embeds?.[0];
      return firstEmbed?.title === CONFIG.positionPanel.title;
    });

    const payload = {
      embeds: [createPositionPanelEmbed()],
      components: [createPositionButtons()],
    };

    if (existingMessage) {
      await existingMessage.edit(payload);
      console.log('[positionPanel] Bestehende Positionen-Nachricht aktualisiert.');
    } else {
      await channel.send(payload);
      console.log('[positionPanel] Neue Positionen-Nachricht gesendet.');
    }
  } catch (error) {
    console.error('[positionPanel] Fehler beim Erstellen/Aktualisieren:', error.message);
  }
}

/* -------------------- READY / WELCOME / GOODBYE -------------------- */

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`✅ ${readyClient.user.tag} ist online.`);
  console.log(`🌍 TZ: ${process.env.TZ || 'not set'}`);
  console.log(`📌 Welcome Channel: ${CONFIG.channels.welcome}`);
  console.log(`📌 Goodbye Channel: ${CONFIG.channels.goodbye}`);
  console.log(`📌 Announcement Channel: ${CONFIG.channels.announcements}`);
  console.log(`📌 Position Channel: ${CONFIG.channels.positions}`);

  await ensurePositionPanelMessage();
});

client.on(Events.GuildMemberAdd, async (member) => {
  if (!CONFIG.welcome.enabled) return;

  try {
    const freshMember = await member.guild.members.fetch(member.id);

    await safeSend(
      CONFIG.channels.welcome,
      {
        content: CONFIG.welcome.message(freshMember),
        allowedMentions: { users: [freshMember.id] }
      },
      'welcome'
    );
  } catch (error) {
    console.error('[welcome] Fehler bei GuildMemberAdd:', error.message);
  }
});

client.on(Events.GuildBanAdd, async (ban) => {
  recentBanIds.add(ban.user.id);
  setTimeout(() => recentBanIds.delete(ban.user.id), 20_000);

  if (!CONFIG.goodbye.enabled) return;

  const variant = pickRandom(CONFIG.goodbye.banVariants);
  const userText = `**${ban.user.tag}**`;
  const embed = buildEmbed(variant.title, variant.description(userText));

  await safeSend(
    CONFIG.channels.goodbye,
    { embeds: [embed] },
    'ban'
  );
});

client.on(Events.GuildMemberRemove, async (member) => {
  if (!CONFIG.goodbye.enabled) return;
  if (recentBanIds.has(member.id)) return;

  const kickEntry = await detectKick(member.guild, member.id);
  const userText = `**${member.user.tag}**`;

  if (kickEntry) {
    const variant = pickRandom(CONFIG.goodbye.kickVariants);
    const embed = buildEmbed(variant.title, variant.description(userText));

    await safeSend(
      CONFIG.channels.goodbye,
      { embeds: [embed] },
      'kick'
    );
    return;
  }

  const variant = pickRandom(CONFIG.goodbye.leaveVariants);
  const embed = buildEmbed(variant.title, variant.description(userText));

  await safeSend(
    CONFIG.channels.goodbye,
    { embeds: [embed] },
    'leave'
  );
});

client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
  if (!CONFIG.roleAnnouncement.enabled) return;

  const roleId = CONFIG.roles.locoSquad;
  if (!roleId) return;

  const hadRoleBefore = oldMember.roles.cache.has(roleId);
  const hasRoleNow = newMember.roles.cache.has(roleId);

  if (!hadRoleBefore && hasRoleNow) {
    queueRoleAnnouncement(newMember.guild, newMember.id);
  }
});

/* -------------------- INTERACTIONS -------------------- */

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    /* ---------- BUTTONS ---------- */
    if (interaction.isButton()) {
      /* POSITION BUTTONS */
      if (interaction.customId === 'positions_select_hp') {
        await interaction.reply({
          content: 'Wähle deine Hauptposition:',
          components: [createHPMenu()],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (interaction.customId === 'positions_select_np') {
        const currentHPKey = getMemberHPKey(interaction.member);

        await interaction.reply({
          content: currentHPKey
            ? `Wähle deine Nebenpositionen. Deine Hauptposition **${POSITION_LABELS[currentHPKey]}** ist hier automatisch ausgeschlossen.`
            : 'Wähle deine Nebenpositionen:',
          components: [createNPMenu(currentHPKey)],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (interaction.customId === 'positions_show') {
        await interaction.reply({
          content: buildPositionsSummary(interaction.member),
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (interaction.customId === 'positions_reset') {
        const allPositionRoleIds = [
          ...Object.values(CONFIG.roles.hpPositions),
          ...Object.values(CONFIG.roles.npPositions),
        ];

        await interaction.member.roles.remove(allPositionRoleIds).catch(() => {});
        await interaction.reply({
          content: 'Deine Hauptposition und Nebenpositionen wurden zurückgesetzt.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (interaction.customId === 'positions_overview') {
        if (interaction.user.id !== CONFIG.ownerUserId) {
          await interaction.reply({
            content: 'Diesen Button kannst nur du benutzen.',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        await interaction.reply({
          content: 'Welche Übersicht möchtest du sehen?',
          components: [createOverviewMenu()],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

    }

    /* ---------- STRING SELECT MENUS ---------- */
    if (interaction.isStringSelectMenu()) {
      /* POSITION MENUS */
      if (interaction.customId === 'positions_hp_menu') {
        const selected = interaction.values[0];
        const allHpRoles = Object.values(CONFIG.roles.hpPositions);

        await interaction.member.roles.remove(allHpRoles).catch(() => {});
        await interaction.member.roles.add(CONFIG.roles.hpPositions[selected]);

        const currentNPs = getMemberNPKeys(interaction.member);
        if (currentNPs.includes(selected)) {
          await interaction.member.roles.remove(CONFIG.roles.npPositions[selected]).catch(() => {});
        }

        await interaction.reply({
          content: `Deine Hauptposition ist jetzt **${POSITION_LABELS[selected]}**.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (interaction.customId === 'positions_np_menu') {
        const currentHPKey = getMemberHPKey(interaction.member);
        const selected = interaction.values.filter((key) => key !== currentHPKey);

        const allNpRoles = Object.values(CONFIG.roles.npPositions);
        await interaction.member.roles.remove(allNpRoles).catch(() => {});

        if (selected.length > 0) {
          const rolesToAdd = selected.map((key) => CONFIG.roles.npPositions[key]);
          await interaction.member.roles.add(rolesToAdd);
        }

        const text =
          selected.length > 0
            ? `Deine Nebenpositionen sind jetzt: **${selected.map((key) => POSITION_LABELS[key]).join(', ')}**`
            : 'Du hast aktuell keine Nebenpositionen ausgewählt.';

        await interaction.reply({
          content: text,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (interaction.customId === 'positions_overview_menu') {
        if (interaction.user.id !== CONFIG.ownerUserId) {
          await interaction.reply({
            content: 'Diese Übersicht kannst nur du benutzen.',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        await interaction.guild.members.fetch();

        const allMembers = [...interaction.guild.members.cache.values()].filter(
          (member) => !member.user.bot
        );

        let filteredMembers = [];

        if (interaction.values[0] === 'loco_squad') {
          filteredMembers = allMembers.filter((member) =>
            member.roles.cache.has(CONFIG.roles.locoSquad)
          );
        }

        if (interaction.values[0] === 'others_group') {
          filteredMembers = allMembers.filter(
            (member) =>
              member.roles.cache.has(CONFIG.roles.tCup) ||
              member.roles.cache.has(CONFIG.roles.tester) ||
              member.roles.cache.has(CONFIG.roles.aushilfen)
          );
        }

        const title =
          interaction.values[0] === 'loco_squad'
            ? '**Übersicht: Loco Squad**'
            : '**Übersicht: T Cup / Tester / Aushilfen**';

        const text = `${title}\n\n${buildHPOverview(filteredMembers)}`;
        await replyWithChunks(interaction, text);
        return;
      }

    }
  } catch (error) {
    console.error('[interactionCreate] Fehler:', error);

    try {
      const payload = {
        content: 'Da ist gerade etwas schiefgelaufen.',
        flags: MessageFlags.Ephemeral,
      };

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(payload);
      } else {
        await interaction.reply(payload);
      }
    } catch (followUpError) {
      console.error('[interactionCreate] Fehler beim Error-Reply:', followUpError.message);
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
