import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const detector=readFileSync(new URL('../detector.js',import.meta.url),'utf8');
const content=readFileSync(new URL('../contentScript.js',import.meta.url),'utf8');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
test('late dashboard cards beside a provisional heading container trigger a scan',async()=>{
 const dom=new JSDOM('<main><section><div><h2>Available Work</h2></div><div id="cards"></div></section><section><h2>Task history</h2></section></main>',{url:'https://avala.ai/',runScripts:'outside-only'});
 const messages=[];
 dom.window.chrome={runtime:{sendMessage:async m=>{messages.push(m);return {ok:true};},onMessage:{addListener:()=>{},removeListener:()=>{}}},storage:{local:{get:async()=>({settings:{}})},onChanged:{addListener:()=>{},removeListener:()=>{}}}};
 try {
  dom.window.eval(detector);dom.window.eval(content);await delay(30);
  assert.equal(messages.at(-1).result.status,'LOADING');
  // Remove startup retry timers so only mutation discovery can detect hydration.
  for(let id=1;id<100;id++) dom.window.clearTimeout(id);
  dom.window.document.getElementById('cards').innerHTML='<article><span>Available</span><span>da925d</span><h3>v1-batch-000a1-sf-bev</h3><button>Start Working</button></article>';
  await delay(650);
  assert.equal(messages.at(-1).result.status,'WORK_AVAILABLE');
  assert.equal(messages.at(-1).result.batches[0].id,'da925d');
 } finally {dom.window.__avalaMonitor();dom.window.close();}
});
test('observer detects asynchronous work, container replacement and manual scans',async()=>{
 const dom=new JSDOM('<main><section><h2>Available Work</h2><p>No available work batches</p></section></main>',{url:'https://avala.ai/',runScripts:'outside-only'});
 const messages=[];let receive;
 dom.window.chrome={runtime:{sendMessage:async m=>{messages.push(m);return {ok:true};},onMessage:{addListener:fn=>receive=fn,removeListener:()=>{}}},storage:{local:{get:async()=>({settings:{}})},onChanged:{addListener:()=>{},removeListener:()=>{}}}};
 try {
  dom.window.eval(detector);dom.window.eval(content);await delay(30);
  assert.equal(messages.at(-1).result.status,'NO_WORK');
  dom.window.document.querySelector('section').innerHTML='<h2>Available Work</h2><article>Work batch abc123</article>';
  await delay(650);assert.equal(messages.at(-1).result.batches[0].id,'abc123');
  dom.window.document.querySelector('main').innerHTML='<section><h2>Available Work</h2><p>No available work batches</p></section>';
  await delay(650);assert.equal(messages.at(-1).result.status,'NO_WORK');
  const result=await new Promise(resolve=>receive({type:'SCAN_NOW'},{},resolve));assert.equal(result.status,'NO_WORK');
  dom.window.__avalaMonitor();const count=messages.length;
  dom.window.document.querySelector('section').innerHTML='<h2>Available Work</h2><article>Work batch stopped123</article>';
  await delay(450);assert.equal(messages.length,count);
 } finally {dom.window.__avalaMonitor();dom.window.close();}
});
