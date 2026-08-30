const fs = require('fs');
const path = require('path');
const Module = require('module');

const appDir = __dirname;
const dataDir = path.join(appDir, 'data');
const roleAnnouncementSeed = path.join(appDir, 'roleAnnouncement.json');
const roleAnnouncementTarget = path.join(dataDir, 'roleAnnouncement.json');
const indexFile = path.join(appDir, 'index.js');

fs.mkdirSync(dataDir, { recursive: true });
fs.copyFileSync(roleAnnouncementSeed, roleAnnouncementTarget);

let source = fs.readFileSync(indexFile, 'utf8');

source = source.replace(
  "footer: 'Loco Secretary • cute, organized & a little dangerous',",
  "footer: 'Loco Secretary • LOCO SQUAD',"
);

const welcomeBlock = `  welcome: {
    enabled: true,
    message: (member) => \`\${member}

🐺 **Willkommen bei LOCO SQUAD**

Bei uns läuft nicht immer alles nach Lehrbuch. Genau das macht uns aus.

**Wir leben vom Chaos. Und unsere Stärke ist das Chaos.**

Loco Squad steht für Zusammenhalt, Ehrgeiz und eine Mannschaft, die ihren eigenen Weg geht. Auf dem Platz wollen wir gewinnen, daneben soll genauso eine Community stehen, bei der man gerne dabei ist.

**Bevor du loslegst:**

→ Wähle deine **Positionen** in <#1439254263112011787>

📱 **Loco Squad auf Social Media**

👉 Instagram: https://www.instagram.com/locosquad.fc/?hl=de
👉 TikTok: https://www.tiktok.com/@loco.squad.esports

**Willkommen im Rudel. 🐺🔴⚫**

**#WeAreLoco**
**#JoinThePack**\`,
  },`;

const welcomePattern = /  welcome: \{[\s\S]*?\n  \},\n\n  goodbye:/;
if (!welcomePattern.test(source)) throw new Error('Welcome-Konfiguration konnte nicht gefunden werden.');
source = source.replace(welcomePattern, `${welcomeBlock}\n\n  goodbye:`);

source = source.replace(
  /\n\s*if \(!CONFIG\.goodbye\.enabled\) return;\n\s*if \(recentBanIds\.has\(member\.id\)\) return;[\s\S]*?\n\}\);\n\nclient\.on\(Events\.GuildMemberUpdate,/,
  '\n  return;\n});\n\nclient.on(Events.GuildMemberUpdate,'
);
source = source.replace(
  /\nclient\.on\(Events\.GuildBanAdd,[\s\S]*?\n\}\);\n\nclient\.on\(Events\.GuildMemberRemove,/,
  '\nclient.on(Events.GuildMemberRemove,'
);

const fc27Code = String.raw`

/* -------------------- FC27 KADERABFRAGE -------------------- */
const FC27_PUBLIC_CHANNEL = '1543623599338819704';
const FC27_ADMIN_CHANNEL = '1543625146454114324';
const FC27_FILE = path.join(__dirname, 'data', 'fc27Kaderplanung.json');
const FC27_POSITIONS = ['TW', 'LIV', 'ZIV', 'RIV', 'ZDM', 'ZOM', 'LM/RM', 'ST'];

function fc27Load() {
  try {
    if (!fs.existsSync(FC27_FILE)) fs.writeFileSync(FC27_FILE, JSON.stringify({ players: {} }, null, 2));
    const d = JSON.parse(fs.readFileSync(FC27_FILE, 'utf8') || '{}');
    if (!d.players) d.players = {};
    return d;
  } catch (e) {
    console.error('[fc27] load', e);
    return { players: {} };
  }
}
function fc27Save(d) { fs.writeFileSync(FC27_FILE, JSON.stringify(d, null, 2), 'utf8'); }
function fc27Options(exclude = []) { return FC27_POSITIONS.filter(p => !exclude.includes(p)).map(p => ({ label: p, value: p })); }
function fc27Menu(id, placeholder, exclude = []) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder().setCustomId(id).setPlaceholder(placeholder).setMinValues(1).setMaxValues(1).addOptions(fc27Options(exclude))
  );
}
function fc27PublicButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('fc27_start').setLabel('Positionen auswählen').setEmoji('📍').setStyle(ButtonStyle.Primary)
  );
}
function fc27AdminButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('fc27_admin_assess').setLabel('Spieler einschätzen').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('fc27_admin_exclude').setLabel('Nicht einplanen').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('fc27_admin_restore').setLabel('Wieder aufnehmen').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('fc27_admin_results').setLabel('Auswertung').setStyle(ButtonStyle.Success)
  );
}
function fc27UserMenu(id, placeholder) {
  return new ActionRowBuilder().addComponents(
    new UserSelectMenuBuilder().setCustomId(id).setPlaceholder(placeholder).setMinValues(1).setMaxValues(1)
  );
}
async function fc27GetChannel(id) {
  return client.channels.cache.get(id) || await client.channels.fetch(id).catch(() => null);
}
async function fc27Members(guild) {
  await guild.members.fetch();
  return [...guild.members.cache.values()]
    .filter(m => !m.user.bot && m.roles.cache.has(CONFIG.roles.locoSquad))
    .sort((a, b) => a.displayName.localeCompare(b.displayName, 'de'));
}
function fc27PruneToCurrentMembers(data, members) {
  const currentIds = new Set(members.map(m => m.id));
  let changed = false;
  for (const id of Object.keys(data.players)) {
    if (!currentIds.has(id)) {
      delete data.players[id];
      changed = true;
    }
  }
  if (changed) fc27Save(data);
  return data;
}
async function fc27StatusText(guild) {
  let data = fc27Load();
  const members = await fc27Members(guild);
  data = fc27PruneToCurrentMembers(data, members);
  let done = 0;
  const lines = members.map(m => {
    const p = data.players[m.id];
    const status = p?.excluded ? '❌' : p?.self?.length === 3 ? '✅' : '⬜';
    if (status !== '⬜') done++;
    return '<@' + m.id + '>  ' + status;
  });
  return { text: lines.join('\n') || 'Keine Loco-Squad-Spieler gefunden.', done, total: members.length };
}
async function fc27EnsurePublic() {
  const ch = await fc27GetChannel(FC27_PUBLIC_CHANNEL);
  if (!ch?.isTextBased()) return;
  const s = await fc27StatusText(ch.guild);
  const embed = new EmbedBuilder()
    .setColor(CONFIG.branding.accentColor)
    .setTitle('🐺 FC 27 – Kaderplanung')
    .setDescription(
      'Männer, mit Blick auf **FC 27** möchte ich langsam unsere Positionen planen.\n\n' +
      'Aktuell plane ich weiterhin mit dem **3-5-2** *(nagelt mich darauf aber noch nicht fest 😄 – wir wissen noch nicht, was im neuen Teil wirklich gut und umsetzbar sein wird).*\n\n' +
      'Wählt bitte die **3 Positionen**, auf denen ihr euch selbst seht – unabhängig davon, wo im Kader Bedarf besteht.\n\n' +
      '**Hauptposition** → klare Nr. 1\n**Nebenposition** → zweite Wahl\n**2. Nebenposition** → dritte Wahl\n' +
      'Beispiel: **ST → ZOM → LM/RM**\n\n' +
      'Meine Einschätzung bleibt bis zur Auswertung geheim.\n\n' +
      '⏰ **Bitte erledigt die Abfrage bis zum 18.09.2026.**\n\n' +
      '**TW · LIV · ZIV · RIV · ZDM · ZOM · LM/RM · ST**\n\n' +
      '**Status (' + s.done + '/' + s.total + ' abgeschlossen)**\n' + s.text
    )
    .setFooter({ text: CONFIG.branding.footer });
  const msgs = await ch.messages.fetch({ limit: 30 });
  const old = [...msgs.values()].find(m => m.author.id === client.user.id && m.embeds?.[0]?.title === '🐺 FC 27 – Kaderplanung');
  const payload = { embeds: [embed], components: [fc27PublicButtons()] };
  if (old) await old.edit(payload); else await ch.send(payload);
}
async function fc27EnsureAdmin() {
  const ch = await fc27GetChannel(FC27_ADMIN_CHANNEL);
  if (!ch?.isTextBased()) {
    console.error('[fc27] Admin-Kanal nicht erreichbar:', FC27_ADMIN_CHANNEL);
    return;
  }
  let data = fc27Load();
  const members = await fc27Members(ch.guild);
  data = fc27PruneToCurrentMembers(data, members);
  const lines = members.map(m => {
    const p = data.players[m.id];
    return '<@' + m.id + '>  Spieler: ' + (p?.self?.length === 3 ? '✅' : '⬜') + ' | Choko: ' + (p?.manager?.length === 3 ? '✅' : '⬜') + (p?.excluded ? ' | ❌ Nicht eingeplant' : '');
  });
  const embed = new EmbedBuilder()
    .setColor(CONFIG.branding.accentColor)
    .setTitle('🔒 FC 27 – Kaderplanung intern')
    .setDescription('Hier hinterlegst du deine Einschätzung unabhängig von der Spielerwahl.\n\n' + (lines.join('\n') || 'Keine Spieler gefunden.'))
    .setFooter({ text: CONFIG.branding.footer });
  const msgs = await ch.messages.fetch({ limit: 30 });
  const old = [...msgs.values()].find(m => m.author.id === client.user.id && m.embeds?.[0]?.title === '🔒 FC 27 – Kaderplanung intern');
  const payload = { embeds: [embed], components: [fc27AdminButtons()] };
  if (old) await old.edit(payload); else await ch.send(payload);
}
async function fc27Refresh() {
  await fc27EnsurePublic();
  await fc27EnsureAdmin();
}
function fc27ResultText(guild) {
  const data = fc27Load();
  const rows = [];
  for (const [id, p] of Object.entries(data.players)) {
    if (p.excluded) continue;
    if (p.self?.length === 3 && p.manager?.length === 3) {
      const same = p.self.filter(x => p.manager.includes(x)).length;
      const exact = p.self.filter((x, i) => p.manager[i] === x).length;
      rows.push('<@' + id + '>\nEigene Einschätzung: **' + p.self.join(' → ') + '**\nChoko-Einschätzung: **' + p.manager.join(' → ') + '**\nÜbereinstimmung: **' + same + '/3 Positionen** · davon **' + exact + '/3 gleiche Priorität**');
    }
  }
  return rows.join('\n\n') || 'Noch keine vollständig vergleichbaren Einschätzungen vorhanden.';
}

client.once(Events.ClientReady, async () => {
  setTimeout(() => fc27Refresh().catch(console.error), 2500);
});

client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
  const roleId = CONFIG.roles.locoSquad;
  const hadRole = oldMember.roles.cache.has(roleId);
  const hasRole = newMember.roles.cache.has(roleId);
  if (hadRole === hasRole) return;

  const data = fc27Load();
  if (hadRole && !hasRole) {
    delete data.players[newMember.id];
    fc27Save(data);
  } else if (!hadRole && hasRole) {
    data.players[newMember.id] ||= {};
    fc27Save(data);
  }
  await fc27Refresh().catch(console.error);
});

client.on(Events.InteractionCreate, async interaction => {
  try {
    if (interaction.isButton() && interaction.customId === 'fc27_start') {
      if (!interaction.member.roles.cache.has(CONFIG.roles.locoSquad)) return interaction.reply({ content: 'Diese Abfrage ist nur für Loco-Squad-Spieler.', flags: MessageFlags.Ephemeral });
      const d = fc27Load();
      if (d.players[interaction.user.id]?.excluded) return interaction.reply({ content: 'Du bist aktuell für diese Kaderplanung als nicht eingeplant markiert.', flags: MessageFlags.Ephemeral });
      return interaction.reply({ content: '**1/3 – Hauptposition**\nWähle deine klare Nummer 1.', components: [fc27Menu('fc27_self_hp', 'Hauptposition wählen')], flags: MessageFlags.Ephemeral });
    }

    if (interaction.isButton() && interaction.customId.startsWith('fc27_admin_')) {
      if (interaction.user.id !== CONFIG.ownerUserId) return interaction.reply({ content: 'Nur für Choko.', flags: MessageFlags.Ephemeral });
      if (interaction.customId === 'fc27_admin_assess') return interaction.reply({ content: 'Welchen Spieler möchtest du einschätzen?', components: [fc27UserMenu('fc27_admin_user_assess', 'Spieler auswählen')], flags: MessageFlags.Ephemeral });
      if (interaction.customId === 'fc27_admin_exclude') return interaction.reply({ content: 'Welchen Spieler möchtest du nicht einplanen?', components: [fc27UserMenu('fc27_admin_user_exclude', 'Spieler auswählen')], flags: MessageFlags.Ephemeral });
      if (interaction.customId === 'fc27_admin_restore') return interaction.reply({ content: 'Welchen Spieler möchtest du wieder aufnehmen?', components: [fc27UserMenu('fc27_admin_user_restore', 'Spieler auswählen')], flags: MessageFlags.Ephemeral });
      if (interaction.customId === 'fc27_admin_results') return replyWithChunks(interaction, '**FC 27 – Vergleich**\n\n' + fc27ResultText(interaction.guild));
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'fc27_self_hp') {
      const hp = interaction.values[0];
      return interaction.update({ content: '**2/3 – Nebenposition**\nDeine zweite Wahl.', components: [fc27Menu('fc27_self_np1:' + hp, 'Nebenposition wählen', [hp])] });
    }
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('fc27_self_np1:')) {
      const hp = interaction.customId.split(':')[1];
      const np1 = interaction.values[0];
      return interaction.update({ content: '**3/3 – 2. Nebenposition**\nDeine dritte Wahl.', components: [fc27Menu('fc27_self_np2:' + hp + ':' + np1, '2. Nebenposition wählen', [hp, np1])] });
    }
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('fc27_self_np2:')) {
      const [, hp, np1] = interaction.customId.split(':');
      const np2 = interaction.values[0];
      const d = fc27Load();
      d.players[interaction.user.id] ||= {};
      if (d.players[interaction.user.id].excluded) return interaction.update({ content: 'Du bist aktuell nicht eingeplant.', components: [] });
      d.players[interaction.user.id].self = [hp, np1, np2];
      fc27Save(d);
      await interaction.update({ content: '✅ Gespeichert: **' + hp + ' → ' + np1 + ' → ' + np2 + '**\nDu kannst deine Auswahl über den Button jederzeit ändern.', components: [] });
      await fc27Refresh();
      return;
    }

    if (interaction.isUserSelectMenu() && interaction.customId.startsWith('fc27_admin_user_')) {
      if (interaction.user.id !== CONFIG.ownerUserId) return;
      const id = interaction.values[0];
      const member = await interaction.guild.members.fetch(id).catch(() => null);
      if (!member || !member.roles.cache.has(CONFIG.roles.locoSquad)) return interaction.update({ content: 'Dieser Spieler hat aktuell keine Loco-Squad-Rolle und gehört damit nicht zur Abfrage.', components: [] });
      const d = fc27Load();
      d.players[id] ||= {};
      if (interaction.customId === 'fc27_admin_user_exclude') {
        d.players[id].excluded = true;
        fc27Save(d);
        await interaction.update({ content: '❌ <@' + id + '> wird aktuell nicht eingeplant.', components: [] });
        await fc27Refresh();
        return;
      }
      if (interaction.customId === 'fc27_admin_user_restore') {
        d.players[id].excluded = false;
        fc27Save(d);
        await interaction.update({ content: '↩ <@' + id + '> wurde wieder aufgenommen.', components: [] });
        await fc27Refresh();
        return;
      }
      if (interaction.customId === 'fc27_admin_user_assess') {
        if (d.players[id].excluded) return interaction.update({ content: 'Der Spieler ist aktuell als nicht eingeplant markiert.', components: [] });
        return interaction.update({ content: '**1/3 – Deine Hauptpositions-Einschätzung für <@' + id + '>**', components: [fc27Menu('fc27_mgr_hp:' + id, 'Hauptposition einschätzen')] });
      }
    }

    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('fc27_mgr_hp:')) {
      const id = interaction.customId.split(':')[1];
      const hp = interaction.values[0];
      return interaction.update({ content: '**2/3 – Deine Nebenpositions-Einschätzung**', components: [fc27Menu('fc27_mgr_np1:' + id + ':' + hp, 'Nebenposition einschätzen', [hp])] });
    }
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('fc27_mgr_np1:')) {
      const [, id, hp] = interaction.customId.split(':');
      const np1 = interaction.values[0];
      return interaction.update({ content: '**3/3 – Deine 2. Nebenpositions-Einschätzung**', components: [fc27Menu('fc27_mgr_np2:' + id + ':' + hp + ':' + np1, '2. Nebenposition einschätzen', [hp, np1])] });
    }
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('fc27_mgr_np2:')) {
      const [, id, hp, np1] = interaction.customId.split(':');
      const np2 = interaction.values[0];
      const d = fc27Load();
      d.players[id] ||= {};
      d.players[id].manager = [hp, np1, np2];
      fc27Save(d);
      await interaction.update({ content: '✅ Deine Einschätzung für <@' + id + '>: **' + hp + ' → ' + np1 + ' → ' + np2 + '**', components: [] });
      await fc27Refresh();
      return;
    }
  } catch (e) {
    console.error('[fc27 interaction]', e);
  }
});
`;

source = source.replace("client.login(process.env.DISCORD_TOKEN);", fc27Code + "\n\nclient.login(process.env.DISCORD_TOKEN);");

const runtimeModule = new Module(indexFile, module);
runtimeModule.filename = indexFile;
runtimeModule.paths = Module._nodeModulePaths(appDir);
runtimeModule._compile(source, indexFile);
