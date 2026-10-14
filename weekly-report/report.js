'use strict';
const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { FIRST_WEEK, addDays, weekData } = require('./model');
const { renderResults } = require('./results-image');
const ROLE_ID = '1426495393742454834';
function marker(key) { return `Loco-Wochenbericht · ${key}`; }
function date(key) { const [y, m, d] = key.split('-'); return `${d}.${m}.${y}`; }
function balance(s) { return `${s.wins} ${s.wins === 1 ? 'Sieg' : 'Siege'} · ${s.draws} Unentschieden · ${s.losses} ${s.losses === 1 ? 'Niederlage' : 'Niederlagen'}`; }
function payload(data, key) {
  const week = weekData(data, key); const end = addDays(key, 7); const s = week.all;
  const difference = s.goals - s.against;
  const embed = new EmbedBuilder().setColor(0xe84a8a).setTitle(`📊 Loco Squad · Wochenbericht ${date(key)} bis ${date(end)}`)
    .setDescription(`**Montag 07:30 bis Montag 07:30 · deutsche Zeit**\n${key === FIRST_WEEK ? 'Erste Woche: Es zählen die verfügbaren EA-Spiele und rekonstruierbaren Spielposts.' : 'Alle erfassten Friendly Matches dieses Zeitraums.'}`)
    .addFields(
      { name: '⚽ Spiele', value: String(s.games), inline: true },
      { name: '🏆 Bilanz', value: balance(s), inline: false },
      { name: '🥅 Tore / Gegentore', value: `${s.goals}:${s.against}`, inline: true },
      { name: '📈 Tordifferenz', value: `${difference > 0 ? '+' : ''}${difference}`, inline: true },
      { name: '🎯 Siegquote', value: s.games ? `${(100 * s.wins / s.games).toLocaleString('de-DE', { maximumFractionDigits: 1 })} %` : '–', inline: true })
    .setFooter({ text: marker(key) });
  const embeds = [embed]; const files = [];
  if (!week.rows.length) embed.addFields({ name: 'Ergebnisse der Woche', value: 'Keine Friendly Matches für diesen Zeitraum erfasst.' });
  else {
    // All results stay in one Discord message. Images avoid the 6,000-character embed text limit.
    // Nine image pages plus the summary fit Discord's ten-embed/ten-file limit.
    const pageSize = Math.max(25, Math.ceil(week.rows.length / 9));
    for (let first = 0; first < week.rows.length; first += pageSize) {
      const rows = week.rows.slice(first, first + pageSize); const filename = `wochen-ergebnisse-${key}-${files.length + 1}.png`;
      files.push(new AttachmentBuilder(renderResults(rows, first, week.rows.length), { name: filename }));
      if (first === 0) embed.setImage(`attachment://${filename}`);
      else embeds.push(new EmbedBuilder().setColor(0xe84a8a).setTitle(`Ergebnisse ${first + 1}–${first + rows.length} von ${week.rows.length}`).setImage(`attachment://${filename}`));
    }
  }
  return { content: `<@&${ROLE_ID}> 📊 Eure Woche bei Loco Squad: **${date(key)} bis ${date(end)}**`, embeds, files,
    allowedMentions: { parse: [], roles: [ROLE_ID] } };
}
module.exports = { ROLE_ID, marker, payload };
