'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const { decodeEvents } = require('../friendly-matches/events');
const { parseSnapshot, resolveLineup } = require('../friendly-matches/lineup');
const { parseMatch } = require('../friendly-matches/model');
const { buildPayload } = require('../friendly-matches/renderer');
const { buildAnalysis } = require('../friendly-matches/analysis');
const fixture = require('./fixtures/friendly-match.json');
const rawEvents = { match_event_aggregate_0: '215:10,216:2,30:6,32:2,34:2,24:5,26:3,28:2,6:3,265:2,266:1,105:2,110:3', match_event_aggregate_1: '', match_event_aggregate_2: '', match_event_aggregate_3: '', passesmade:'10', passattempts:'12' };
test('missing, malformed, duplicate and partial event streams are not invented as valid breakdowns', () => {
 assert.equal(decodeEvents({}), null);
 assert.equal(decodeEvents({...rawEvents, match_event_aggregate_1: 'broken'}), null);
 assert.equal(decodeEvents({...rawEvents, match_event_aggregate_1: '215:3'}), null);
 assert.equal(decodeEvents({...rawEvents, passesmade:'99'}).passingComplete, false);
 const e = decodeEvents(rawEvents); assert.equal(e.forward,6); assert.equal(e.aerialDefense,1); assert.equal(e.passingComplete,true);
});
test('final lineup maps EA identities, respects the match date, substitutes, duplicate links and EA conflicts', () => {
 const match = parseMatch(structuredClone(fixture));
 const players = match.own.players.slice(0, 3);
 const positions = {goalkeeper:'TW',defender:'ZIV',midfielder:'RM',forward:'LS'};
 const links = Object.fromEntries(players.map((p,i) => [`${100+i}`,{playerId:p.id}]));
 const p = require('../friendly-matches/model').localParts(new Date(match.timestamp));
 const snap = {day:`${p.year}-${p.month}-${p.day}`, start:0, published:Date.parse(match.timestamp)-60000, positions:Object.fromEntries(players.map((p,i)=>[`${100+i}`,positions[p.position]])),messageId:'final'};
 snap.start = +p.hour*60 + +p.minute;
 resolveLineup(match,[snap],links); assert.equal(match.lineupSource,'final'); assert.ok(players.every(p=>p.lineupPosition));
 match.own.players.push({id:'helper',position:'midfielder'}); resolveLineup(match,[snap],links); assert.equal(match.own.players.at(-1).lineupPosition,undefined);
 resolveLineup(match,[{...snap,published:Date.parse(match.timestamp)+1}],links); assert.ok(players.every(p=>!p.lineupPosition));
 resolveLineup(match,[snap],{...links,duplicate:{playerId:players[0].id}}); assert.equal(match.lineupSource,null);
});
test('snapshot is read only from a dated final publication and validates unique Discord users', () => {
 const message = {id:'x',author:{bot:true},embeds:[{footer:{text:'Loco Lineup · v1 · nightcup'},timestamp:'2026-10-23T18:00:00Z',description:'Datum: 23.10.2026\nStart: 23:00',fields:[{name:'RM',value:'<@123>'}]}]};
 assert.equal(parseSnapshot(message).positions['123'],'RM'); message.author.bot=false; assert.equal(parseSnapshot(message),null);
});
test('11 detailed player rows fit Discord limits and retain missing-data and event provenance', async () => {
 const m=parseMatch(structuredClone(fixture));
 for (const p of m.own.players) p.events=decodeEvents(rawEvents);
 const payload = await buildPayload(m,[null,null]); const embeds=payload.embeds.map(e=>e.toJSON());
 const n=embeds.reduce((n,e)=>n+(e.title?.length||0)+(e.description?.length||0)+(e.footer?.text?.length||0)+(e.fields||[]).reduce((n,f)=>n+f.name.length+f.value.length,0),0);
 assert.ok(n<=6000); assert.ok(embeds.every(e=>(e.fields||[]).every(f=>f.value.length<=1024)));
 const analysis=embeds.at(-1); assert.ok(analysis.fields.some(f=>/Balleroberung/.test(f.name)));
 assert.equal(analysis.fields.filter(f=>/ · /.test(f.name)).length,m.own.players.length);
 const partial=structuredClone(m); partial.own.players[0].events=null;
 assert.ok(!JSON.stringify(buildAnalysis(partial).toJSON()).includes('empfangene Pässe:'));
 m.termination='early'; assert.ok(buildAnalysis(m).toJSON().fields.every(f=>/Keine reguläre/.test(f.value)));
});
