import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
test('alarm repeats, replacement does not stack timers, and stop closes audio',async()=>{
 let listener,tones=0,closed=0;const intervals=new Map(),timeouts=new Map(),messages=[];let next=0;
 class Context {
  currentTime=0;state='running';destination={};
  async resume(){} async close(){this.state='closed';closed++;}
  createOscillator(){return {frequency:{},connect(){return {connect(){}};},start(){tones++;},stop(){}};}
  createGain(){return {gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}}};}
 }
 const sandbox={AudioContext:Context,setInterval:fn=>{intervals.set(++next,fn);return next;},clearInterval:id=>intervals.delete(id),setTimeout:fn=>{timeouts.set(++next,fn);return next;},clearTimeout:id=>timeouts.delete(id),chrome:{runtime:{onMessage:{addListener:fn=>listener=fn},sendMessage:async message=>{messages.push(message);}}}};
 vm.runInNewContext(readFileSync(new URL('../offscreen.js',import.meta.url),'utf8'),sandbox);
 const send=message=>new Promise(resolve=>listener({target:'audio',...message},{},resolve));
 assert.equal((await send({mode:'alarm',volume:100,repeat:true})).ok,true);assert.equal(tones,4);assert.equal(intervals.size,1);
 [...intervals.values()][0]();assert.equal(tones,8);
 await send({mode:'voice',volume:80,repeat:true,phrase:'Work has just arrived.'});assert.equal(intervals.size,1);assert.equal(messages[0].type,'SPEAK_ALERT');
 await send({action:'stop'});assert.equal(intervals.size,0);assert.equal(timeouts.size,0);assert.equal(closed,2);
 await send({mode:'chime',volume:40,repeat:false});assert.equal(intervals.size,0);assert.equal(timeouts.size,1);
 await send({action:'stop'});
});
