'use strict';
const { localParts, POSITIONS, sessionKey, isActive } = require('./model');
const { decodeSnapshot } = require('./png-lineup');
const CHANNELS = ['1544644644179152956', '1544644649354797087'];
const GROUPS = { TW: 'goalkeeper', LIV: 'defender', ZIV: 'defender', RIV: 'defender', LZDM: 'midfielder', RZDM: 'midfielder', ZOM: 'midfielder', LM: 'midfielder', RM: 'midfielder', LS: 'forward', RS: 'forward' };
function positionLabel(player) { return player.lineupPosition || POSITIONS[player.position] || '?'; }
function parseSnapshot(message) {
  if (!message.author?.bot) return null;
  const embed = (message.embeds || []).find(e => /^Loco Lineup · v1 · [a-z]+$/.test(e.footer?.text || ''));
  if (!embed) return null;
  const date = /Datum: (\d{2})\.(\d{2})\.(\d{4})/.exec(embed.description || '');
  const start = /Start: (\d{2}):(\d{2})/.exec(embed.description || '');
  const published = new Date(embed.timestamp).getTime();
  if (!date || !start || !Number.isFinite(published) || +start[1] > 23 || +start[2] > 59) return null;
  const day = `${date[3]}-${date[2]}-${date[1]}`;
  const positions = {};
  for (const f of embed.fields || []) {
    const user = /^<@!?(\d+)>$/.exec(f.value || '');
    if (!GROUPS[f.name] || !user || positions[user[1]]) return null;
    positions[user[1]] = f.name;
  }
  return { day, start: +start[1] * 60 + +start[2], published, positions, messageId: message.id };
}
function parseDocument(meta, messageId) {
  if (meta?.version !== 2 || !meta.positions || typeof meta.positions !== 'object') return null;
  const date = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(meta.day || '');
  const start = /^(\d{2}):(\d{2})$/.exec(meta.start || '');
  const published = Date.parse(meta.publishedAt);
  if (!date || !start || +start[1]>23 || +start[2]>59 || !Number.isFinite(published)) return null;
  const day=`${date[3]}-${date[2]}-${date[1]}`;
  if (!Number.isFinite(Date.parse(`${day}T12:00:00Z`))) return null;
  const positions={};const occupied=new Set();
  for(const [user,pos] of Object.entries(meta.positions)) {
    if(!/^\d+$/.test(user)||!GROUPS[pos]||occupied.has(pos))return null;
    occupied.add(pos);positions[user]=pos;
  }
  return {day,start:+start[1]*60 + +start[2],published,positions,messageId};
}
function eveningKey(snapshot) {
  const published=localParts(new Date(snapshot.published));
  const publishedDay=`${published.year}-${published.month}-${published.day}`;
  const shiftDay = (day,n) => {const d=new Date(`${day}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
  if(snapshot.start>=4*60)return snapshot.day;
  // 00:15 may be entered using the evening's date, as in the Cup panel.
  if(publishedDay===snapshot.day && +published.hour>=4)return snapshot.day;
  if(publishedDay===shiftDay(snapshot.day,1) && +published.hour<4)return snapshot.day;
  return shiftDay(snapshot.day,-1);
}
function resolveLineup(match, snapshots, links) {
  const evening = sessionKey(new Date(match.timestamp));
  const byId = new Map();
  for (const [discordId, link] of Object.entries(links || {})) {
    if (!link.playerId) continue;
    const key = String(link.playerId);
    byId.set(key, byId.has(key) ? null : discordId);
  }
  const eligible = snapshots.filter(s => {
    return isActive(new Date(match.timestamp)) && s.published <= Date.parse(match.timestamp) && eveningKey(s) === evening;
  }).map(s => ({ ...s, overlap: match.own.players.filter(p => s.positions[byId.get(p.id)]).length }))
    .filter(s => s.overlap >= 1).sort((a, b) => b.published - a.published);
  const chosen = eligible[0];
  for (const player of match.own.players) {
    delete player.lineupPosition;
    const pos = chosen?.positions[byId.get(player.id)];
    // Contradictory EA position groups indicate a substitution or changed lineup.
    if (pos && GROUPS[pos] === player.position) player.lineupPosition = pos;
  }
  match.lineupSource = chosen?.messageId || null;
  return match;
}
function createLineupResolver(client, loadLinks = () => require('../power-ranking/store').load().links) {
  let cache = []; let at = 0; let cachedEvening = null;
  const images = new Map();
  return async match => {
    const evening=sessionKey(new Date(match.timestamp));
    try {
      if (cachedEvening !== evening || Date.now() - at > 10*60000) {
        cache=[];at=Date.now();cachedEvening=evening;
        const rows = [];
        for (const id of CHANNELS) {
          const channel = await client.channels.fetch(id);
          if (!channel?.messages?.fetch) throw new Error(`Aufstellungskanal ${id} nicht lesbar`);
          const messages=await channel.messages.fetch({limit:100});
          for(const message of messages.values()) {
            if(!message.author?.bot)continue;
            const old=parseSnapshot(message);if(old){rows.push(old);continue;}
            const files=[...(message.attachments?.values()||[])];
            const file=files.find(a=>/^lineup-.*-final\.png$/.test(a.name||''));if(!file)continue;
            const stamps=[message.createdTimestamp,message.editedTimestamp];
            if(!stamps.some(stamp=>Number.isFinite(stamp)&&stamp<=Date.parse(match.timestamp)&&Date.parse(match.timestamp)-stamp<=36*3600000))continue;
            let meta=images.get(file.url);
            if(meta===undefined){
              const response=await fetch(file.url,{signal:AbortSignal.timeout(15000)});
              if(!response.ok)continue;
              if(Number(response.headers.get('content-length'))>12*1024*1024)continue;
              meta=decodeSnapshot(Buffer.from(await response.arrayBuffer()));images.set(file.url,meta);
              if(images.size>100)images.delete(images.keys().next().value);
            }
            const row=parseDocument(meta,message.id);if(row)rows.push(row);
          }
        }
        cache=rows;
      }
      return resolveLineup(match, cache, loadLinks());
    } catch (error) {
      console.error('[friendly-matches] Positionsabgleich nicht verfügbar:', error.message);
      return match;
    }
  };
}
module.exports = { positionLabel, parseSnapshot, parseDocument, eveningKey, resolveLineup, createLineupResolver };
