'use strict';
const { EmbedBuilder } = require('discord.js');
const { playerForm } = require('./model');
const LABELS = { goalkeeper: '🧤 Torwart', defender: '🛡️ Abwehr', midfielder: '⚙️ Mittelfeld', forward: '⚽ Sturm' };
const METRICS = {
  goalkeeper: [['Ø Note', 'rating'], ['Paraden/Spiel', 'saves'], ['Passquote', 'passPercent', '%'], ['Tore/Spiel', 'goals'], ['Vorlagen/Spiel', 'assists'], ['Erfolgreiche Tacklings/Spiel', 'tackles']],
  defender: [['Ø Note', 'rating'], ['Passquote', 'passPercent', '%'], ['Erfolgreiche Tacklings/Spiel', 'tackles'], ['Tore/Spiel', 'goals'], ['Vorlagen/Spiel', 'assists']],
  midfielder: [['Ø Note', 'rating'], ['Passquote', 'passPercent', '%'], ['Tore/Spiel', 'goals'], ['Vorlagen/Spiel', 'assists'], ['Erfolgreiche Tacklings/Spiel', 'tackles']],
  forward: [['Ø Note', 'rating'], ['Tore/Spiel', 'goals'], ['Vorlagen/Spiel', 'assists'], ['Passquote', 'passPercent', '%'], ['Erfolgreiche Tacklings/Spiel', 'tackles']],
};
function marker(id) { return `Spieler-Formkurve · ${id}`; }
function value(n, suffix = '') { return n === null ? '–' : `${n.toLocaleString('de-DE', { maximumFractionDigits: 1, minimumFractionDigits: 1 })}${suffix}`; }
function metric(label, key, suffix, row) {
  const n = row.current[key]; const p = row.previous[key];
  const arrow = n === null || p === null ? '' : Math.abs(n - p) < (suffix === '%' ? 0.5 : 0.05) ? ' →' : n > p ? ' ↗️' : ' ↘️';
  return `${label}: **${value(n, suffix)}**${row.comparable ? ` · zuvor ${value(p, suffix)}${arrow}` : ''}`;
}
function payload(member, link, data) {
  const embed = new EmbedBuilder().setColor(0xe84a8a).setTitle(String(link?.playerName || member.displayName).slice(0, 256))
    .setFooter({ text: marker(member.id) });
  const avatar = member.displayAvatarURL?.({ size: 128 }); if (avatar) embed.setThumbnail(avatar);
  if (!link) {
    embed.setDescription(`<@${member.id}>\nEA-Profil noch nicht verknüpft. Bitte im Loco-Power-Ranking über **EA-Profil verknüpfen** verbinden.`);
    for (const label of Object.values(LABELS)) embed.addFields({ name: label, value: 'Ohne EA-Verknüpfung noch keine Zuordnung möglich.' });
  } else {
    const form = playerForm(data, link);
    embed.setDescription(`<@${member.id}> · EA: **${String(link.playerName || link.playerId).replace(/([\\*_`~|<>])/g, '\\$1')}**\nJe Bereich: letzte 5 Einsätze gegenüber den 5 davor.\nNur erfasste Friendly Matches von 20 bis 4 Uhr; vorzeitige Enden und Einsätze unter 45 Minuten ausgeschlossen.`);
    let latest = null;
    for (const [position, row] of Object.entries(form.positions)) {
      const label = `${LABELS[position]} · ${row.count} gültige Einsätze`;
      let lines;
      if (!row.count) lines = ['Noch keine passenden Einsätze erfasst.'];
      else {
        lines = [`**Letzte ${row.currentCount} Einsätze**`, `Tore: **${row.current.goalsTotal === null ? '–' : row.current.goalsTotal}** · Vorlagen: **${row.current.assistsTotal === null ? '–' : row.current.assistsTotal}**`, ...METRICS[position].map(([name, key, suffix]) => metric(name, key, suffix, row))];
        if (!row.comparable) lines.push(`Noch kein Trend: ${row.count}/10 Einsätze für einen vollständigen 5-gegen-5-Vergleich.`);
      }
      embed.addFields({ name: label, value: lines.join('\n') });
      if (row.latestAt && (!latest || row.latestAt > latest)) latest = row.latestAt;
    }
    if (form.excluded) embed.addFields({ name: 'Nicht im Vergleich', value: `${form.excluded} Einsätze wegen vorzeitigem Ende, kurzer oder fehlender Spielzeit.` });
    if (latest) embed.setTimestamp(new Date(latest));
  }
  return { embeds: [embed], allowedMentions: { parse: [] } };
}
module.exports = { marker, payload };
