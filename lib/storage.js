export const defaults = Object.freeze({desktop:true,sound:true,inPage:true,badge:true,detectNew:true,alertChanges:false,realertHours:0,retentionDays:7,volume:40,soundMode:'alarm',repeatSound:true,duration:5,debug:false,cooldown:0,initialAlert:false,alertOnRefresh:true,sectionSelector:'',cardSelector:''});
export function freshState() { return {baseline:false,knownBatches:{},queue:{},history:[],tabs:{},lastScanTime:0,lastSuccessfulScan:0,lastNotification:0,lastError:null,stats:{day:'',detections:0,notifications:0},unread:[]}; }
export async function readStore() { const data=await chrome.storage.local.get(['state','settings']); return {state:{...freshState(),...data.state},settings:{...defaults,...data.settings}}; }
export async function saveState(state) { await chrome.storage.local.set({state}); }
export function cleanSettings(input) {
 const result={...defaults};
 for(const key of Object.keys(defaults)) {
  const value=input[key];
  if(typeof defaults[key]==='boolean') result[key]=typeof value==='boolean'?value:defaults[key];
 }
 for(const [key,values] of Object.entries({retentionDays:[1,3,7,14,30],realertHours:[0,1,6,12,24,48],duration:[5,10,15,30],cooldown:[0,30,60,300,900]})) result[key]=values.includes(Number(input[key]))?Number(input[key]):defaults[key];
 result.soundMode=['chime','alarm','voice'].includes(input.soundMode)?input.soundMode:defaults.soundMode;
 result.volume=Math.min(100,Math.max(0,Number(input.volume)||0));
 for(const key of ['sectionSelector','cardSelector']) result[key]=String(input[key]||'').trim().slice(0,500);
 return result;
}
export async function saveSettings(input) { const settings=cleanSettings(input); await chrome.storage.local.set({settings}); return settings; }
