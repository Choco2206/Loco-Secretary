require('dotenv').config();
const fs = require('fs');
const path = require('path');

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
  UserSelectMenuBuilder,
  MessageFlags,
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

const JERSEY_RANGES = [
  { key: '1_24', label: '1 bis 24', min: 1, max: 24 },
  { key: '25_49', label: '25 bis 49', min: 25, max: 49 },
  { key: '50_74', label: '50 bis 74', min: 50, max: 74 },
  { key: '75_99', label: '75 bis 99', min: 75, max: 99 },
];

const JERSEY_FILE = path.join(__dirname, 'data', 'jerseyNumbers.json');

const CONFIG = {
  locoVoteBotId: '1478770226651992134',
  ownerUserId: '1425580097661833443',

  channels: {
    welcome: '1426178803960516742',
    goodbye: '1426178916455944242',
    announcements: '1426178139234631700',
    positions: '1439254263112011787',
    jerseys: '1446131615469146243',
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

Na schau mal an… frischer Wind im Rudel.  
Willkommen bei **LOCO SQUAD** 🔴⚫  

Und nur damit du direkt weißt, worauf du dich hier eingelassen hast, Süßer:  
**„Loco“ heißt bei uns chaotisch, ehrgeizig, laut, loyal – aber am Ende immer ein Rudel, das zusammenhält.** 💋  

**Bevor du loslegst:**

→ Wähle zuerst deine **Hauptposition + Nebenpositionen** in <#1439254263112011787>  
→ Such dir deine **Trikotnummer** in <#1446131615469146243>  
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

  jerseyPanel: {
    enabled: true,
    title: '👕 Loco Trikotnummern',
  },
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

/* -------------------- JERSEY SYSTEM -------------------- */

function ensureJerseyFile() {
  try {
    const dataDir = path.dirname(JERSEY_FILE);

    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    if (!fs.existsSync(JERSEY_FILE)) {
      fs.writeFileSync(JERSEY_FILE, JSON.stringify({}, null, 2), 'utf8');
    }
  } catch (error) {
    console.error('[jersey] Fehler beim Erstellen der Datei:', error.message);
  }
}

function loadJerseyNumbers() {
  try {
    ensureJerseyFile();
    const raw = fs.readFileSync(JERSEY_FILE, 'utf8');
    const parsed = JSON.parse(raw || '{}');

    const cleaned = {};
    for (const [userId, number] of Object.entries(parsed)) {
      const num = Number(number);
      if (Number.isInteger(num) && num >= 1 && num <= 99) {
        cleaned[userId] = num;
      }
    }

    return cleaned;
  } catch (error) {
    console.error('[jersey] Fehler beim Laden:', error.message);
    return {};
  }
}

function saveJerseyNumbers(data) {
  try {
    ensureJerseyFile();
    fs.writeFileSync(JERSEY_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    console.error('[jersey] Fehler beim Speichern:', error.message);
  }
}

function getUserJerseyNumber(userId, data) {
  return data[userId] ?? null;
}

function findUserIdByJerseyNumber(number, data) {
  return Object.keys(data).find((userId) => data[userId] === number) || null;
}

function removeJerseyNumberByUser(userId, data) {
  delete data[userId];
}

function assignJerseyNumber(userId, number, data) {
  const currentOwner = findUserIdByJerseyNumber(number, data);
  if (currentOwner) {
    delete data[currentOwner];
  }

  delete data[userId];
  data[userId] = number;
}

function getFreeNumbersInRange(min, max, data) {
  const taken = new Set(Object.values(data));

  const free = [];
  for (let i = min; i <= max; i += 1) {
    if (!taken.has(i)) {
      free.push(i);
    }
  }

  return free;
}

function formatJerseyNumber(number) {
  return String(number).padStart(2, '0');
}

function buildJerseyPanelEmbed(data) {
  const lines = [];

  for (let i = 1; i <= 99; i += 1) {
    const ownerId = findUserIdByJerseyNumber(i, data);
    lines.push(`**${formatJerseyNumber(i)}** → ${ownerId ? `<@${ownerId}>` : 'frei'}`);
  }

  return new EmbedBuilder()
    .setColor(CONFIG.branding.accentColor)
    .setTitle(CONFIG.jerseyPanel.title)
    .setDescription(
      [
        'Wähle hier deine Trikotnummer.',
        '',
        '**Wichtig:**',
        '• jede Nummer kann nur **einmal** vergeben sein',
        '• wenn du eine neue nimmst, wird deine alte automatisch ersetzt',
        '• freie Nummern werden dir bei der Auswahl angezeigt',
        '',
        lines.join('\n'),
      ].join('\n')
    )
    .setFooter({ text: CONFIG.branding.footer })
    .setTimestamp();
}

function createJerseyButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('jersey_choose')
      .setLabel('Trikotnummer wählen')
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId('jersey_show')
      .setLabel('Meine Nummer')
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId('jersey_remove')
      .setLabel('Nummer entfernen')
      .setStyle(ButtonStyle.Danger),

    new ButtonBuilder()
      .setCustomId('jersey_admin')
      .setLabel('Admin vergeben')
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId('jersey_refresh')
      .setLabel('Panel aktualisieren')
      .setStyle(ButtonStyle.Secondary)
  );
}

function createJerseyRangeMenu(customIdPrefix = 'jersey_range') {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(customIdPrefix)
      .setPlaceholder('Wähle einen Nummernbereich')
      .setMinValues(1)
      .setMaxValues(1)
      .addOptions(
        JERSEY_RANGES.map((range) => ({
          label: range.label,
          value: range.key,
        }))
      )
  );
}

function createJerseyNumberMenu(rangeKey, data, customIdPrefix = 'jersey_number') {
  const range = JERSEY_RANGES.find((r) => r.key === rangeKey);
  if (!range) return null;

  const freeNumbers = getFreeNumbersInRange(range.min, range.max, data);
  if (freeNumbers.length === 0) return null;

  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`${customIdPrefix}:${range.key}`)
      .setPlaceholder(`Freie Nummern aus ${range.label}`)
      .setMinValues(1)
      .setMaxValues(1)
      .addOptions(
        freeNumbers.map((number) => ({
          label: formatJerseyNumber(number),
          value: String(number),
        }))
      )
  );
}

function createAdminUserSelectMenu() {
  return new ActionRowBuilder().addComponents(
    new UserSelectMenuBuilder()
      .setCustomId('jersey_admin_user')
      .setPlaceholder('Wähle einen User')
      .setMinValues(1)
      .setMaxValues(1)
  );
}

async function ensureJerseyPanelMessage() {
  if (!CONFIG.jerseyPanel.enabled) return;

  try {
    const channel = getChannel(CONFIG.channels.jerseys);
    if (!channel || !channel.isTextBased()) {
      console.error('[jerseyPanel] Kanal nicht gefunden oder nicht textbasiert.');
      return;
    }

    const data = loadJerseyNumbers();
    const fetched = await channel.messages.fetch({ limit: 20 });

    const existingMessage = [...fetched.values()].find((msg) => {
      if (msg.author?.id !== client.user.id) return false;
      const firstEmbed = msg.embeds?.[0];
      return firstEmbed?.title === CONFIG.jerseyPanel.title;
    });

    const payload = {
      embeds: [buildJerseyPanelEmbed(data)],
      components: [createJerseyButtons()],
    };

    if (existingMessage) {
      await existingMessage.edit(payload);
      console.log('[jerseyPanel] Bestehende Trikotnummern-Nachricht aktualisiert.');
    } else {
      await channel.send(payload);
      console.log('[jerseyPanel] Neue Trikotnummern-Nachricht gesendet.');
    }
  } catch (error) {
    console.error('[jerseyPanel] Fehler beim Erstellen/Aktualisieren:', error.message);
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
  console.log(`📌 Jersey Channel: ${CONFIG.channels.jerseys}`);

  ensureJerseyFile();
  await ensurePositionPanelMessage();
  await ensureJerseyPanelMessage();
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

      /* JERSEY BUTTONS */
      if (interaction.customId === 'jersey_choose') {
        if (!interaction.member.roles.cache.has(CONFIG.roles.locoSquad)) {
          await interaction.reply({
            content: 'Diese Funktion ist nur für Mitglieder mit der Rolle **Loco Squad** verfügbar.',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        await interaction.reply({
          content: 'Wähle zuerst einen Bereich für deine Trikotnummer:',
          components: [createJerseyRangeMenu('jersey_range')],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (interaction.customId === 'jersey_show') {
        const data = loadJerseyNumbers();
        const currentNumber = getUserJerseyNumber(interaction.user.id, data);

        await interaction.reply({
          content: currentNumber
            ? `Deine aktuelle Trikotnummer ist **${formatJerseyNumber(currentNumber)}**.`
            : 'Du hast aktuell keine Trikotnummer.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (interaction.customId === 'jersey_remove') {
        if (!interaction.member.roles.cache.has(CONFIG.roles.locoSquad) && interaction.user.id !== CONFIG.ownerUserId) {
          await interaction.reply({
            content: 'Diese Funktion ist nur für Mitglieder mit der Rolle **Loco Squad** verfügbar.',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const data = loadJerseyNumbers();
        const currentNumber = getUserJerseyNumber(interaction.user.id, data);

        if (!currentNumber) {
          await interaction.reply({
            content: 'Du hast aktuell keine Trikotnummer, die entfernt werden könnte.',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        removeJerseyNumberByUser(interaction.user.id, data);
        saveJerseyNumbers(data);
        await ensureJerseyPanelMessage();

        await interaction.reply({
          content: `Deine Trikotnummer **${formatJerseyNumber(currentNumber)}** wurde entfernt.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (interaction.customId === 'jersey_admin') {
        if (interaction.user.id !== CONFIG.ownerUserId) {
          await interaction.reply({
            content: 'Diesen Button kannst nur du benutzen.',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        await interaction.reply({
          content: 'Wähle den User aus, dem du manuell eine Trikotnummer geben willst:',
          components: [createAdminUserSelectMenu()],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (interaction.customId === 'jersey_refresh') {
        if (interaction.user.id !== CONFIG.ownerUserId) {
          await interaction.reply({
            content: 'Diesen Button kannst nur du benutzen.',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        await ensureJerseyPanelMessage();

        await interaction.reply({
          content: 'Das Trikotnummern-Panel wurde aktualisiert.',
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

      /* JERSEY MENUS USER FLOW */
      if (interaction.customId === 'jersey_range') {
        if (!interaction.member.roles.cache.has(CONFIG.roles.locoSquad)) {
          await interaction.reply({
            content: 'Diese Funktion ist nur für Mitglieder mit der Rolle **Loco Squad** verfügbar.',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const rangeKey = interaction.values[0];
        const data = loadJerseyNumbers();
        const numberMenu = createJerseyNumberMenu(rangeKey, data, 'jersey_number');

        if (!numberMenu) {
          await interaction.reply({
            content: 'In diesem Bereich sind aktuell keine freien Nummern mehr verfügbar.',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        await interaction.reply({
          content: 'Wähle jetzt deine freie Trikotnummer:',
          components: [numberMenu],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (interaction.customId.startsWith('jersey_number:')) {
        if (!interaction.member.roles.cache.has(CONFIG.roles.locoSquad)) {
          await interaction.reply({
            content: 'Diese Funktion ist nur für Mitglieder mit der Rolle **Loco Squad** verfügbar.',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const chosenNumber = Number(interaction.values[0]);
        const data = loadJerseyNumbers();

        const ownerId = findUserIdByJerseyNumber(chosenNumber, data);
        if (ownerId && ownerId !== interaction.user.id) {
          await interaction.reply({
            content: 'Diese Nummer ist leider gerade nicht mehr frei. Versuch bitte eine andere.',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const oldNumber = getUserJerseyNumber(interaction.user.id, data);
        assignJerseyNumber(interaction.user.id, chosenNumber, data);
        saveJerseyNumbers(data);
        await ensureJerseyPanelMessage();

        await interaction.reply({
          content: oldNumber
            ? `Deine Trikotnummer wurde von **${formatJerseyNumber(oldNumber)}** auf **${formatJerseyNumber(chosenNumber)}** geändert.`
            : `Deine Trikotnummer ist jetzt **${formatJerseyNumber(chosenNumber)}**.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      /* JERSEY MENUS ADMIN FLOW */
      if (interaction.customId.startsWith('jersey_admin_range:')) {
        if (interaction.user.id !== CONFIG.ownerUserId) {
          await interaction.reply({
            content: 'Diesen Button kannst nur du benutzen.',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const targetUserId = interaction.customId.split(':')[1];
        const rangeKey = interaction.values[0];
        const data = loadJerseyNumbers();
        const numberMenu = createJerseyNumberMenu(rangeKey, data, `jersey_admin_number:${targetUserId}`);

        if (!numberMenu) {
          await interaction.reply({
            content: 'In diesem Bereich sind aktuell keine freien Nummern mehr verfügbar.',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        await interaction.reply({
          content: `Wähle jetzt die freie Nummer für <@${targetUserId}>:`,
          components: [numberMenu],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (interaction.customId.startsWith('jersey_admin_number:')) {
        if (interaction.user.id !== CONFIG.ownerUserId) {
          await interaction.reply({
            content: 'Diesen Button kannst nur du benutzen.',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const targetUserId = interaction.customId.split(':')[1];
        const chosenNumber = Number(interaction.values[0]);

        const data = loadJerseyNumbers();
        const ownerId = findUserIdByJerseyNumber(chosenNumber, data);

        if (ownerId && ownerId !== targetUserId) {
          await interaction.reply({
            content: 'Diese Nummer ist leider gerade nicht mehr frei. Versuch bitte eine andere.',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const oldNumber = getUserJerseyNumber(targetUserId, data);
        assignJerseyNumber(targetUserId, chosenNumber, data);
        saveJerseyNumbers(data);
        await ensureJerseyPanelMessage();

        await interaction.reply({
          content: oldNumber
            ? `Du hast <@${targetUserId}> die Nummer von **${formatJerseyNumber(oldNumber)}** auf **${formatJerseyNumber(chosenNumber)}** geändert.`
            : `Du hast <@${targetUserId}> die Trikotnummer **${formatJerseyNumber(chosenNumber)}** gegeben.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
    }

    /* ---------- USER SELECT MENUS ---------- */
    if (interaction.isUserSelectMenu()) {
      if (interaction.customId === 'jersey_admin_user') {
        if (interaction.user.id !== CONFIG.ownerUserId) {
          await interaction.reply({
            content: 'Diesen Button kannst nur du benutzen.',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const targetUserId = interaction.values[0];

        await interaction.reply({
          content: `Wähle jetzt den Bereich für <@${targetUserId}>:`,
          components: [createJerseyRangeMenu(`jersey_admin_range:${targetUserId}`)],
          flags: MessageFlags.Ephemeral,
        });
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