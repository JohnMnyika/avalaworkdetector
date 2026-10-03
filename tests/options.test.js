import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {defaults,cleanSettings} from '../lib/storage.js';
const html=readFileSync(new URL('../options.html',import.meta.url),'utf8');
const script=readFileSync(new URL('../options.js',import.meta.url),'utf8').replace("import {defaults} from './lib/storage.js';",'const defaults=globalThis.testDefaults;');
const settle=()=>new Promise(resolve=>setTimeout(resolve,0));
test('options form saves checked values and restores them on a fresh page',async()=>{
 let saved={...defaults},tests=0;
 function open() {
  const dom=new JSDOM(html,{url:'chrome-extension://test/options.html',runScripts:'outside-only'});
  dom.window.testDefaults=defaults;
  dom.window.chrome={runtime:{sendMessage:async message=>{
   if(message.type==='GET_STATE')return {settings:{...saved}};
   if(message.type==='SAVE_SETTINGS'){saved=cleanSettings(message.settings);return {ok:true};}
   if(message.type==='TEST_ALERT'){tests++;return {ok:true};}
  }}};
  dom.window.eval(script);return dom;
 }
 let dom=open();await settle();
 try {
  const doc=dom.window.document;
  assert.equal(doc.getElementById('desktop').checked,true);
  doc.getElementById('alertChanges').checked=true;doc.getElementById('volume').value='85';
  doc.getElementById('settings').dispatchEvent(new dom.window.Event('submit',{cancelable:true}));await settle();
  assert.match(doc.getElementById('feedback').textContent,/Settings saved/);
  doc.getElementById('test').click();await settle();assert.equal(tests,1);
 }finally{dom.window.close();}
 dom=open();await settle();
 try {assert.equal(dom.window.document.getElementById('alertChanges').checked,true);assert.equal(dom.window.document.getElementById('volume').value,'85');}
 finally{dom.window.close();}
});
test('failed loading shows visible error and prevents overwriting settings with unchecked defaults',async()=>{
 const dom=new JSDOM(html,{url:'chrome-extension://test/options.html',runScripts:'outside-only'});
 dom.window.testDefaults=defaults;dom.window.chrome={runtime:{sendMessage:async()=>({error:'Extension page required'})}};
 try {dom.window.eval(script);await settle();assert.match(dom.window.document.querySelector('.actions #feedback').textContent,/Extension page required/);assert.equal(dom.window.document.getElementById('desktop').disabled,true);assert.equal(dom.window.document.getElementById('test').disabled,true);}
 finally{dom.window.close();}
});
