require('dotenv').config();

const {
  Client,
  GatewayIntentBits,
  Partials,
  AuditLogEvent,
  Events,
  EmbedBuilder,
} = require('discord.js');

const roleAnnouncementData = require('./data/roleAnnouncement.json');

const CONFIG = {
  locoVoteBotId: '1478770226651992134',

  channels: {
    welcome: '1426178803960516742',
    goodbye: '1426178916455944242',
    announcements: '1426178139234631700',

    pollsByEventDay: {
      0: '1438857782442065960', // Sonntag
      1: '1438857212775895083', // Montag
      2: '1438857262151106672', // Dienstag
      3: '1438857421022822431', // Mittwoch
      4: '1438857532608086098', // Donnerstag
      5: '1438857826431795222', // Freitag
      6: '1438857699814019072', // Samstag
    },
  },

  roles: {
    locoSquad: '1426495393742454834',
    positions: {
      TW: '1439254788322623598',
      IV: '1439254755007529073',
      ZDM: '1439254691547713649',
      LM: '1439254617681825973',
      RM: '1439254653949710367',
      ZOM: '1439254585276502169',
      LS: '1439254396587479040',
      RS: '1439254478011367514',
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

→ Wähle zuerst deine **Hauptposition + Nebenpositionen (ab Level 80)** in <#1439254263112011787>  
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
    maxShownPositions: 3,
  },

  pollReminder: {
    enabled: true,
    checkIntervalMs: 60_000,
    triggerHour: 19,
    triggerMinute: 0,
    triggerWindowMinutes: 10,
    maxMessageScan: 200,
    maxRelevantMessageAgeDays: 5,
    statusNeedVote: '⚠️ Noch nicht abgestimmt:',
    statusAllDone: '✅ Alle haben abgestimmt.',
    variants: [
      ({ mentions }) => `⚠️ **Noch nicht abgestimmt, hm?**

${mentions}

Ihr habt noch genau **1 Stunde**, bevor der Poll dichtmacht.  
Und ja, langsam werde ich ein bisschen ungeduldig, Süße. 💋  
Also bewegt euch bitte noch und stimmt endlich ab.`,
      ({ mentions }) => `⚠️ **Secretary Reminder**

${mentions}

Der Poll endet in **1 Stunde**  
und ihr habt es immer noch nicht geschafft abzustimmen?  
Nicht so schön, Hübsche. 😏  
Also los jetzt — ich will das nicht zweimal sagen müssen.`,
      ({ mentions }) => `⚠️ **Na, wer fehlt denn da noch?**

${mentions}

Noch **1 Stunde Zeit**.  
Und ich sehe ganz genau, wer hier noch fehlt. 💅  
Also stimmt jetzt bitte endlich ab, bevor ich wirklich schlechte Laune bekomme.`,
      ({ mentions }) => `⚠️ **Last reminder, cuties.**

${mentions}

Der Poll läuft nur noch **eine Stunde**.  
Wäre wirklich süß von euch, wenn ihr jetzt endlich abstimmt  
und meine Planung nicht weiter unnötig durcheinanderbringt. 💋`,
      ({ mentions }) => `⚠️ **Ihr macht es mir heute aber schwer...**

${mentions}

Noch **1 Stunde bis Poll-Ende**  
und ihr fehlt immer noch.  
Seid bitte lieb, stimmt ab und bringt mich nicht dazu, sauer zu werden. 😘`,
      ({ mentions }) => `⚠️ **Hello? Ich warte immer noch.**

${mentions}

Der Poll endet in **1 Stunde**  
und ihr steht noch immer auf meiner kleinen Liste.  
Also bitte jetzt abstimmen, Süße — ich mag Chaos nur, wenn es geplant ist. 😏`,
      ({ mentions }) => `⚠️ **Nicht abstimmen ist keine gute Idee...**

${mentions}

Noch **1 Stunde** und dann ist Schluss.  
Langsam wird’s auffällig, Hübsche.  
Also einmal kurz voten — dann bin ich auch wieder lieb. 💋`,
      ({ mentions }) => `⚠️ **Kleine Erinnerung von eurer Secretary**

${mentions}

Der Poll schließt in **1 Stunde**.  
Und ganz ehrlich? Ich hätte das inzwischen schon von euch erwartet.  
Also macht’s jetzt bitte noch schnell.`,
      ({ mentions }) => `⚠️ **Noch immer offen auf meiner Liste...**

${mentions}

Ihr habt noch **1 Stunde**, um abzustimmen.  
Also bitte nicht weiter trödeln — ich sehe sowas nämlich. 💅  
Und glaub mir, ich merke mir alles.`,
      ({ mentions }) => `⚠️ **Jetzt aber mal zügig, cuties.**

${mentions}

In **1 Stunde** ist der Poll vorbei.  
Ihr fehlt noch  
und ich fände es wirklich schade, wenn ich wegen euch genervt ins Abendprogramm gehe. 😘  
Also abstimmen. Jetzt.`,
    ],
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
const sentPollReminderKeys = new Set();

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

function getTodayKey(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

function getTomorrowEventDayNumber(now = new Date()) {
  return (now.getDay() + 1) % 7;
}

function extractUniqueMentions(content) {
  const matches = content.match(/<@!?\d+>/g) || [];
  return [...new Set(matches)];
}

function getMemberPositionKeys(member) {
  const positions = [];

  for (const [key, roleId] of Object.entries(CONFIG.roles.positions)) {
    if (member.roles.cache.has(roleId)) {
      positions.push(key);
    }
  }

  return positions.slice(0, CONFIG.roleAnnouncement.maxShownPositions);
}

function buildRolePositionText(positionKeys) {
  if (!positionKeys || positionKeys.length === 0) {
    return 'Mit seinem Join bekommt unser Rudel weitere Tiefe und neue Möglichkeiten für den Kader.';
  }

  const snippets = positionKeys
    .map((key) => roleAnnouncementData.positions[key])
    .filter(Boolean)
    .map((arr) => pickRandom(arr));

  if (snippets.length === 1) return snippets[0];
  if (snippets.length === 2) return `${snippets[0]} ${snippets[1]}`;
  return `${snippets[0]} ${snippets[1]} ${snippets[2]}`;
}

function buildRoleAnnouncementEmbed(member) {
  const positions = getMemberPositionKeys(member);
  const mention = `${member}`;
  const title = pickRandom(roleAnnouncementData.titles);
  const intro = pickRandom(roleAnnouncementData.intros);
  const hype = pickRandom(roleAnnouncementData.hype);
  const ending = pickRandom(roleAnnouncementData.endings);
  const positionLine = positions.length > 0 ? `**Positionen:** ${positions.join(' / ')}` : null;
  const positionText = buildRolePositionText(positions);

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
  ]
    .filter(Boolean)
    .join('\n');

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
      const allPositions = validMembers.flatMap((member) => getMemberPositionKeys(member));
      const uniquePositions = [...new Set(allPositions)].slice(0, CONFIG.roleAnnouncement.maxShownPositions);

      const positionLine =
        uniquePositions.length > 0
          ? `**Positionen im neuen Batch:** ${uniquePositions.join(' / ')}`
          : null;

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
      ]
        .filter(Boolean)
        .join('\n');

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

async function fetchLatestRelevantLocoVoteStatusMessage(channel) {
  try {
    const fetched = await channel.messages.fetch({
      limit: CONFIG.pollReminder.maxMessageScan,
    });

    const maxAgeMs = CONFIG.pollReminder.maxRelevantMessageAgeDays * 24 * 60 * 60 * 1000;
    const now = Date.now();

    const relevantMessages = [...fetched.values()]
      .filter((msg) => {
        if (!msg.author || msg.author.id !== CONFIG.locoVoteBotId) return false;
        if (now - msg.createdTimestamp > maxAgeMs) return false;

        const content = msg.content || '';
        return (
          content.includes(CONFIG.pollReminder.statusNeedVote) ||
          content.includes(CONFIG.pollReminder.statusAllDone)
        );
      })
      .sort((a, b) => b.createdTimestamp - a.createdTimestamp);

    return relevantMessages[0] || null;
  } catch (error) {
    console.error('[pollReminder] Fehler beim Laden der Loco Vote Nachrichten:', error.message);
    return null;
  }
}

async function processPollReminderCheck() {
  if (!CONFIG.pollReminder.enabled) return;

  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();

  const inTimeWindow =
    hour === CONFIG.pollReminder.triggerHour &&
    minute >= CONFIG.pollReminder.triggerMinute &&
    minute < CONFIG.pollReminder.triggerMinute + CONFIG.pollReminder.triggerWindowMinutes;

  if (!inTimeWindow) return;

  const tomorrowDay = getTomorrowEventDayNumber(now);
  const channelId = CONFIG.channels.pollsByEventDay[tomorrowDay];
  if (!channelId) {
    console.log('[pollReminder] Kein Kanal für morgigen Spieltag gefunden.');
    return;
  }

  const reminderKey = `${getTodayKey(now)}:${channelId}`;
  if (sentPollReminderKeys.has(reminderKey)) return;

  const channel = getChannel(channelId);
  if (!channel || !channel.isTextBased()) {
    console.error(`[pollReminder] Kanal nicht gefunden oder nicht textbasiert: ${channelId}`);
    return;
  }

  console.log(`[pollReminder] Prüfe Kanal ${channelId} für morgigen Spieltag...`);

  const statusMessage = await fetchLatestRelevantLocoVoteStatusMessage(channel);

  if (!statusMessage) {
    console.log(`[pollReminder] Keine relevante Loco Vote Nachricht in Kanal ${channelId} gefunden.`);
    return;
  }

  const content = statusMessage.content || '';
  console.log(`[pollReminder] Relevante Nachricht gefunden: ${content.slice(0, 200)}`);

  if (content.includes(CONFIG.pollReminder.statusAllDone)) {
    console.log(`[pollReminder] Alle haben abgestimmt in Kanal ${channelId}. Kein Reminder nötig.`);
    sentPollReminderKeys.add(reminderKey);
    return;
  }

  if (!content.includes(CONFIG.pollReminder.statusNeedVote)) {
    console.log(`[pollReminder] Nachricht gefunden, aber ohne "Noch nicht abgestimmt" in Kanal ${channelId}.`);
    return;
  }

  const mentions = extractUniqueMentions(content);

  if (mentions.length === 0) {
    console.log(`[pollReminder] "Noch nicht abgestimmt" gefunden, aber keine Mentions extrahiert in Kanal ${channelId}.`);
    return;
  }

  const reminderText = pickRandom(CONFIG.pollReminder.variants)({
    mentions: mentions.join(' '),
  });

  const sent = await safeSend(
    channelId,
    {
      content: reminderText,
      allowedMentions: {
        users: true,
      },
    },
    'pollReminder'
  );

  if (sent) {
    sentPollReminderKeys.add(reminderKey);
    console.log(`[pollReminder] Reminder erfolgreich gesendet in Kanal ${channelId}.`);
  }
}

client.once(Events.ClientReady, (readyClient) => {
  console.log(`✅ ${readyClient.user.tag} ist online.`);
  console.log(`🌍 TZ: ${process.env.TZ || 'not set'}`);
  console.log(`📌 Welcome Channel: ${CONFIG.channels.welcome}`);
  console.log(`📌 Goodbye Channel: ${CONFIG.channels.goodbye}`);
  console.log(`📌 Announcement Channel: ${CONFIG.channels.announcements}`);

  setInterval(processPollReminderCheck, CONFIG.pollReminder.checkIntervalMs);
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

client.login(process.env.DISCORD_TOKEN);