import {readStore,saveState,saveSettings} from './lib/storage.js';
import {applyScan,nextAlertAt} from './lib/state.js';
let chain=Promise.resolve();
function serial(task) {const next=chain.then(task);chain=next.catch(console.error);return next;}
function isExtensionUI(sender) {
 const page=sender.url?.split(/[?#]/)[0];
 return ['options.html','popup.html'].some(path=>page===chrome.runtime.getURL(path));
}
const avalaTabs=()=>chrome.tabs.query({url:'https://avala.ai/*'});
async function focusWork(preferred) {
 const tabs=await avalaTabs(),tab=tabs.find(t=>t.id===preferred)||tabs.find(t=>t.active)||tabs[0];
 if(!tab) return chrome.tabs.create({url:'https://avala.ai/'});
 await chrome.windows.update(tab.windowId,{focused:true});await chrome.tabs.update(tab.id,{active:true});
 await chrome.tabs.sendMessage(tab.id,{type:'VIEW_WORK'}).catch(()=>{});
}
async function badge(state,settings,test=false) {
 await chrome.action.setBadgeBackgroundColor({color:'#ed6818'});
 await chrome.action.setBadgeText({text:settings.badge?(test?'TEST':state.unread.length?String(state.unread.length):''):''});
}
async function stopAlert() {
 await chrome.tts.stop();
 const contexts=await chrome.runtime.getContexts({contextTypes:['OFFSCREEN_DOCUMENT']});
 if(contexts.length) await chrome.runtime.sendMessage({target:'audio',action:'stop'});
}
async function sound(settings,phrase) {
 const contexts=await chrome.runtime.getContexts({contextTypes:['OFFSCREEN_DOCUMENT']});
 if(!contexts.length) await chrome.offscreen.createDocument({url:'offscreen.html',reasons:['AUDIO_PLAYBACK'],justification:'Play the user-enabled work notification chime.'});
 const response=await chrome.runtime.sendMessage({target:'audio',volume:settings.volume,mode:settings.soundMode,repeat:settings.repeatSound,phrase});
 if(response?.error) throw Error(response.error);
}
async function channels(state,settings,entries,test=false) {
 const newCount=entries.filter(e=>['NEW_BATCH','WORK_AVAILABLE'].includes(e.type)).length;
 const message=test?'This is a test notification.':`${newCount?`${newCount} available work batch${newCount===1?'':'es'}`:''}${newCount&&newCount<entries.length?' · ':''}${entries.length>newCount?`${entries.length-newCount} updated batch(es)`:''} detected.\n${entries.slice(0,4).map(e=>e.batch.id+(e.type==='BATCH_UPDATED'?` (Claimed: ${e.previous?.claimed??'—'} → ${e.batch.claimed??'—'}, Done: ${e.previous?.done??'—'} → ${e.batch.done??'—'})`:'')).join(', ')}`;
 const errors=[];
 async function attempt(label,task) {try {await task();}catch(e){errors.push(`${label}: ${e.message}`);}}
 if(settings.desktop) await attempt('Desktop',()=>chrome.notifications.create(test?'avala-test':'avala-work',{type:'basic',iconUrl:'icons/icon128.png',title:newCount||test?'Avala Work Available':'Avala Work Updated',message,priority:2,silent:true}));
 if(settings.sound&&settings.volume>0) await attempt('Sound',()=>sound(settings,newCount||test?'Work has just arrived. Please check Avala.':'Available work has been updated. Please check Avala.'));
 await attempt('Badge',()=>badge(state,settings,test));
 if(settings.inPage) {
  const tabs=await avalaTabs();
  await Promise.all(tabs.map(t=>chrome.tabs.sendMessage(t.id,{type:'SHOW_ALERT',message,duration:settings.duration}).catch(()=>{})));
 }
 if(errors.length) state.lastError=errors.join('; ');
 return errors;
}
async function flush(state,settings) {
 const when=nextAlertAt(state,settings);
 if(when===null) {await chrome.alarms.clear('queue');return;}
 if(when>Date.now()) {await chrome.alarms.create('queue',{when});return;}
 const entries=Object.values(state.queue);
 // Persist consumption before side effects: prevent replay after a worker crash.
 state.queue={};state.lastNotification=Date.now();state.stats.notifications++;
 state.history.unshift({type:entries.some(e=>['NEW_BATCH','WORK_AVAILABLE'].includes(e.type))?'WORK_AVAILABLE':'BATCH_UPDATED',batchIds:entries.map(e=>e.batch.id),timestamp:state.lastNotification,tabId:entries[0]?.tabId,delivery:'attempting'});
 state.history=state.history.slice(0,50);await saveState(state);
 const errors=await channels(state,settings,entries);
 state.history[0].delivery=errors.length?'channel-error':'sent';await saveState(state);
 await chrome.alarms.clear('queue');
}
function normalizeResult(input) {
 if(!input||!['WORK_AVAILABLE','NO_WORK','LOADING','ERROR'].includes(input.status)||!Array.isArray(input.batches)) throw Error('Invalid scan result');
 const batches=input.batches.slice(0,2000).filter(b=>typeof b.id==='string'&&b.id.length>0&&b.id.length<=1000).map(b=>Object.fromEntries(Object.entries(b).filter(([k,v])=>['id','name','type','category','claimed','done','url'].includes(k)&&['string','number'].includes(typeof v))));
 if(input.status==='WORK_AVAILABLE'&&!batches.length) throw Error('Work result has no stable identities');
 return {inProgressIds:Array.isArray(input.inProgressIds)?input.inProgressIds.filter(id=>typeof id==='string'&&id.length<=1000).slice(0,2000):[],status:input.status,batches:input.status==='WORK_AVAILABLE'?batches:[],found:!!input.found,error:String(input.error||'').slice(0,500),url:String(input.url||'').slice(0,1000),lastMutation:Number(input.lastMutation)||0};
}
async function handle(message,sender) {
 const {state,settings}=await readStore();
 const ui=isExtensionUI(sender);
 if(message.type==='SCAN_COMPLETED') {
  if(!sender.tab||sender.frameId!==0||new URL(sender.url).origin!=='https://avala.ai') throw Error('Untrusted scan');
  const result=normalizeResult(message.result);
  result.pageId=sender.documentId||(typeof message.result.pageId==='string'?message.result.pageId.slice(0,100):undefined);
  applyScan(state,settings,result,sender.tab.id);
  await saveState(state);await badge(state,settings);await flush(state,settings);return {ok:true};
 }
 if(!ui) throw Error('Extension page required');
 if(message.type==='GET_STATE') {
  const tabs=await avalaTabs(),ids=new Set(tabs.map(t=>String(t.id)));
  for(const id of Object.keys(state.tabs)) if(!ids.has(id)) delete state.tabs[id];
  const candidates=Object.entries(state.tabs).sort((a,b)=>b[1].timestamp-a[1].timestamp);
  return {state,settings,current:candidates.find(([,t])=>t.status==='WORK_AVAILABLE')?.[1]||candidates[0]?.[1]||{status:tabs.length?'LOADING':'NOT_ON_AVALA',batches:[]}};
 }
 if(message.type==='STOP_ALERT') {await stopAlert();return {ok:true};}
 if(message.type==='SAVE_SETTINGS') {await stopAlert();const updated=await saveSettings(message.settings);await badge(state,updated);await flush(state,updated);return {ok:true};}
 if(message.type==='CLEAR_KNOWN') {state.knownBatches={};state.queue={};state.unread=[];state.baseline=false;await saveState(state);await badge(state,settings);await chrome.alarms.clear('queue');return {ok:true};}
 if(message.type==='ACKNOWLEDGE') {await stopAlert();state.unread=[];await saveState(state);await badge(state,settings);return {ok:true};}
 if(message.type==='OPEN_AVALA') {await focusWork();return {ok:true};}
 if(message.type==='TEST_ALERT') {state.lastError=null;await channels(state,settings,[],true);await saveState(state);await chrome.alarms.create('test-badge',{when:Date.now()+30000});return {ok:true,error:state.lastError};}
 throw Error('Unknown message');
}
chrome.runtime.onMessage.addListener((message,sender,respond)=>{
 if(message.target==='audio') return;
 if(message.type==='SPEAK_ALERT'&&sender.url===chrome.runtime.getURL('offscreen.html')) {
  chrome.tts.speak(message.phrase||'Work has just arrived. Please check Avala.',{volume:Math.min(1,Math.max(0,Number(message.volume)||0)),rate:1,enqueue:false},()=>{
   const error=chrome.runtime.lastError?.message;
   respond(error?{error}:{ok:true});
   if(error) serial(async()=>{const {state}=await readStore();state.lastError='Voice: '+error;await saveState(state);});
  });return true;
 }

 // Do not hold the state lock while waiting for a content script to send its scan.
 if(message.type==='SCAN_NOW'&&isExtensionUI(sender)) {
  avalaTabs().then(async tabs=>{if(!tabs.length) throw Error('Open Avala to begin monitoring.');const results=await Promise.allSettled(tabs.map(t=>chrome.tabs.sendMessage(t.id,{type:'SCAN_NOW'})));if(results.every(r=>r.status==='rejected')) throw Error('Reload the Avala dashboard once to connect the extension.');return {ok:true};}).then(respond,e=>respond({error:e.message}));return true;
 }
 serial(()=>handle(message,sender)).then(respond,e=>respond({error:e.message}));return true;
});
chrome.alarms.onAlarm.addListener(alarm=>serial(async()=>{const {state,settings}=await readStore();if(alarm.name==='queue'||alarm.name==='maintenance') await flush(state,settings);if(alarm.name==='test-badge') await badge(state,settings);if(alarm.name==='maintenance'){for(const [key,b] of Object.entries(state.knownBatches)) if(Date.now()-b.lastSeen>settings.retentionDays*86400000) delete state.knownBatches[key];await saveState(state);}}));
chrome.notifications.onClicked.addListener(id=>{if(id.startsWith('avala-')) serial(async()=>{const {state,settings}=await readStore();await stopAlert();state.unread=[];await saveState(state);await badge(state,settings);await focusWork(state.history[0]?.tabId);await chrome.notifications.clear(id);});});
chrome.tabs.onRemoved.addListener(id=>serial(async()=>{const {state,settings}=await readStore();delete state.tabs[id];if(!Object.values(state.tabs).some(t=>t.status==='WORK_AVAILABLE')) state.unread=[];await saveState(state);await badge(state,settings);}));
chrome.tabs.onUpdated.addListener((id,change)=>{if(change.status==='loading') serial(async()=>{const {state}=await readStore();delete state.tabs[id];await saveState(state);});});
async function recover() {const {state,settings}=await readStore();await chrome.alarms.create('maintenance',{periodInMinutes:60});await badge(state,settings);await flush(state,settings);}
chrome.runtime.onInstalled.addListener(()=>serial(recover));
chrome.runtime.onStartup.addListener(()=>serial(recover));
serial(recover);
