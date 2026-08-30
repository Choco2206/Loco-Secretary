const fs = require('fs');
const path = require('path');
const Module = require('module');

const appDir = __dirname;
const dataDir = path.join(appDir, 'data');
const roleAnnouncementSeed = path.join(appDir, 'roleAnnouncement.json');
const roleAnnouncementTarget = path.join(dataDir, 'roleAnnouncement.json');
const indexFile = path.join(appDir, 'index.js');

// /app/data is the Railway volume. Seed code-controlled announcement data
// into the volume before index.js is loaded.
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

if (!welcomePattern.test(source)) {
  throw new Error('Welcome-Konfiguration konnte in index.js nicht gefunden werden.');
}

source = source.replace(welcomePattern, `${welcomeBlock}\n\n  goodbye:`);

// Goodbye notifications are obsolete. Keep the member-remove listener only
// for releasing jersey numbers, but stop it before kick/leave messages.
source = source.replace(
  /\n\s*if \(!CONFIG\.goodbye\.enabled\) return;\n\s*if \(recentBanIds\.has\(member\.id\)\) return;[\s\S]*?\n\}\);\n\nclient\.on\(Events\.GuildMemberUpdate,/,
  '\n  return;\n});\n\nclient.on(Events.GuildMemberUpdate,'
);

// Remove ban notification listener entirely.
source = source.replace(
  /\nclient\.on\(Events\.GuildBanAdd,[\s\S]*?\n\}\);\n\nclient\.on\(Events\.GuildMemberRemove,/,
  '\nclient.on(Events.GuildMemberRemove,'
);

// Execute the patched index.js with /app as its real module directory so all
// existing relative paths and the persistent /app/data volume keep working.
const runtimeModule = new Module(indexFile, module);
runtimeModule.filename = indexFile;
runtimeModule.paths = Module._nodeModulePaths(appDir);
runtimeModule._compile(source, indexFile);
