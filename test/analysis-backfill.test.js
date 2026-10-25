'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const {backfillAnalysis,assertImagePayload,IMAGE_REPAIR_VERSION}=require('../friendly-matches/service');
const {LAYOUT_VERSION,buildPayload}=require('../friendly-matches/renderer');
const {ANALYSIS_VERSION,buildAnalysis}=require('../friendly-matches/analysis');
const {EmbedBuilder}=require('discord.js');
const fixture=require('./fixtures/friendly-match.json');
const {parseMatch}=require('../friendly-matches/model');
function harness(){
 let edits=[];let deleted=0;
 const data={posted:{[fixture.matchId]:{messageId:'msg',layoutVersion:LAYOUT_VERSION,imageRepairVersion:IMAGE_REPAIR_VERSION,durationPolicyVersion:1,analysisPresent:true,analysisVersion:ANALYSIS_VERSION}}};
 const names=['ergebnis.png','loco-squad.png','gegner.png'];
 const attachments=new Map(names.map((name,i)=>[String(i),{id:String(i),name,url:`https://cdn.discordapp.com/attachments/1/2/${name}`} ]));
 const summary=new EmbedBuilder().setFooter({text:`Friendly Match · ${fixture.matchId}`}).setTitle('Loco Squad 0:4 TSG Purion');
 const message={author:{id:'bot'},attachments,embeds:[new EmbedBuilder().setImage(attachments.get('0').url).setFooter({text:`Friendly Layout · ${LAYOUT_VERSION}`}),summary,new EmbedBuilder().setImage(attachments.get('1').url),new EmbedBuilder().setImage(attachments.get('2').url),buildAnalysis(parseMatch(fixture))].map(e=>e.toJSON()),
 edit:async p=>{edits.push(p);message.embeds=p.embeds.map(e=>e.toJSON?.()||e);},delete:async()=>{deleted++;}};
 return {data,message,channel:{messages:{fetch:async()=>message}},save:()=>{},get edits(){return edits;},get deleted(){return deleted;}};
}
const options={buildPayload:m=>buildPayload(m,[null,null])};
test('an old image revision is atomically replaced by three real PNG buffers with unique matching names',async()=>{
 const h=harness();h.data.posted[fixture.matchId].imageRepairVersion=1;
 assert.equal(await backfillAnalysis(h.channel,'bot',[fixture],h.data,h.save,options),1);
 const p=h.edits[0];assertImagePayload(p);assert.deepEqual(p.attachments,[]);
 assert.equal(p.embeds.length,5);assert.equal(p.files.length,3);
 assert.ok(p.files.every(f=>f.name.includes(fixture.matchId)&&f.name.includes(`v${LAYOUT_VERSION}`)));
 assert.equal(h.data.posted[fixture.matchId].imageRepairVersion,IMAGE_REPAIR_VERSION);
 await backfillAnalysis(h.channel,'bot',[fixture],h.data,h.save,options);assert.equal(h.edits.length,1);
});
test('analysis-only edits keep uploaded image IDs and direct CDN references without reuploading expiring URLs',async()=>{
 const h=harness();h.data.posted[fixture.matchId].analysisVersion=1;
 // Current implementation regenerates all images when raw stats are available.
 await backfillAnalysis(h.channel,'bot',[fixture],h.data,h.save,options);assertImagePayload(h.edits[0]);
 const other=harness();other.data.posted[fixture.matchId].layoutVersion=1;other.message.embeds[0].footer.text='Friendly Layout · 1';
 await backfillAnalysis(other.channel,'bot',[],other.data,other.save,options);
 const edit=other.edits[0];assert.equal(edit.files,undefined);assert.deepEqual(edit.attachments.map(a=>a.id),['0','1','2']);
 assert.equal(edit.embeds[0].data.image.url,other.message.attachments.get('0').url);
});
test('saved raw matches restore lost graphics even after EA no longer returns the game',async()=>{
 const h=harness();h.data.posted[fixture.matchId].imageRepairVersion=1;h.data.matchCache={[fixture.matchId]:{raw:fixture}};
 h.message.attachments=new Map();h.message.embeds=h.message.embeds.filter(e=>e.footer?.text?.startsWith('Friendly Match')||e.title?.startsWith('🔎'));
 await backfillAnalysis(h.channel,'bot',[],h.data,h.save,options);assertImagePayload(h.edits[0]);
});
test('a failed upload or incomplete renderer payload leaves the old post intact and retries later',async()=>{
 const h=harness();h.data.posted[fixture.matchId].imageRepairVersion=1;
 await backfillAnalysis(h.channel,'bot',[fixture],h.data,h.save,{buildPayload:async()=>({files:[],embeds:[]})});
 assert.equal(h.edits.length,0);assert.equal(h.data.posted[fixture.matchId].imageRepairVersion,1);
 const edit=h.message.edit;h.message.edit=async()=>{throw Error('Discord offline');};
 await backfillAnalysis(h.channel,'bot',[fixture],h.data,h.save,options);assert.equal(h.edits.length,0);
 h.message.edit=edit;await backfillAnalysis(h.channel,'bot',[fixture],h.data,h.save,options);assert.equal(h.edits.length,1);
});
test('unrelated authors or match markers are never edited',async()=>{
 const h=harness();h.data.posted[fixture.matchId].imageRepairVersion=1;h.message.author.id='other';
 await backfillAnalysis(h.channel,'bot',[fixture],h.data,h.save,options);assert.equal(h.edits.length,0);
 h.message.author.id='bot';h.message.embeds=h.message.embeds.filter(e=>!e.footer?.text?.startsWith('Friendly Match'));
 await backfillAnalysis(h.channel,'bot',[fixture],h.data,h.save,options);assert.equal(h.edits.length,0);
});
test('known games under 50 minutes are removed and failed deletion remains retryable',async()=>{
 const h=harness();h.data.posted[fixture.matchId].durationSeconds=2999;
 await backfillAnalysis(h.channel,'bot',[],h.data,h.save,options);assert.equal(h.deleted,1);assert.equal(h.data.posted[fixture.matchId].suppressed,true);
});
test('all three actual recent Friendlies render with all graphics and available stats despite empty event counters',async()=>{
 const games=require('../friendly-matches/repair-matches.json');assert.equal(games.length,3);
 for(const raw of games){const m=parseMatch(raw);assert.ok(m);assert.ok(m.own.players.every(p=>p.events===null));const p=await buildPayload(m,[null,null]);assertImagePayload(p);assert.equal(p.embeds.at(-1).data.fields.length,5);assert.ok(!p.embeds.at(-1).data.description.includes('→'));}
});
