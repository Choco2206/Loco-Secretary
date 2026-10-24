'use strict';
// Ancillary PNG metadata: Discord displays the unchanged image, never a positions embed.
const SIGNATURE = Buffer.from([137,80,78,71,13,10,26,10]);
const KEY = 'loco-lineup-v2';
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) { crc ^= byte; for (let i=0;i<8;i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunks(png) {
  if (!Buffer.isBuffer(png) || png.length > 12*1024*1024 || !png.subarray(0,8).equals(SIGNATURE)) throw Error('Ungültige Aufstellungs-PNG');
  const rows=[];
  for(let offset=8;offset+12<=png.length;) {
    const size=png.readUInt32BE(offset);const end=offset+12+size;
    if(end>png.length) throw Error('Beschädigte PNG');
    const type=png.toString('ascii',offset+4,offset+8);const data=png.subarray(offset+8,end-4);
    if(crc32(png.subarray(offset+4,end-4))!==png.readUInt32BE(end-4)) throw Error('PNG-Prüfsumme ungültig');
    rows.push({type,data,bytes:png.subarray(offset,end)});offset=end;
    if(type==='IEND') return rows;
  }
  throw Error('PNG-Ende fehlt');
}
function encodeSnapshot(png, snapshot) {
  const rows=chunks(png);const body=Buffer.from(`${KEY}\0${JSON.stringify(snapshot)}`,'latin1');
  if(body.length>16384) throw Error('Aufstellungsdaten zu groß');
  const type=Buffer.from('tEXt');const chunk=Buffer.alloc(body.length+12);
  chunk.writeUInt32BE(body.length);type.copy(chunk,4);body.copy(chunk,8);chunk.writeUInt32BE(crc32(Buffer.concat([type,body])),8+body.length);
  const parts=[SIGNATURE];
  for(const row of rows) {
    if(row.type==='tEXt' && row.data.subarray(0,KEY.length+1).toString('latin1')===`${KEY}\0`) continue;
    if(row.type==='IEND')parts.push(chunk);
    parts.push(row.bytes);
  }
  return Buffer.concat(parts);
}
function decodeSnapshot(png) {
  try {
    const row=chunks(png).find(r=>r.type==='tEXt' && r.data.subarray(0,KEY.length+1).toString('latin1')===`${KEY}\0`);
    return row && row.data.length<=16384 ? JSON.parse(row.data.subarray(KEY.length+1).toString('latin1')) : null;
  } catch {return null;}
}
module.exports={encodeSnapshot,decodeSnapshot};
