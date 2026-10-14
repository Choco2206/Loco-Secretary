'use strict';
const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { FIRST_WEEK, addDays, weekData } = require('./model');
const ROLE_ID = '1426495393742454834';
function marker(key) { return `Loco-Wochenbericht · ${key}`; }
function date(key) { const [y, m, d] = key.split('-'); return `${d}.${m}.${y}`; }
function balance(s) { return `${s.wins} ${s.wins === 1 ? 'Sieg' : 'Siege'} · ${s.draws} Unentschieden · ${s.losses} ${s.losses === 1 ? 'Niederlage' : 'Niederlagen'}`; }
function resultLine(m) {
  const t = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(m.timestamp));
  const opponent = String(m.opponentName).replace(/[\r\n]/g, ' ');
  const suffix = m.regular ? '' : ` [vorzeitig/unklare Spielzeit${m.minutes === null ? '' : `, ca. ${m.minutes} Min.`}]`;
  return `${t} · ${m.ownGoals}:${m.opponentGoals} gegen ${opponent}${suffix}`;
}
function payload(data, key) {
  const week = weekData(data, key); const end = addDays(key, 7);
  const embed = new EmbedBuilder().setColor(0xe84a8a).setTitle(`📊 Loco Squad · Wochenbericht ${date(key)} bis ${date(end)}`)
    .setDescription(`**Montag 07:30 bis Montag 07:30 · deutsche Zeit**\n${week.all.games} Friendly Matches erfasst.\n${key === FIRST_WEEK ? 'Erste Woche: Es zählen die beim Start noch verfügbaren EA-Spiele und die danach erfassten Spiele.' : 'Auswertung der gespeicherten EA-Spiele dieses Zeitraums.'}`)
    .addFields(
      { name: `⚽ Regulär beendete Spiele: ${week.regular.games}`, value: `${balance(week.regular)}\n**Tore: ${week.regular.goals}:${week.regular.against}** · Tordifferenz: ${week.regular.goals - week.regular.against}`, inline: false },
      { name: `⚠️ Vorzeitig beendet / Spielzeit unklar: ${week.other.games}`, value: `${balance(week.other)}\nEA-Wertungen: **${week.other.goals}:${week.other.against} Tore** · separat von der regulären Bilanz`, inline: false },
      { name: 'Gesamtbilanz nach EA, inklusive der separat markierten Spiele', value: `${balance(week.all)} · Tore **${week.all.goals}:${week.all.against}**` });
  const lines = week.rows.map(resultLine);
  const shown = lines.slice(-10).map(line => line.replace(/([\\*_`~|<>])/g, '\\$1'));
  let chunks = []; let chunk = '';
  for (const line of shown) { const limited = line.slice(0, 450); if (chunk.length + limited.length + 1 > 1000) { chunks.push(chunk); chunk = ''; } chunk += `${chunk ? '\n' : ''}${limited}`; }
  if (chunk) chunks.push(chunk);
  if (!chunks.length) chunks = ['Keine Friendly Matches für diesen Zeitraum erfasst.'];
  chunks.forEach((value, i) => embed.addFields({ name: `${i ? 'Ergebnisse · Fortsetzung' : week.rows.length > 10 ? 'Letzte 10 Ergebnisse der Woche' : 'Ergebnisse der Woche'}`, value }));
  embed.setFooter({ text: marker(key) });
  const files = lines.length > 10 ? [new AttachmentBuilder(Buffer.from(`Loco Squad · ${date(key)} 07:30 bis ${date(end)} 07:30\n\n${lines.join('\n')}`, 'utf8'), { name: `wochen-ergebnisse-${key}.txt` })] : [];
  return { content: `<@&${ROLE_ID}> 📊 Eure Woche bei Loco Squad: **${date(key)} bis ${date(end)}**`, embeds: [embed], files,
    allowedMentions: { parse: [], roles: [ROLE_ID] } };
}
module.exports = { ROLE_ID, marker, payload };
