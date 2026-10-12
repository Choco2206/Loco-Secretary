'use strict';

const path = require('path');
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const { AttachmentBuilder, EmbedBuilder } = require('discord.js');

GlobalFonts.registerFromPath(path.join(__dirname, '..', 'assets', 'award-bold.ttf'), 'Award');
const TEMPLATE = path.join(__dirname, '..', 'assets', 'loco-der-woche.png');
const TEXT_VERSION = 2;
const LOCO_SQUAD_ROLE_ID = '1426495393742454834';

function weekDetails(key) {
  const match = /^(\d{4})-W(\d{2})$/.exec(key);
  if (!match) throw new Error(`Ungültige Rankingwoche: ${key}`);
  const year = Number(match[1]);
  const week = Number(match[2]);
  if (week < 1 || week > 53) throw new Error(`Ungültige Rankingwoche: ${key}`);
  const monday = new Date(Date.UTC(year, 0, 4, 12));
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7) + (week - 1) * 7);
  const sunday = new Date(monday);
  sunday.setUTCDate(sunday.getUTCDate() + 6);
  const nextMonday = new Date(monday);
  nextMonday.setUTCDate(nextMonday.getUTCDate() + 7);
  const date = (value) => value.toLocaleDateString('de-DE', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' });
  return { label: `KW ${week}`, range: `${date(monday)} – ${date(sunday)}`, starts: date(monday), ends: date(nextMonday) };
}

function number(value) {
  return Number(value || 0).toLocaleString('de-DE', { maximumFractionDigits: 2 });
}

function fitText(ctx, value, x, y, maxWidth, size, color = '#ffffff') {
  const text = String(value).replace(/[\r\n]/g, ' ');
  while (size > 12) {
    ctx.font = `bold ${size}px Award`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 1;
  }
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y, maxWidth);
}

async function renderAward(row, key, displayName, avatarUrl) {
  const background = await loadImage(TEMPLATE);
  const canvas = createCanvas(background.width, background.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(background, 0, 0);
  // Coordinates refer to the approved square template's 1254px design grid.
  ctx.scale(background.width / 1254, background.height / 1254);
  ctx.save();
  // The foreground nameplate overlaps the bottom of the portrait frame.
  ctx.beginPath();
  ctx.rect(400, 340, 454, 365);
  ctx.clip();
  ctx.beginPath();
  ctx.arc(627, 554, 205, 0, Math.PI * 2);
  ctx.clip();
  let avatar = null;
  if (avatarUrl) {
    try {
      const response = await fetch(avatarUrl, { signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      avatar = await loadImage(Buffer.from(await response.arrayBuffer()));
    } catch (error) {
      console.error('[power-ranking] Profilbild nicht geladen:', error.message);
    }
  }
  if (avatar) {
    const side = Math.min(avatar.width, avatar.height);
    ctx.drawImage(avatar, (avatar.width - side) / 2, (avatar.height - side) / 2, side, side, 422, 349, 410, 410);
  } else {
    ctx.fillStyle = '#171717';
    ctx.fillRect(422, 349, 410, 410);
    const initials = [...String(displayName || row.playerName)].slice(0, 2).join('').toUpperCase();
    fitText(ctx, initials, 627, 554, 300, 110);
  }
  ctx.restore();
  fitText(ctx, displayName || row.playerName, 627, 771, 720, 45);
  fitText(ctx, number(row.points), 627, 909, 540, 46, '#ffd56a');
  fitText(ctx, number(row.matches), 274, 1036, 265, 37);
  fitText(ctx, number(row.averageRating), 628, 1036, 265, 37);
  fitText(ctx, number(row.manOfTheMatch), 979, 1036, 265, 37);
  const week = weekDetails(key);
  fitText(ctx, `${week.label} · ${week.range}`, 627, 1162, 905, 31);
  return canvas.toBuffer('image/png');
}

function awardMarker(key) { return `Loco der Woche · ${key}`; }

function awardPayload(ranking, key, image) {
  const week = weekDetails(key);
  const embed = new EmbedBuilder()
    .setColor(0xe52525)
    .setTitle(`👑 Loco der Woche · ${week.label}`)
    .setImage('attachment://loco-der-woche.png')
    .setFooter({ text: awardMarker(key) });
  return {
    content: `<@&${LOCO_SQUAD_ROLE_ID}> 👑 **LOCO DER WOCHE** · ${week.label}`,
    embeds: [embed],
    files: [new AttachmentBuilder(image, { name: 'loco-der-woche.png' })],
    allowedMentions: { parse: [], roles: [LOCO_SQUAD_ROLE_ID] },
  };
}

function awardTextPayload(ranking, key) {
  const winner = ranking[0];
  const week = weekDetails(key);
  const stat = (row, key) => row[key] == null ? 'nicht gespeichert' : number(row[key]);
  const stats = (row) => [
    `🎮 Spiele: **${stat(row, 'matches')}** · ⭐ Ø Rating: **${stat(row, 'averageRating')}** · 🏅 MotM: **${stat(row, 'manOfTheMatch')}**`,
    `⚽ Tore: **${stat(row, 'goals')}** · 🎯 Vorlagen: **${stat(row, 'assists')}** · 🧱 Zu-null: **${stat(row, 'cleanSheets')}**`,
    `🛡️ Tacklings: **${stat(row, 'tacklesMade')}** · 🔄 Erfolgreiche Pässe: **${stat(row, 'passesMade')}** · 🧤 Paraden: **${stat(row, 'saves')}**`,
  ];
  const podium = ranking.slice(1, 3).flatMap((row, index) => [
    `${index === 0 ? '🥈' : '🥉'} **Platz ${index + 2}:** <@${row.discordId}> · **${number(row.points)} Punkte**`,
    ...stats(row), '',
  ]);
  return {
    content: [
      `🔥 **DIESE WOCHE GEHÖRT DIR!**`,
      '',
      `👑 <@${winner.discordId}>, herzlichen Glückwunsch zur Auszeichnung **Loco der Woche**!`,
      `**${number(winner.points)} Punkte** auf dem Konto und Platz 1 im Power Ranking. Du hast dir die Krone geholt. Lass dich feiern! 🐺🏆`,
      '',
      '🥇 **PLATZ 1 IN ZAHLEN**',
      ...stats(winner),
      '',
      ...podium,
      ...(podium.length ? ['', 'Auch an euch: starke Leistung, verdient auf dem Podium! 👏'] : []),
      '',
      'Die Punkte werden pro Spiel nach der gespielten Position gewichtet und über die Woche addiert. Pässe zählen je volle 10 pro Spiel.',
      'Neue Woche, neue Chance. **Vamos, Loco Squad!** 🔴⚫',
      '',
      `📅 **${week.label} · ${week.range}**`,
      `Wertung: ${week.starts}, 07:00 Uhr bis ${week.ends}, 07:00 Uhr (deutsche Zeit).`,
    ].join('\n'),
    allowedMentions: { parse: [], users: ranking.slice(0, 3).map((row) => row.discordId) },
  };
}

async function publishAward({ target, guild, botId, key, archive, savePublication, render = renderAward }) {
  if (archive.publicationStatus === 'posted' && archive.textVersion !== TEXT_VERSION && archive.textMessageId) {
    const message = await target.messages.fetch(archive.textMessageId).catch((error) => {
      if (error.code === 10008) return null;
      throw error;
    });
    if (message?.author.id === botId) {
      await message.edit({ ...awardTextPayload(archive.ranking, key), allowedMentions: { parse: [] } });
      savePublication({ textVersion: TEXT_VERSION });
    } else if (!message) {
      savePublication({ textVersion: TEXT_VERSION });
    }
    return;
  }
  if (archive.publicationStatus !== 'pending') return;
  if (!archive.ranking?.length) {
    savePublication({ publicationStatus: 'empty' });
    return;
  }
  // A failed state write or timeout after Discord accepted the post must not create a duplicate.
  const messages = await target.messages.fetch({ limit: 100 });
  let existing = messages.find((message) => message.author.id === botId
    && message.embeds.some((embed) => embed.footer?.text === awardMarker(key)));
  if (!existing && archive.messageId) {
    existing = await target.messages.fetch(archive.messageId).catch((error) => {
      if (error.code === 10008) return null;
      throw error;
    });
  }
  if (!existing) {
    const winner = archive.ranking[0];
    const member = await guild.members.fetch(winner.discordId).catch(() => null);
    const image = await render(winner, key, member?.displayName || winner.playerName,
      member?.displayAvatarURL({ extension: 'png', size: 512 }));
    existing = await target.send(awardPayload(archive.ranking, key, image));
  }
  savePublication({ publicationStatus: 'pending', messageId: existing.id });
  const textPayload = awardTextPayload(archive.ranking, key);
  let textMessage = messages.find((message) => message.author.id === botId && message.content === textPayload.content);
  if (!textMessage) textMessage = await target.send(textPayload);
  savePublication({ publicationStatus: 'posted', messageId: existing.id, textMessageId: textMessage.id, textVersion: TEXT_VERSION, postedAt: new Date().toISOString() });
}

module.exports = { TEXT_VERSION, weekDetails, renderAward, awardPayload, awardTextPayload, publishAward, awardMarker };
