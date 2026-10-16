'use strict';
const path = require('path');
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { POSITIONS, percent } = require('./model');
const { buildAnalysis } = require('./analysis');
GlobalFonts.registerFromPath(path.join(__dirname, '..', 'assets', 'award-bold.ttf'), 'Friendly');
const CREST_BASE = 'https://eafc24.content.easports.com/fifa/fltOnlineAssets/24B23FDE-7835-41C2-87A2-F453DFDB2E82/2024/fcweb/crests/256x256';
const logoCache = new Map();
const LAYOUT_VERSION = 6;
const COLORS = { goalkeeper: ['#502918', '#ff9338'], defender: ['#49330f', '#ffd139'], midfielder: ['#123d2a', '#42e789'], forward: ['#1c315d', '#68a8ff'] };
function display(n, digits = 0) { return n === null || n === undefined ? '–' : Number(n).toLocaleString('de-DE', { minimumFractionDigits: digits, maximumFractionDigits: digits }); }
function text(ctx, value, x, y, size = 20, color = '#ecedf0', width = 900, align = 'left') {
  ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillStyle = color;
  const clean = String(value).replace(/[\r\n]/g, ' ');
  while (size > 10) { ctx.font = `${size}px Friendly`; if (ctx.measureText(clean).width <= width) break; size--; }
  ctx.fillText(clean, x, y, width);
}
function panel(width, height) {
  const canvas = createCanvas(width, height); const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0d1012'; ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#15191d'; ctx.strokeStyle = '#2a3038';
  ctx.beginPath(); ctx.roundRect(24, 24, width - 48, height - 48, 16); ctx.fill(); ctx.stroke();
  return { canvas, ctx };
}
async function fetchLogo(team) {
  const key = team.crestIds.join(':');
  const cached = logoCache.get(key);
  if (cached && Date.now() - cached.at < 6 * 60 * 60 * 1000) return cached.image;
  for (const id of team.crestIds) {
    try {
      const response = await fetch(`${CREST_BASE}/l${id}.png`, { signal: AbortSignal.timeout(10000) });
      if (!response.ok) continue;
      const image = await loadImage(Buffer.from(await response.arrayBuffer()));
      logoCache.set(key, { at: Date.now(), image });
      if (logoCache.size > 200) logoCache.delete(logoCache.keys().next().value);
      return image;
    } catch (error) { /* An unavailable EA crest must not prevent the report. */ }
  }
  return null;
}
function drawLogo(ctx, image, team, x, y) {
  if (image) {
    const scale = Math.min(130 / image.width, 130 / image.height);
    ctx.drawImage(image, x - image.width * scale / 2, y - image.height * scale / 2, image.width * scale, image.height * scale);
  } else {
    ctx.fillStyle = '#252c35'; ctx.beginPath(); ctx.arc(x, y, 62, 0, Math.PI * 2); ctx.fill();
    text(ctx, team.name.split(/\s+/).map(s => s[0]).slice(0, 3).join(''), x, y, 38, '#e7e9ed', 110, 'center');
  }
}
async function renderScore(match, logos) {
  const { canvas, ctx } = panel(1000, match.termination ? 365 : 320);
  const images = logos || await Promise.all([fetchLogo(match.own), fetchLogo(match.opponent)]);
  text(ctx, 'FRIENDLY MATCH', 500, 52, 16, '#9ca7b5', 400, 'center');
  drawLogo(ctx, images[0], match.own, 230, 145);
  drawLogo(ctx, images[1], match.opponent, 770, 145);
  const color = match.own.goals > match.opponent.goals ? '#42e789' : match.own.goals < match.opponent.goals ? '#ff9338' : '#ecedf0';
  text(ctx, `${match.own.goals} : ${match.opponent.goals}`, 500, 144, 66, color, 290, 'center');
  text(ctx, match.own.name, 230, 237, 24, '#ecedf0', 350, 'center');
  text(ctx, match.opponent.name, 770, 237, 24, '#ecedf0', 350, 'center');
  const date = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(match.timestamp));
  text(ctx, `${date}${match.minutes === null ? '' : ` · Spieldauer ${match.minutes}′`}`, 500, 281, 15, '#9ca7b5', 800, 'center');
  if (match.termination) text(ctx, terminationText(match, false), 500, 324, 18, '#ffd139', 900, 'center');
  return canvas.toBuffer('image/png');
}
function renderTable(team, logo = null) {
  const { canvas, ctx } = panel(1200, 146 + Math.max(1, team.players.length) * 42);
  if (logo) {
    const scale = Math.min(38 / logo.width, 38 / logo.height);
    ctx.drawImage(logo, 67 - logo.width * scale / 2, 54 - logo.height * scale / 2, logo.width * scale, logo.height * scale);
  } else {
    ctx.fillStyle = '#252c35'; ctx.beginPath(); ctx.arc(67, 54, 19, 0, Math.PI * 2); ctx.fill();
    text(ctx, team.name.split(/\s+/).map(s => s[0]).slice(0, 2).join(''), 67, 54, 13, '#ecedf0', 33, 'center');
  }
  text(ctx, team.name.toUpperCase(), 102, 54, 22, '#ecedf0', 1040);
  const xs = [48, 565, 697, 795, 895, 1030, 1146];
  ['Spieler', 'Pos', 'Rating', 'Tore', 'Assists', 'Pässe', 'Pass %'].forEach((h, i) => text(ctx, h, xs[i], 91, 16, '#9ca7b5', i ? 100 : 440, i ? 'right' : 'left'));
  for (let i = 0; i < Math.max(1, team.players.length); i++) {
    const y = 125 + i * 42;
    ctx.strokeStyle = '#2a3038'; ctx.beginPath(); ctx.moveTo(42, y - 18); ctx.lineTo(1158, y - 18); ctx.stroke();
    const p = team.players[i];
    if (!p) { text(ctx, 'Keine Spielerwerte verfügbar', 48, y, 18); continue; }
    text(ctx, p.name, 48, y, 20, '#ecedf0', p.motm ? 355 : 450);
    if (p.motm) { ctx.fillStyle = '#d7ff56'; ctx.beginPath(); ctx.roundRect(420, y - 11, 66, 22, 10); ctx.fill(); text(ctx, 'MOTM', 453, y, 12, '#141a08', 58, 'center'); }
    const [bg, fg] = COLORS[p.position] || ['#303640', '#b9c1cb'];
    ctx.fillStyle = bg; ctx.beginPath(); ctx.roundRect(514, y - 13, 54, 26, 5); ctx.fill();
    text(ctx, POSITIONS[p.position] || '?', 541, y, 16, fg, 50, 'center');
    const ratingColor = p.rating === null ? '#9ca7b5' : p.rating >= 8 ? '#d7ff56' : p.rating < 7 ? '#ff9338' : '#ecedf0';
    text(ctx, display(p.rating, 1), xs[2], y, 19, ratingColor, 90, 'right');
    text(ctx, p.goals === 0 ? '–' : display(p.goals), xs[3], y, 18, '#ecedf0', 90, 'right');
    text(ctx, p.assists === 0 ? '–' : display(p.assists), xs[4], y, 18, '#ecedf0', 90, 'right');
    text(ctx, `${display(p.passes)}/${display(p.passAttempts)}`, xs[5], y, 18, '#9ca7b5', 120, 'right');
    const rate = percent(p.passes, p.passAttempts);
    text(ctx, rate === null ? '–' : `${rate} %`, xs[6], y, 18, '#ecedf0', 110, 'right');
  }
  return canvas.toBuffer('image/png');
}
function marker(id) { return `Friendly Match · ${id}`; }
function escape(value) { return String(value).replace(/([\\*_`~|<>])/g, '\\$1'); }
function scorers(team) {
  const lines = team.players.filter(p => p.goals > 0 || p.assists > 0).map(p => `${escape(p.name)}${p.goals > 0 ? ` · ⚽ ${p.goals}` : ''}${p.assists > 0 ? ` · 👟 ${p.assists}` : ''}`);
  return (lines.join('\n') || 'Keine Tore oder Vorlagen').slice(0, 1024);
}
function terminationText(match, emoji = true) {
  if (!match.termination) return '';
  const label = match.termination === 'dnf' ? 'Abbruch von EA gemeldet' : 'Vorzeitig beendet';
  const duration = match.minutes === null ? '' : ` nach ca. ${match.minutes}′`;
  return `${emoji ? '⚠️ ' : ''}${label}${duration} · EA-Wertung ${match.own.goals}:${match.opponent.goals}`;
}
async function buildPayload(match, logos) {
  const images = logos || await Promise.all([fetchLogo(match.own), fetchLogo(match.opponent)]);
  const score = await renderScore(match, images);
  const own = renderTable(match.own, images[0]);
  const opponent = renderTable(match.opponent, images[1]);
  const a = match.own; const b = match.opponent;
  const pair = (key, digits = 0, suffix = '') => `${display(a[key], digits)}${a[key] === null ? '' : suffix} : ${display(b[key], digits)}${b[key] === null ? '' : suffix}`;
  const motm = [a, b].flatMap(t => t.players.filter(p => p.motm).map(p => `${escape(p.name)} · ${display(p.rating, 1)}\n${escape(t.name)}`)).join('\n') || 'Von EA nicht ausgewiesen';
  const summary = new EmbedBuilder().setColor(a.goals > b.goals ? 0x42e789 : a.goals < b.goals ? 0xff9338 : 0x9ca7b5)
    .setTitle(`${a.name} ${a.goals} : ${b.goals} ${b.name}`.slice(0, 256))
    .setDescription([
      `Freundschaftsspiel${match.minutes === null ? ' · Spieldauer nicht verfügbar' : ` · Spieldauer ca. ${match.minutes}′`}`,
      terminationText(match),
      'Werte links: Loco Squad · rechts: Gegner',
    ].filter(Boolean).join('\n'))
    .setTimestamp(new Date(match.timestamp)).setFooter({ text: marker(match.id) })
    .addFields(
      { name: `⚽ ${a.name}`.slice(0, 256), value: scorers(a), inline: true },
      { name: `⚽ ${b.name}`.slice(0, 256), value: scorers(b), inline: true },
      { name: 'Man of the Match', value: motm.slice(0, 1024) },
      ...[['Schüsse', 'shots'], ['Passquote', 'passPercent', 0, ' %'], ['Ø Rating', 'averageRating', 1], ['Tackle-Quote', 'tacklePercent', 0, ' %'], ['Pässe angekommen', 'passes'], ['Paraden', 'saves']].map(([name, key, digits, suffix]) => ({ name, value: pair(key, digits, suffix), inline: true })));
  const prior = [new EmbedBuilder().setColor(summary.data.color).setImage('attachment://ergebnis.png').setFooter({ text: `Friendly Layout · ${LAYOUT_VERSION}` }), summary,
    new EmbedBuilder().setColor(0xe84a8a).setTitle(a.name.slice(0, 256)).setImage('attachment://loco-squad.png'),
    new EmbedBuilder().setColor(0x68a8ff).setTitle(b.name.slice(0, 256)).setImage('attachment://gegner.png')];
  const used = prior.reduce((n, e) => { const j = e.toJSON(); return n + (j.title?.length || 0) + (j.description?.length || 0) + (j.footer?.text?.length || 0) + (j.fields || []).reduce((v, f) => v + f.name.length + f.value.length, 0); }, 0);
  return {
    embeds: [...prior, buildAnalysis(match, Math.max(500, 6000 - used))],
    files: [new AttachmentBuilder(score, { name: 'ergebnis.png' }), new AttachmentBuilder(own, { name: 'loco-squad.png' }), new AttachmentBuilder(opponent, { name: 'gegner.png' })],
    allowedMentions: { parse: [] },
  };
}
module.exports = { renderScore, renderTable, buildPayload, marker, LAYOUT_VERSION, terminationText };
