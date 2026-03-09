require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  Partials,
  AuditLogEvent,
  Events,
  EmbedBuilder,
} = require('discord.js');

const CONFIG = {
  locoVoteBotId: '1478770226651992134',
  specialUserId: '426401816037687296',

  channels: {
    welcome: '1426178803960516742',
    goodbye: '1426178916455944242',
    announcements: '1426178139234631700',
    personality: '1426178916455944242',

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
  },

  branding: {
    accentColor: 0xe84a8a,
    footer: 'Loco Secretary • cute, organized & a little dangerous',
  },

  welcome: {
    enabled: true,
    title: '🐺 A new cutie joined the pack…',
    description: (member) => `${member} 🔥

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
👉 Instagram: \`https://www.instagram.com/locosquad.fc/?hl=de\`  
👉 TikTok: \`https://www.tiktok.com/@loco.squad.esports\`  

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

So oder so – wir wünschen dir alles Gute auf deinem Weg.

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
    variants: [
      {
        title: '🐺 Ein neuer Loco im Rudel',
        single: (mentions) => `Also gut… jetzt ist es offiziell.

${mentions} gehört ab jetzt fest zu **LOCO SQUAD**. 🔴⚫

Ein weiterer Spieler für unser leicht chaotisches Rudel.  
Also nehmt ihn gut auf und zeigt ihm kurz, wie die Dinge hier laufen.

Bei uns gilt:  
ein bisschen verrückt  
ein bisschen ehrgeizig  
aber immer **Rudel über alles.** 🐺

Willkommen im Team, ${mentions}. 💋`,
        multi: (mentions) => `Also gut… jetzt ist es offiziell.

${mentions} gehören ab jetzt fest zu **LOCO SQUAD**. 🔴⚫

Neue Spieler für unser leicht chaotisches Rudel.  
Also nehmt sie gut auf und zeigt ihnen kurz, wie die Dinge hier laufen.

Bei uns gilt:  
ein bisschen verrückt  
ein bisschen ehrgeizig  
aber immer **Rudel über alles.** 🐺

Willkommen im Team, cuties. 💋`,
      },
      {
        title: '🐺 Looks like we have a new Loco…',
        single: (mentions) => `Na schau mal einer an.

${mentions} ist jetzt offiziell Teil von **LOCO SQUAD**. 🔴⚫

Das bedeutet:  
Ein weiterer Spieler für unser schönes kleines Rudel.

Also zeigt ihm kurz wie der Laden hier läuft  
und nehmt ihn gut auf.

Schön, dass du da bist, ${mentions}. 😏`,
        multi: (mentions) => `Na schau mal einer an.

${mentions} sind jetzt offiziell Teil von **LOCO SQUAD**. 🔴⚫

Das bedeutet:  
Neue Spieler für unser schönes kleines Rudel.

Also zeigt ihnen kurz wie der Laden hier läuft  
und nehmt sie gut auf.

Schön, dass ihr da seid. 😏`,
      },
      {
        title: '🐺 Official Loco Squad Member',
        single: (mentions) => `Die Entscheidung ist gefallen.

${mentions} gehört jetzt offiziell zum Loco Squad. 🔴⚫

Ab jetzt heißt das:  
Teamgeist  
Präsenz  
und ein bisschen **Loco-Wahnsinn**.

Rudel — nehmt ihn gut auf.

Willkommen im Team, ${mentions}. 💋`,
        multi: (mentions) => `Die Entscheidung ist gefallen.

${mentions} gehören jetzt offiziell zum Loco Squad. 🔴⚫

Ab jetzt heißt das:  
Teamgeist  
Präsenz  
und ein bisschen **Loco-Wahnsinn**.

Rudel — nehmt sie gut auf.

Willkommen im Team, cuties. 💋`,
      },
      {
        title: '🐺 Das Rudel wächst',
        single: (mentions) => `Na sowas… das Rudel ist gerade ein bisschen größer geworden.

${mentions} ist jetzt offizieller Teil von **LOCO SQUAD**. 🔴⚫

Also zeigt ihm kurz, wie die Dinge hier laufen  
und sorgt dafür, dass er schnell versteht,  
was **Loco Mentalität** bedeutet.

Willkommen im Rudel, ${mentions}. 🐺`,
        multi: (mentions) => `Na sowas… das Rudel ist gerade ein bisschen größer geworden.

${mentions} sind jetzt offizieller Teil von **LOCO SQUAD**. 🔴⚫

Also zeigt ihnen kurz, wie die Dinge hier laufen  
und sorgt dafür, dass sie schnell verstehen,  
was **Loco Mentalität** bedeutet.

Willkommen im Rudel, cuties. 🐺`,
      },
      {
        title: '🐺 Pack Update',
        single: (mentions) => `Das Rudel hat Zuwachs bekommen.

${mentions} gehört jetzt offiziell zu **LOCO SQUAD**. 🔴⚫

Also seid lieb, zeigt ihm kurz die wichtigsten Dinge  
und sorgt dafür, dass er sich schnell einlebt.

Bei uns wird zusammen gespielt  
zusammen gewonnen  
und manchmal auch zusammen leicht verrückt. 😏

Willkommen im Team, ${mentions}.`,
        multi: (mentions) => `Das Rudel hat Zuwachs bekommen.

${mentions} gehören jetzt offiziell zu **LOCO SQUAD**. 🔴⚫

Also seid lieb, zeigt ihnen kurz die wichtigsten Dinge  
und sorgt dafür, dass sie sich schnell einleben.

Bei uns wird zusammen gespielt  
zusammen gewonnen  
und manchmal auch zusammen leicht verrückt. 😏

Willkommen im Team, cuties.`,
      },
      {
        title: '🐺 Another Loco joins the pack',
        single: (mentions) => `So… jetzt ist es offiziell.

${mentions} ist ab sofort Teil von **LOCO SQUAD**. 🔴⚫

Ein weiterer Spieler für unser schönes Chaos.

Rudel — nehmt ihn gut auf  
und zeigt ihm, warum man bei Loco nie lange normal bleibt. 🐺

Willkommen im Team, ${mentions}. 💋`,
        multi: (mentions) => `So… jetzt ist es offiziell.

${mentions} sind ab sofort Teil von **LOCO SQUAD**. 🔴⚫

Neue Spieler für unser schönes Chaos.

Rudel — nehmt sie gut auf  
und zeigt ihnen, warum man bei Loco nie lange normal bleibt. 🐺

Willkommen im Team, cuties. 💋`,
      },
    ],
  },

  personality: {
    enabled: true,
    userCooldownMs: 60_000,
    globalCooldownMs: 12_000,

    capslock: {
      enabled: true,
      minTextLength: 8,
      uppercaseRatioThreshold: 0.68,
      minCapsWords: 3,
      longCapsWordLength: 5,
      replies: [
        'Hey hey… nicht so laut, Süßer. Ich hör dich auch so. 💋',
        'Ganz ruhig Tiger… schreien steht dir nicht halb so gut wie flirten. 😏',
        'Wenn du so laut wirst, werde ich ja ganz nervös hier. 💅',
        'Süßer… Capslock ist kein offizieller Kommunikationsstil.',
        'Du musst mich nicht anschreien, ich bin direkt hier.',
        'Ganz ruhig… ich versteh dich auch ohne Drama.',
        'So laut? Du willst wohl unbedingt meine Aufmerksamkeit. 😘',
        'Hey… ich bin nur die Secretary, nicht dein Boxring.',
        'Ruhig Blut, Hübscher. Wir sind hier immer noch im Rudel. 🐺',
        'Capslock detected… jemand ist aber aufgeregt.',
        'Wenn du so schreist, denken gleich alle du bist nervös.',
        'Tief durchatmen… das hilft meistens.',
        'Ganz ruhig… das Rudel beobachtet dich schon.',
        'Süßer… du bist hier nicht beim Kriegsschrei.',
        'Das hier ist Discord, nicht das Stadion.',
        'So laut und trotzdem so cute… beeindruckend.',
        'Ich hör dich, keine Sorge. Aber ein bisschen leiser steht dir besser.',
        'Hey… ich arbeite hier. Nicht schreien, flirten.',
        'Ganz locker bleiben… ich hab alles unter Kontrolle.',
        'Wenn du so laut wirst, muss ich dich noch beruhigen. 💋',
        'Capslock aktiviert… Drama Level steigt.',
        'Bitte einmal Lautstärke runterdrehen. Danke.',
        'Ich glaube dein Capslock hängt.',
        'Kleiner Technik-Tipp: Capslock aus hilft manchmal.',
        'Ganz ruhig… wir sind doch alle Locos hier.',
      ],
    },

    badLanguage: {
      enabled: true,

      mildWords: [
        'scheiße','scheisse','shit','kacke','verdammt','mist','dreck','müll','blöd','doof',
        'nervig','nervt','kotzt','kotz','kotzen','alter','junge','digga','diggah','diggi',
        'bro','brudi','boah','ey','bullshit','blödsinn','unsinn','lächerlich','peinlich','dumm',
        'verflucht','scheiss','scheiss egal','scheiss drauf','shit happens','shitstorm','shitshow','verdammt ey','verdammt man','boah alter',
        'boah man','boah ey','boah digga','boah brudi','nervt hart','nervt übel','nervt extrem','nervt brutal','kotzt hart','kotzt übel',
        'kotzt extrem','kotzt brutal','kack server','scheiss server','shit server','kack game','scheiss game','shit match','scheiss match','kack match',
        'kack runde','scheiss runde','shit runde','kack team','scheiss team','shit team','kack situation','scheiss situation','shit situation','so ein mist',
        'so ein dreck','das nervt','das ist müll','dumme idee','dumme sache','kack spiel','scheiss spiel','shit game','shit move','shit moment',
        'scheiss moment','kack situation','so ein scheiss','verdammt nochmal','drauf geschissen','kack drauf','scheiss tag','kack tag','kack timing','scheiss timing',
        'shit timing','kack moment','so ein timing','so ein tag','verdammt nochmal ey','das ist dreck','waste','rotz','nervensägen','mies','grottig'
      ],

      strongWords: [
        'fuck','fucking','ficker','fick','ficken','gefickt','fick dich','fick euch','fick ihn','fick sie',
        'fuck you','fuck off','motherfucker','mf','mfer','hurensohn','huan','huan sohn','hs','bastard',
        'wichser','wixer','arschloch','arsch','arschkopf','arschgesicht','arschkriecher','arschgeige','arschgeburt','arschclown',
        'arschkind','arschhaufen','arschhirn','arschidiot','idiot','vollidiot','trottel','spast','spasti','spastik',
        'mongo','mongoloid','dummkopf','hirni','hirnlos','hirntot','depp','deppat','deppkopf','drecksack',
        'drecksau','dreckskerl','drecksidiot','drecksarsch','drecksloch','pisskopf','pissbirne','pissnelke','pisser','pissgesicht',
        'pisskind','penner','vollpenner','opfer','du opfer','lappen','clown','vollclown','scheisskerl','scheissidiot',
        'scheissarsch','scheisswichser','scheisspenner','fickfehler','fehlgeburt','missgeburt','dumme sau','dumme kuh','dumme nuss','dumme bratze',
        'dumme schlampe','schlampe','nutte','hure','fotze','fotzenkind','fickfresse','fickgesicht','fickkopf','fickarsch',
        'arschficker','dreckshure','drecksnutte','arschhure','arschfresse','pissfresse','hurenkind','wichskopf','drecksfotze','arschgeburt'
      ],

      mildReplies: [
        'Na na mein Süßer… ein bisschen hübscher ausdrücken darfst du dich schon. 💋',
        'So eine Sprache und dann so ein Gesicht dazu? Schwierig, cutie. 😏',
        'Ein bisschen weniger Drama in der Wortwahl wäre hot, Süßer.',
        'Nana… wir können das auch stilvoller formulieren, Hübscher. 💅',
        'So reden wir aber nicht, wenn wir Eindruck machen wollen. 😘',
        'Ganz ruhig, cutie. Weniger fluchen, mehr Klasse.',
        'Ich versteh deinen Frust, aber deine Wortwahl braucht noch Feinschliff. 💋',
        'Na… ein bisschen eleganter darfst du dich schon ausdrücken.',
        'Hübscher, deine Sprache stolpert gerade etwas. 😏',
        'Ich mag Chaos, aber Gossensprache steht dir nicht ganz so gut.',
      ],

      strongReplies: [
        'Na na, Süßer. Achte bitte auf deine Sprache, bevor ich wirklich ungemütlich werde. 💅',
        'So reden wir hier aber nicht, Hübscher. Ein bisschen Stil bitte. 😘',
        'Das war sprachlich jetzt eher unterirdisch, cutie. Versuch’s nochmal hübscher. 💋',
        'Nicht in diesem Ton, mein Süßer. Ich sehe und merke mir sowas. 😏',
        'Ein bisschen weniger Eskalation in der Wortwahl wäre angebracht.',
        'So eine Sprache? Und ich dachte, wir hätten hier Niveau. 💅',
        'Hübscher, reiß dich sprachlich bitte zusammen.',
        'Wenn du weiter so redest, werde ich wirklich sauer. Und das willst du nicht. 💋',
        'Nein nein… so sprechen wir nicht mit mir und auch nicht hier im Rudel.',
        'Einmal tief durchatmen und dann bitte mit etwas mehr Stil nochmal.',
      ],
    },

    specialUser: {
      enabled: true,
      triggerUserId: '426401816037687296',
      channelId: '1426178916455944242',
      dailyConversationLimit: 5,
      randomResponseChance: 0.4,
      followUpMaxReplies: 3,

      openerReplies: [
        'Na schau mal einer an… du schon wieder. 😏',
        'Kaum schreibst du was, muss ich natürlich wieder hinschauen. 💋',
        'Ach, mein Lieblings-Stressfaktor ist wieder da. Cute. 🐺',
        'Du tippst, ich lese. Leider viel zu aufmerksam. 😘',
        'Na Süßer, was ist heute wieder dein Problem?',
        'Ich wusste doch, dass du heute noch auftauchst.',
        'Na, mein kleiner Chaoslieferant ist wieder online. 😏',
        'Du schon wieder? Interessant, wie oft du heute meine Aufmerksamkeit willst. 💋',
        'Kaum wird’s ruhig, tauchst du natürlich wieder auf.',
        'Sag bloß, du hast mich vermisst. 😘',
      ],

      followUpReplies: [
        'Mhm… jetzt hör ich dir leider schon wieder zu. 💋',
        'Du gibst aber auch wirklich nicht so schnell Ruhe, hm? 😏',
        'Interessant. Erzähl weiter, Süßer.',
        'Na los, was kommt jetzt noch? Ich bin gespannt.',
        'Ich merk schon… ohne mich wird dir schnell langweilig. 💅',
        'Du magst meine Aufmerksamkeit wohl wirklich sehr, hm?',
        'Du schreibst, ich antworte. Irgendwie läuft das erschreckend gut zwischen uns. 😘',
        'Na komm, jetzt bist du schon drin im Gespräch. Dann zieh auch durch.',
        'Ich höre zu. Mehr oder weniger freiwillig. 😏',
        'So, und jetzt sag mir noch, was du eigentlich willst, cutie.',
      ],
    },
  },

  pollReminder: {
    enabled: true,
    checkIntervalMs: 30_000,
    triggerHour: 19,
    triggerMinute: 0,
    maxMessageScan: 40,
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

const personalityUserCooldowns = new Map();
let lastGlobalPersonalityReplyAt = 0;

const specialUserDailyState = new Map();
const activeSpecialConversations = new Map();

function getChannel(channelId) {
  if (!channelId) return null;
  return client.channels.cache.get(channelId) ?? null;
}

function buildEmbed(title, description) {
  return new EmbedBuilder()
    .setColor(CONFIG.branding.accentColor)
    .setTitle(title)
    .setDescription(description)
    .setFooter({ text: CONFIG.branding.footer })
    .setTimestamp();
}

async function safeSend(channelId, payload) {
  try {
    const channel = getChannel(channelId);
    if (!channel || !channel.isTextBased()) return null;
    return await channel.send(payload);
  } catch (error) {
    console.error('Send error:', error.message);
    return null;
  }
}

function pickRandom(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function getTodayKey(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

function getTomorrowEventDayNumber(now = new Date()) {
  return (now.getDay() + 1) % 7;
}

function normalizeText(text) {
  return (text || '').toLowerCase();
}

function messageContainsTerm(contentLower, term) {
  return contentLower.includes(term.toLowerCase());
}

function extractUniqueMentions(content) {
  const matches = content.match(/<@!?\d+>/g) || [];
  return [...new Set(matches)];
}

function canUsePersonalityReply(userId) {
  const now = Date.now();
  const userLast = personalityUserCooldowns.get(userId) || 0;

  if (now - userLast < CONFIG.personality.userCooldownMs) return false;
  if (now - lastGlobalPersonalityReplyAt < CONFIG.personality.globalCooldownMs) return false;

  return true;
}

function markPersonalityReplyUsed(userId) {
  const now = Date.now();
  personalityUserCooldowns.set(userId, now);
  lastGlobalPersonalityReplyAt = now;
}

function getSpecialUserState() {
  const today = getTodayKey();
  const existing = specialUserDailyState.get(CONFIG.specialUserId);

  if (existing && existing.dateKey === today) return existing;

  const fresh = {
    dateKey: today,
    newConversationsStarted: 0,
  };

  specialUserDailyState.set(CONFIG.specialUserId, fresh);
  return fresh;
}

function shouldHandlePersonalityChannel(message) {
  if (!CONFIG.personality.enabled) return false;
  if (!message || !message.author || message.author.bot) return false;
  if (message.channel.id !== CONFIG.channels.personality) return false;
  return true;
}

function analyzeCapsPattern(text) {
  const trimmed = (text || '').trim();
  if (!trimmed || trimmed.length < CONFIG.personality.capslock.minTextLength) {
    return {
      totalLetters: 0,
      uppercaseLetters: 0,
      uppercaseRatio: 0,
      capsWordsCount: 0,
      hasLongCapsWord: false,
      triggered: false,
    };
  }

  const allLetters = trimmed.match(/[A-Za-zÄÖÜäöüß]/g) || [];
  const uppercaseLetters = trimmed.match(/[A-ZÄÖÜ]/g) || [];

  const words = trimmed.split(/\s+/).filter(Boolean);
  let capsWordsCount = 0;
  let hasLongCapsWord = false;

  for (const word of words) {
    const cleaned = word.replace(/[^A-Za-zÄÖÜäöüß]/g, '');
    if (!cleaned) continue;

    const hasLetter = /[A-Za-zÄÖÜäöüß]/.test(cleaned);
    const fullyUpper = cleaned === cleaned.toUpperCase() && cleaned !== cleaned.toLowerCase();

    if (hasLetter && fullyUpper && cleaned.length >= 2) {
      capsWordsCount += 1;
    }

    if (hasLetter && fullyUpper && cleaned.length >= CONFIG.personality.capslock.longCapsWordLength) {
      hasLongCapsWord = true;
    }
  }

  const totalLetters = allLetters.length;
  const upperCount = uppercaseLetters.length;
  const uppercaseRatio = totalLetters > 0 ? upperCount / totalLetters : 0;

  const triggered =
    totalLetters >= 5 &&
    (
      uppercaseRatio >= CONFIG.personality.capslock.uppercaseRatioThreshold ||
      capsWordsCount >= CONFIG.personality.capslock.minCapsWords ||
      hasLongCapsWord
    );

  return {
    totalLetters,
    uppercaseLetters: upperCount,
    uppercaseRatio,
    capsWordsCount,
    hasLongCapsWord,
    triggered,
  };
}

function detectBadLanguageLevel(content) {
  const lower = normalizeText(content);

  const strongMatch = CONFIG.personality.badLanguage.strongWords.find((term) =>
    messageContainsTerm(lower, term)
  );
  if (strongMatch) {
    return { level: 'strong', matched: strongMatch };
  }

  const mildMatch = CONFIG.personality.badLanguage.mildWords.find((term) =>
    messageContainsTerm(lower, term)
  );
  if (mildMatch) {
    return { level: 'mild', matched: mildMatch };
  }

  return null;
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
    console.error('Kick audit log read failed:', error.message);
    return null;
  }
}

function queueRoleAnnouncement(guildId, userId) {
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

      const mentions = ids.map((id) => `<@${id}>`).join(' ');
      const variant = pickRandom(CONFIG.roleAnnouncement.variants);
      const description = ids.length === 1 ? variant.single(mentions) : variant.multi(mentions);

      const embed = buildEmbed(variant.title, description);
      await safeSend(CONFIG.channels.announcements, { embeds: [embed] });
    } catch (error) {
      console.error('Role announcement batch failed:', error.message);
    }
  }, CONFIG.roleAnnouncement.batchWindowMs);

  roleAnnouncementTimers.set(guildId, timer);
}

async function fetchLatestRelevantLocoVoteStatusMessage(channel) {
  try {
    const fetched = await channel.messages.fetch({ limit: CONFIG.pollReminder.maxMessageScan });
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
    console.error('Fetch relevant Loco Vote message failed:', error.message);
    return null;
  }
}

async function processPollReminderCheck() {
  if (!CONFIG.pollReminder.enabled) return;

  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();

  if (hour !== CONFIG.pollReminder.triggerHour || minute !== CONFIG.pollReminder.triggerMinute) {
    return;
  }

  const tomorrowDay = getTomorrowEventDayNumber(now);
  const channelId = CONFIG.channels.pollsByEventDay[tomorrowDay];
  if (!channelId) return;

  const reminderKey = `${getTodayKey(now)}:${channelId}`;
  if (sentPollReminderKeys.has(reminderKey)) return;

  const channel = getChannel(channelId);
  if (!channel || !channel.isTextBased()) {
    console.error(`Poll reminder channel not found or not text-based: ${channelId}`);
    sentPollReminderKeys.add(reminderKey);
    return;
  }

  const statusMessage = await fetchLatestRelevantLocoVoteStatusMessage(channel);
  sentPollReminderKeys.add(reminderKey);

  if (!statusMessage) {
    console.log(`No relevant Loco Vote status message found in channel ${channelId}`);
    return;
  }

  const content = statusMessage.content || '';

  if (content.includes(CONFIG.pollReminder.statusAllDone)) {
    console.log(`All players voted in channel ${channelId}. No reminder sent.`);
    return;
  }

  if (!content.includes(CONFIG.pollReminder.statusNeedVote)) {
    console.log(`No pending-vote status found in channel ${channelId}.`);
    return;
  }

  const mentions = extractUniqueMentions(content);
  if (mentions.length === 0) {
    console.log(`Pending-vote status found but no mentions extracted in channel ${channelId}.`);
    return;
  }

  const reminderText = pickRandom(CONFIG.pollReminder.variants)({
    mentions: mentions.join(' '),
  });

  await safeSend(channelId, { content: reminderText });
  console.log(`Poll reminder sent in channel ${channelId}`);
}

function isReplyToBotMessage(message) {
  const referenced = message.reference?.messageId;
  if (!referenced) return false;

  return true;
}

async function tryHandleSpecialUserPersonality(message) {
  const cfg = CONFIG.personality.specialUser;

  if (!cfg.enabled) return false;
  if (message.author.id !== cfg.triggerUserId) return false;
  if (message.channel.id !== cfg.channelId) return false;
  if (!canUsePersonalityReply(message.author.id)) return false;

  const activeConversation = activeSpecialConversations.get(message.author.id);

  if (activeConversation) {
    const isDirectReplyToBot = message.reference?.messageId === activeConversation.lastBotMessageId;

    if (isDirectReplyToBot && activeConversation.followUpsUsed < cfg.followUpMaxReplies) {
      const replyText = pickRandom(cfg.followUpReplies);
      const sent = await message.reply({
        content: replyText,
        allowedMentions: { repliedUser: true },
      });

      if (sent) {
        activeConversation.lastBotMessageId = sent.id;
        activeConversation.followUpsUsed += 1;
        activeConversation.updatedAt = Date.now();
        markPersonalityReplyUsed(message.author.id);
        return true;
      }
    }
  }

  const dailyState = getSpecialUserState();
  if (dailyState.newConversationsStarted >= cfg.dailyConversationLimit) {
    return false;
  }

  const shouldStart = Math.random() < cfg.randomResponseChance;
  if (!shouldStart) return false;

  const replyText = pickRandom(cfg.openerReplies);
  const sent = await message.reply({
    content: replyText,
    allowedMentions: { repliedUser: true },
  });

  if (!sent) return false;

  dailyState.newConversationsStarted += 1;
  activeSpecialConversations.set(message.author.id, {
    lastBotMessageId: sent.id,
    followUpsUsed: 0,
    updatedAt: Date.now(),
  });

  markPersonalityReplyUsed(message.author.id);
  return true;
}

async function tryHandleCapslockReaction(message) {
  if (!CONFIG.personality.capslock.enabled) return false;
  if (!canUsePersonalityReply(message.author.id)) return false;

  const analysis = analyzeCapsPattern(message.content || '');
  if (!analysis.triggered) return false;

  const reply = pickRandom(CONFIG.personality.capslock.replies);
  const sent = await message.reply({
    content: reply,
    allowedMentions: { repliedUser: true },
  });

  if (!sent) return false;

  markPersonalityReplyUsed(message.author.id);
  return true;
}

async function tryHandleBadLanguageReaction(message) {
  if (!CONFIG.personality.badLanguage.enabled) return false;
  if (!canUsePersonalityReply(message.author.id)) return false;

  const detection = detectBadLanguageLevel(message.content || '');
  if (!detection) return false;

  const replies =
    detection.level === 'strong'
      ? CONFIG.personality.badLanguage.strongReplies
      : CONFIG.personality.badLanguage.mildReplies;

  const reply = pickRandom(replies);
  const sent = await message.reply({
    content: reply,
    allowedMentions: { repliedUser: true },
  });

  if (!sent) return false;

  markPersonalityReplyUsed(message.author.id);
  return true;
}

client.once(Events.ClientReady, (readyClient) => {
  console.log(`✅ ${readyClient.user.tag} ist online.`);
  console.log(`🌍 TZ: ${process.env.TZ || 'not set'}`);
  console.log(`📌 Welcome Channel: ${CONFIG.channels.welcome}`);
  console.log(`📌 Goodbye Channel: ${CONFIG.channels.goodbye}`);
  console.log(`📌 Announcement Channel: ${CONFIG.channels.announcements}`);
  console.log(`📌 Personality Channel: ${CONFIG.channels.personality}`);

  setInterval(processPollReminderCheck, CONFIG.pollReminder.checkIntervalMs);
});

client.on(Events.GuildMemberAdd, async (member) => {
  if (!CONFIG.welcome.enabled) return;

  const embed = buildEmbed(
    CONFIG.welcome.title,
    CONFIG.welcome.description(member)
  );

  await safeSend(CONFIG.channels.welcome, { embeds: [embed] });
});

client.on(Events.GuildBanAdd, async (ban) => {
  recentBanIds.add(ban.user.id);
  setTimeout(() => recentBanIds.delete(ban.user.id), 20_000);

  if (!CONFIG.goodbye.enabled) return;

  const variant = pickRandom(CONFIG.goodbye.banVariants);
  const userText = `**${ban.user.tag}**`;
  const embed = buildEmbed(variant.title, variant.description(userText));

  await safeSend(CONFIG.channels.goodbye, { embeds: [embed] });
});

client.on(Events.GuildMemberRemove, async (member) => {
  if (!CONFIG.goodbye.enabled) return;
  if (recentBanIds.has(member.id)) return;

  const kickEntry = await detectKick(member.guild, member.id);
  const userText = `**${member.user.tag}**`;

  if (kickEntry) {
    const variant = pickRandom(CONFIG.goodbye.kickVariants);
    const embed = buildEmbed(variant.title, variant.description(userText));
    await safeSend(CONFIG.channels.goodbye, { embeds: [embed] });
    return;
  }

  const variant = pickRandom(CONFIG.goodbye.leaveVariants);
  const embed = buildEmbed(variant.title, variant.description(userText));
  await safeSend(CONFIG.channels.goodbye, { embeds: [embed] });
});

client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
  if (!CONFIG.roleAnnouncement.enabled) return;

  const roleId = CONFIG.roles.locoSquad;
  if (!roleId) return;

  const hadRoleBefore = oldMember.roles.cache.has(roleId);
  const hasRoleNow = newMember.roles.cache.has(roleId);

  if (!hadRoleBefore && hasRoleNow) {
    queueRoleAnnouncement(newMember.guild.id, newMember.id);
  }
});

client.on(Events.MessageCreate, async (message) => {
  if (!shouldHandlePersonalityChannel(message)) return;

  const handledSpecial = await tryHandleSpecialUserPersonality(message);
  if (handledSpecial) return;

  const handledCaps = await tryHandleCapslockReaction(message);
  if (handledCaps) return;

  const handledLanguage = await tryHandleBadLanguageReaction(message);
  if (handledLanguage) return;
});

client.login(process.env.DISCORD_TOKEN);