'use strict';
const path = require('path');
const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');
GlobalFonts.registerFromPath(path.join(__dirname, '..', 'assets', 'award-bold.ttf'), 'Weekly');
function text(ctx, value, x, y, size, width, color = '#ecedf0', align = 'left') {
  const str = String(value).replace(/[\r\n]/g, ' ');
  while (size > 10) { ctx.font = `${size}px Weekly`; if (ctx.measureText(str).width <= width) break; size--; }
  ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillText(str, x, y, width);
}
function renderResults(rows, first, total) {
  const width = 1200; const height = 145 + rows.length * 42;
  const canvas = createCanvas(width, height); const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0d1012'; ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#15191d'; ctx.beginPath(); ctx.roundRect(24, 24, width - 48, height - 48, 16); ctx.fill();
  text(ctx, `LOCO SQUAD · WOCHENERGEBNISSE ${first + 1}–${first + rows.length} VON ${total}`, 48, 55, 21, 1100);
  text(ctx, 'Datum / Uhrzeit', 48, 91, 16, 260, '#9ca7b5');
  text(ctx, 'Gegner', 330, 91, 16, 540, '#9ca7b5');
  text(ctx, 'Ergebnis', 990, 91, 16, 130, '#9ca7b5', 'center');
  text(ctx, 'Bilanz', 1135, 91, 16, 100, '#9ca7b5', 'center');
  rows.forEach((m, index) => {
    const y = 126 + index * 42;
    ctx.strokeStyle = '#2a3038'; ctx.beginPath(); ctx.moveTo(42, y - 18); ctx.lineTo(1158, y - 18); ctx.stroke();
    const date = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(m.timestamp));
    text(ctx, date, 48, y, 18, 250, '#9ca7b5'); text(ctx, m.opponentName, 330, y, 20, 540);
    const color = m.ownGoals > m.opponentGoals ? '#42e789' : m.ownGoals < m.opponentGoals ? '#ff9338' : '#ecedf0';
    text(ctx, `${m.ownGoals} : ${m.opponentGoals}`, 990, y, 22, 130, color, 'center');
    text(ctx, m.ownGoals > m.opponentGoals ? 'S' : m.ownGoals < m.opponentGoals ? 'N' : 'U', 1135, y, 20, 90, color, 'center');
  });
  return canvas.toBuffer('image/png');
}
module.exports = { renderResults };
