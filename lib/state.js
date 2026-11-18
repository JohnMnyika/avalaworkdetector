const DAY=86400000;
const changed=(a,b)=>['name','type','category','claimed','done','url'].some(k=>(a[k]??null)!==(b[k]??null));
export function applyScan(state,settings,result,tabId,now=Date.now()) {
 if(!state.stats||typeof state.stats!=='object') state.stats={day:'',detections:0,notifications:0};
 if(!state.knownBatches||typeof state.knownBatches!=='object'||Array.isArray(state.knownBatches)) state.knownBatches={};
 if(!state.queue||typeof state.queue!=='object'||Array.isArray(state.queue)) state.queue={};
 if(!state.tabs||typeof state.tabs!=='object'||Array.isArray(state.tabs)) state.tabs={};
 if(!Array.isArray(state.history)) state.history=[];
 if(!Array.isArray(state.unread)) state.unread=[];
 const date=new Date(now),day=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
 if(state.stats.day!==day) state.stats={day,detections:0,notifications:0};
 state.lastScanTime=now;
 const previousTab=state.tabs[tabId];
 const documentAlerted=previousTab?.pageId===result.pageId&&previousTab?.documentAlerted===true;
 const refreshAlert=settings.alertOnRefresh&&result.pageId&&!documentAlerted&&result.status==='WORK_AVAILABLE';
 state.tabs[tabId]={...result,timestamp:now,documentAlerted:documentAlerted||!!refreshAlert};
 if(!['NO_WORK','WORK_AVAILABLE'].includes(result.status)) {state.lastError=result.error||null;return;}
 state.lastSuccessfulScan=now;state.lastError=null;
 for(const id of result.inProgressIds||[]) {
  delete state.queue['id:'+id];
  state.unread=state.unread.filter(unread=>unread!==id);
 }

 const baseline=!state.baseline&&!settings.initialAlert;
 const visible=new Set(result.batches.map(b=>b.id));
 for(const [key,known] of Object.entries(state.knownBatches)) {
  if(now-known.lastSeen>settings.retentionDays*DAY) delete state.knownBatches[key];
  else if(!visible.has(known.id)&&!Object.values(state.tabs).some(t=>now-t.timestamp<30000&&t.batches?.some(b=>b.id===known.id))) known.missingSince??=now;
 }
 for(const batch of result.batches) {
  const key='id:'+batch.id, previous=state.knownBatches[key];
  const returned=previous?.missingSince&&settings.realertHours>0&&now-previous.missingSince>=settings.realertHours*3600000;
  const isNew=!previous||returned;
  const updated=previous&&changed(previous,batch);
  state.knownBatches[key]={...batch,firstSeen:previous?.firstSeen??now,lastSeen:now,missingSince:null};
  if(refreshAlert||!baseline&&((isNew&&settings.detectNew)||(updated&&settings.alertChanges))) {
   const type=refreshAlert?'WORK_AVAILABLE':isNew?'NEW_BATCH':'BATCH_UPDATED';
   const old=state.queue[key];
   state.queue[key]={batch,type:old?.type==='NEW_BATCH'?'NEW_BATCH':type,previous:old?.previous||previous,tabId,timestamp:now};
   if(isNew) state.stats.detections++;
   if((isNew||refreshAlert)&&!state.unread.includes(batch.id)) state.unread.push(batch.id);
  }
 }
 state.baseline=true;
 if(!Object.values(state.tabs).some(t=>t.status==='WORK_AVAILABLE')) state.unread=[];
}
export function nextAlertAt(state,settings,now=Date.now()) {return Object.keys(state.queue).length?Math.max(now,state.lastNotification+settings.cooldown*1000):null;}
