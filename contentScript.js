(() => {
 if(globalThis.__avalaMonitor) globalThis.__avalaMonitor();
 let settings={},timer,observer,root,stopped=false,lastMutation=0,lastSignature='',lastUrl=location.href,toastTimer;
 const retries=[];
 const pageId=crypto.randomUUID();
 const send=message=>chrome.runtime.sendMessage(message);
 function scroll() {AvalaDetector.findAvailableWorkSection(settings)?.heading.scrollIntoView({behavior:'smooth',block:'center'});}
 function toast(message,duration) {
  document.getElementById('avala-alert-pro')?.remove();clearTimeout(toastTimer);
  const host=document.createElement('div');host.id='avala-alert-pro';
  const shadow=host.attachShadow({mode:'closed'});
  const style=document.createElement('style');style.textContent=':host{all:initial;position:fixed;right:20px;bottom:24px;z-index:2147483647;font:14px system-ui;color:#fafafa}section{width:280px;background:#1f1f1f;border:1px solid #ff781f;border-radius:14px;padding:18px;box-shadow:0 8px 35px #0008}strong{font-size:12px;letter-spacing:.08em}p{line-height:1.5}button{font:inherit;border:1px solid #555;border-radius:7px;background:#292929;color:white;padding:7px 12px;margin-right:8px;cursor:pointer}button:focus-visible{outline:2px solid #ff781f}';
  const box=document.createElement('section');box.setAttribute('role','status');
  const title=document.createElement('strong');title.textContent='AVALA WORK ALERT PRO';
  const body=document.createElement('p');body.textContent=message;
  const view=document.createElement('button');view.textContent='View Work';view.onclick=scroll;
  const dismiss=document.createElement('button');dismiss.textContent='Dismiss';dismiss.onclick=()=>host.remove();
  box.append(title,body,view,dismiss);shadow.append(style,box);document.documentElement.append(host);
  toastTimer=setTimeout(()=>host.remove(),duration*1000);
 }
 async function scan(force=false) {
  if(stopped) return;
  const result={...AvalaDetector.scan(settings),url:location.href,lastMutation,pageId};
  const signature=JSON.stringify({...result,timestamp:0,lastMutation:0});
  try {
   if(force||signature!==lastSignature) {await send({type:'SCAN_COMPLETED',result});lastSignature=signature;}
   if(settings.debug) console.debug('[Avala Alert]',result.status,result.batches.length,result.error||'');
  } catch(error) {if(settings.debug) console.debug('[Avala Alert]',error.message);}
  bind();return result;
 }
 function schedule() {clearTimeout(timer);timer=setTimeout(()=>scan(),400);}
 function bind() {
  let candidate;
  try {candidate=AvalaDetector.findAvailableWorkSection(settings)?.root;} catch {}
  if(candidate===root&&observer) return;
  observer?.disconnect();root=candidate;
  if(root) {observer=new MutationObserver(()=>{lastMutation=Date.now();schedule();});observer.observe(root,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['hidden','aria-hidden','class','style','href']});}
 }
 // Lightweight discovery outside the section, debounced; no processing per node.
 const discovery=new MutationObserver(records=>{
  if(records.every(r=>r.target.id==='avala-alert-pro'||Array.from(r.addedNodes).every(n=>n.nodeType===1&&n.id==='avala-alert-pro')&&r.addedNodes.length)) return;
  // Cards can arrive beside the heading's provisional container after hydration.
  if(!root||!root.isConnected||location.href!==lastUrl||records.some(r=>!root.contains(r.target))) {lastUrl=location.href;schedule();}
 });
 discovery.observe(document.documentElement,{childList:true,subtree:true});
 const onNavigate=()=>{lastSignature='';schedule();};
 addEventListener('popstate',onNavigate);addEventListener('hashchange',onNavigate);addEventListener('load',onNavigate);
 const onMessage=(message,sender,respond)=>{
  if(message.type==='SCAN_NOW') {scan(true).then(respond);return true;}
  if(message.type==='SHOW_ALERT') toast(message.message,message.duration);
  if(message.type==='VIEW_WORK') scroll();
 };
 chrome.runtime.onMessage.addListener(onMessage);
 const onStorage=(changes,area)=>{if(area==='local'&&changes.settings){settings=changes.settings.newValue||{};lastSignature='';scan(true);}};
 chrome.storage.onChanged.addListener(onStorage);
 chrome.storage.local.get('settings').then(data=>{settings=data.settings||{};scan(true);[500,1000,2000,5000,15000].forEach(delay=>retries.push(setTimeout(()=>scan(true),delay)));});
 globalThis.__avalaMonitor=()=>{stopped=true;observer?.disconnect();discovery.disconnect();clearTimeout(timer);clearTimeout(toastTimer);retries.forEach(clearTimeout);chrome.runtime.onMessage.removeListener(onMessage);chrome.storage.onChanged.removeListener(onStorage);removeEventListener('popstate',onNavigate);removeEventListener('hashchange',onNavigate);removeEventListener('load',onNavigate);};
})();
