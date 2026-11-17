const $=id=>document.getElementById(id);
const time=value=>value?new Date(value).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'}):'—';
const request=async(type,extra={})=>{const result=await chrome.runtime.sendMessage({type,...extra});if(result?.error) throw Error(result.error);return result;};
async function render() {
 const {state,settings,current}=await request('GET_STATE');
 const names={NO_WORK:'No work available',WORK_AVAILABLE:'Work available',LOADING:'Waiting for dashboard',ERROR:'Dashboard unavailable',NOT_ON_AVALA:'Open Avala to begin'};
 $('status').dataset.status=current.status;$('statusTitle').textContent=names[current.status];
 $('connection').textContent=['WORK_AVAILABLE','NO_WORK'].includes(current.status)?'● Monitoring Avala':'○ '+(current.status==='NOT_ON_AVALA'?'Not connected':'Waiting for a valid scan');
 $('statusDetail').textContent=current.status==='WORK_AVAILABLE'?`${current.batches.length} visible · ${state.unread.length} unseen`:current.status==='NO_WORK'?(current.inProgressIds?.length?`${current.inProgressIds.length} already picked · Waiting for new work…`:'Monitoring dashboard…'):current.error||'Keep your logged-in worker dashboard open.';
 $('detections').textContent=state.stats.day===new Date().toLocaleDateString('en-CA')?state.stats.detections:0;$('notifications').textContent=state.stats.day===new Date().toLocaleDateString('en-CA')?state.stats.notifications:0;
 $('lastScan').textContent=time(state.lastScanTime);$('lastAlert').textContent=time(state.lastNotification);
 $('batches').replaceChildren();
 for(const batch of current.batches||[]) {const card=document.createElement('div');card.className='batch';const title=document.createElement('h3');title.textContent=batch.name||batch.id;const type=document.createElement('p');type.textContent=batch.type||'Work batch';const counts=document.createElement('p');counts.textContent=`Claimed: ${batch.claimed??'—'}  ·  Done: ${batch.done??'—'}`;card.append(title,type,counts);$('batches').append(card);}
 if(!(current.batches||[]).length) {
  const empty=document.createElement('div');empty.className='empty-state';
  const title=document.createElement('strong'),detail=document.createElement('p');
  if(current.status==='NO_WORK') {title.textContent='You’re all caught up';detail.textContent=current.inProgressIds?.length?'Picked tasks are in progress. New available work will appear here.':'No available batches right now. The dashboard is being monitored.';}
  else if(current.status==='WORK_AVAILABLE') {title.textContent='Work is available';detail.textContent='Batch details are still loading. Try Scan now in a moment.';}
  else if(current.status==='ERROR') {title.textContent='Can’t read the dashboard';detail.textContent=current.error||'Check that the worker dashboard is open, then scan again.';}
  else if(current.status==='NOT_ON_AVALA') {title.textContent='Open the worker dashboard';detail.textContent='Sign in to Avala and open Available Work to start monitoring.';}
  else {title.textContent='Waiting for dashboard';detail.textContent='Keep your logged-in Avala worker dashboard open.';}
  empty.append(title,detail);$('batches').append(empty);
 }
 $('history').replaceChildren();for(const event of state.history.slice(0,5)) {const p=document.createElement('p');p.className='help';p.textContent=`${time(event.timestamp)} · ${event.batchIds.length} ${event.type==='NEW_BATCH'?'new':'updated'} · ${event.delivery}`;$('history').append(p);}
 $('debugPanel').hidden=!settings.debug;$('debug').textContent=JSON.stringify({url:current.url,status:current.status,sectionFound:current.found,visible:current.batches?.length,known:Object.keys(state.knownBatches).length,queue:Object.keys(state.queue).length,lastMutation:time(current.lastMutation),lastSuccessfulScan:time(state.lastSuccessfulScan),lastError:state.lastError},null,2);
 $('feedback').textContent=state.lastError||'';
}
for(const [id,type] of [['open','OPEN_AVALA'],['scan','SCAN_NOW'],['ack','ACKNOWLEDGE'],['stop','STOP_ALERT']]) $(id).onclick=async()=>{try{$(id).disabled=true;$('feedback').textContent='';await request(type);await render();}catch(e){$('feedback').textContent=e.message;}finally{$(id).disabled=false;}};
$('options').onclick=()=>chrome.runtime.openOptionsPage();
chrome.storage.onChanged.addListener(()=>render().catch(e=>$('feedback').textContent=e.message));render().catch(e=>$('feedback').textContent=e.message);
