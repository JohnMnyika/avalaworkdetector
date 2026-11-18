import {defaults} from './lib/storage.js';
const groups=[['Notifications',[['desktop','Desktop notifications'],['sound','Sound notifications'],['inPage','In-page notifications'],['badge','Badge notifications'],['soundMode','Alert sound',{chime:'Gentle chime',alarm:'Loud alarm',voice:'Alarm + spoken announcement'}],['repeatSound','Repeat every 6 seconds until stopped'],['volume','Sound volume (%)','range'],['duration','In-page alert duration',{5:'5 seconds',10:'10 seconds',15:'15 seconds',30:'30 seconds'}],['cooldown','Alert cooldown',{0:'Off — alert immediately',30:'30 seconds',60:'1 minute',300:'5 minutes',900:'15 minutes'}]]],['Work detection',[['alertOnRefresh','Alert whenever available work is found after a page refresh'],['detectNew','Detect new batches'],['alertChanges','Alert when existing batches change'],['initialAlert','Alert for existing batches on the first scan'],['realertHours','Treat disappeared batches as new after',{0:'Disabled',1:'1 hour',6:'6 hours',12:'12 hours',24:'24 hours',48:'48 hours'}],['retentionDays','Known batch retention',{1:'1 day',3:'3 days',7:'7 days',14:'14 days',30:'30 days'}]]],['Detector & diagnostics',[['debug','Debug mode'],['sectionSelector','Available Work container selector','text'],['cardSelector','Batch card selector (inside container)','text']]]];
const fields=document.getElementById('fields'),feedback=document.getElementById('feedback');
for(const [title,items] of groups) {const section=document.createElement('section'),heading=document.createElement('h2');heading.textContent=title;section.append(heading);for(const [id,text,kind] of items){const label=document.createElement('label');label.textContent=text;const input=document.createElement(typeof kind==='object'?'select':'input');input.id=id;input.name=id;if(typeof kind==='object'){for(const [value,name] of Object.entries(kind)){const option=document.createElement('option');option.value=value;option.textContent=name;input.append(option);}}else input.type=kind||'checkbox';if(kind==='range'){input.min=0;input.max=100;}label.append(input);section.append(label);}fields.append(section);}
const help=document.createElement('p');help.className='help';help.textContent='Blank selectors use conservative heading-based detection. Inspect the live dashboard before adding selectors; exclude Task history. Cooldown alerts remain queued across restarts. Clearing remembered batches starts a fresh baseline. Notification duration controls the in-page alert; desktop timing is managed by your operating system.';fields.append(help);
const controls=()=>document.querySelectorAll('#settings input,#settings select,#settings button');
function busy(value) {for(const control of controls()) control.disabled=value;}
async function request(type,extra={}) {
 const result=await chrome.runtime.sendMessage({type,...extra});
 if(!result) throw Error('Extension did not respond. Reload the extension and reopen Settings.');
 if(result.error) throw Error(result.error);
 return result;
}
busy(true);
request('GET_STATE').then(({settings})=>{
 if(!settings) throw Error('Settings could not be loaded. Reload the extension and reopen Settings.');
 for(const key of Object.keys(defaults)) {const input=document.getElementById(key);if(input.type==='checkbox') input.checked=settings[key];else input.value=settings[key];}
 feedback.textContent='Settings loaded.';busy(false);
}).catch(e=>{feedback.textContent=e.message;});
document.getElementById('settings').onsubmit=async event=>{
 event.preventDefault();busy(true);feedback.textContent='Saving settings…';
 try {
  const settings={};
  for(const key of Object.keys(defaults)) {
   const input=document.getElementById(key);
   settings[key]=input.type==='checkbox'?input.checked:input.value;
  }
  for(const key of ['sectionSelector','cardSelector']) {
   const selector=settings[key].trim();
   if(selector) {
    try {document.querySelector(selector);} catch {throw Error(`Invalid CSS selector for ${key==='sectionSelector'?'Available Work container':'Batch card'}: ${selector}`);}
   }
  }
  await request('SAVE_SETTINGS',{settings});feedback.textContent='Settings saved. Your selections will remain after refreshing.';
 } catch(e) {feedback.textContent=e.message;} finally {busy(false);}
};
document.getElementById('test').onclick=async()=>{
 busy(true);feedback.textContent='Sending test alert…';
 try {await request('TEST_ALERT');feedback.textContent='Test sent using saved channel settings. Open Avala to see the in-page alert.';}
 catch(e) {feedback.textContent=e.message;} finally {busy(false);}
};
document.getElementById('clear').onclick=async()=>{
 if(!confirm('Clear all remembered batches? The next valid scan will follow your initial scan setting.')) return;
 busy(true);
 try {await request('CLEAR_KNOWN');feedback.textContent='Remembered batches cleared.';}
 catch(e) {feedback.textContent=e.message;} finally {busy(false);}
};

document.getElementById('stop').onclick=async()=>{try{await request('STOP_ALERT');feedback.textContent='Alert stopped. Monitoring continues.';}catch(e){feedback.textContent=e.message;}};
