import test from 'node:test';
import assert from 'node:assert/strict';
const listeners={};
const event=name=>({addListener:fn=>{listeners[name]=fn;}});
let data={},notifications=[],audioMessages=[],alarms=new Map(),badge='';
globalThis.chrome={
 tts:{stop:async()=>{},speak:(text,options,callback)=>callback()},
 storage:{local:{get:async()=>structuredClone(data),set:async value=>{data={...data,...structuredClone(value)};}}},
 runtime:{getURL:path=>'chrome-extension://test/'+path,onMessage:event('message'),onInstalled:event('install'),onStartup:event('startup'),getContexts:async()=>[{}],sendMessage:async message=>{audioMessages.push(message);return {ok:true};}},
 tabs:{query:async()=>[{id:1,windowId:1,url:'https://avala.ai/'}],sendMessage:async()=>({}),onRemoved:event('removed'),onUpdated:event('updated')},
 action:{setBadgeBackgroundColor:async()=>{},setBadgeText:async value=>{badge=value.text;}},
 notifications:{create:async(id,options)=>{notifications.push({id,...options});},onClicked:event('clicked')},
 alarms:{create:async(name,config)=>alarms.set(name,config),clear:async name=>alarms.delete(name),onAlarm:event('alarm')}
};
await import('../background.js');
const sender=id=>({tab:{id},frameId:0,url:'https://avala.ai/'});
const ui={url:'chrome-extension://test/popup.html'};
const request=(message,from=ui)=>new Promise(resolve=>listeners.message(message,from,resolve));
const scan=(ids,id=1)=>request({type:'SCAN_COMPLETED',result:{status:ids.length?'WORK_AVAILABLE':'NO_WORK',batches:ids.map(id=>({id})),url:'https://avala.ai/'}},sender(id));
test('worker serializes concurrent tabs, persists combined alerts and enforces message boundary',async()=>{
 await scan([]);
 await Promise.all([scan(['a','b']),scan(['a','b'],2)]);
 assert.equal(notifications.length,1);assert.match(notifications[0].message,/2 available work batches/);assert.equal(badge,'2');assert.equal(data.state.history.length,1);
 await scan(['a','b']);assert.equal(notifications.length,1);
 const rejected=await request({type:'CLEAR_KNOWN'},sender(1));assert.match(rejected.error,/Extension page/);assert.equal(Object.keys(data.state.knownBatches).length,2);
 await request({type:'SAVE_SETTINGS',settings:{...data.settings,cooldown:60,desktop:true,detectNew:true}});
 await scan(['a','b','c']);assert.equal(notifications.length,1);assert.equal(Object.keys(data.state.queue).length,1);assert.ok(alarms.has('queue'));
 await request({type:'CLEAR_KNOWN'});assert.equal(Object.keys(data.state.queue).length,0);assert.equal(data.state.baseline,false);
});
test('settings tab can load, save, reload and send a test alert',async()=>{
 const settingsTab={tab:{id:99},frameId:0,url:'chrome-extension://test/options.html'};
 const initial=await request({type:'GET_STATE'},settingsTab);
 assert.ok(initial.settings);assert.equal(initial.error,undefined);
 const selected={...initial.settings,desktop:true,sound:true,inPage:true,badge:true,alertChanges:true,initialAlert:true,volume:85,retentionDays:14};
 assert.equal((await request({type:'SAVE_SETTINGS',settings:selected},settingsTab)).ok,true);
 // New document/tab sender after reload still reads the persisted selections.
 const reloaded=await request({type:'GET_STATE'},{...settingsTab,documentId:'reloaded-document'});
 assert.deepEqual(reloaded.settings,selected);
 const count=notifications.length;
 assert.equal((await request({type:'TEST_ALERT'},settingsTab)).ok,true);
 assert.equal(notifications.length,count+1);assert.equal(notifications.at(-1).id,'avala-test');
 for(const url of ['https://avala.ai/options.html','chrome-extension://other/options.html','chrome-extension://test/offscreen.html']) {
  const response=await request({type:'SAVE_SETTINGS',settings:{}},{tab:{id:99},url});
  assert.match(response.error,/Extension page required/);
 }
});

test('known available job plays sound once for each refreshed document',async()=>{
 await request({type:'SAVE_SETTINGS',settings:{...data.settings,alertOnRefresh:true,cooldown:0,sound:true,volume:80}});
 const report=documentId=>request({type:'SCAN_COMPLETED',result:{status:'WORK_AVAILABLE',batches:[{id:'f6c2f3'}]}},{...sender(1),documentId});
 const count=audioMessages.length;
 await report('dashboard-first');assert.equal(audioMessages.length,count+1);
 assert.equal(audioMessages.at(-1).target,'audio');assert.equal(audioMessages.at(-1).volume,80);
 await report('dashboard-first');assert.equal(audioMessages.length,count+1);
 await report('dashboard-refresh');assert.equal(audioMessages.length,count+2);
});
