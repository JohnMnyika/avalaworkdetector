import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const script=readFileSync(new URL('../detector.js',import.meta.url),'utf8');
function detect(html,config={}) {const dom=new JSDOM(html,{url:'https://avala.ai/',runScripts:'outside-only'});dom.window.eval(script);const result=dom.window.AvalaDetector.scan(config);dom.window.close();return result;}
test('current dashboard cards detect short badges and Start Working without history',()=>{
 const card=(id,name)=>`<article><div><span>Available</span><span>${id}</span></div><div><h3>${name}</h3><p>Click to start working on this batch</p><span>2 tasks</span><button>Start Working <svg></svg></button></div></article>`;
 const r=detect(`<main><section><div><h2>Available Work</h2></div><div>${card('da925d','v1-batch-000a1-sf-bev - (Camera) Edit boxes')}${card('f6c2f3','v1-batch-001e9-sf-bev')}${card('a451dc','batch-2324-sf-bev')}${card('b41dde','v1-batch-001ck-sf-bev')}</div></section><aside><h2>Quick Actions</h2></aside><section><h2>Task history</h2>${card('abcdef','Old task')}</section></main>`);
 assert.equal(r.status,'WORK_AVAILABLE');assert.deepEqual(Array.from(r.batches,b=>b.id),['da925d','f6c2f3','a451dc','b41dde']);
 assert.equal(r.batches[0].name,'v1-batch-000a1-sf-bev - (Camera) Edit boxes');
});
test('short badges need a status and action, and picked short cards are excluded',()=>{
 const r=detect('<section><h2>Available Work</h2><article><span>In Progress</span><span>abc123</span><button>Continue →</button></article><article><span>Available</span><span>def456</span><button>Start Working →</button></article><p>fedcba</p></section>');
 assert.deepEqual(Array.from(r.batches,b=>b.id),['def456']);assert.deepEqual(Array.from(r.inProgressIds),['abc123']);
 assert.equal(detect('<section><h2>Available Work</h2><p>abcdef</p><button>Start Working</button></section>').status,'LOADING');
});
test('short badge and full UUID in one card retain the full identity',()=>{
 const r=detect('<section><h2>Available Work</h2><article><span>Available</span><span>11d908</span><h3>Camera task</h3><p>11d9085f-cb11-4166-94e9-85297786648b</p><button>Start Working</button></article></section>');
 assert.deepEqual(Array.from(r.batches,b=>b.id),['11d9085f-cb11-4166-94e9-85297786648b']);
});
test('screenshot-style empty work never reports task history',()=>{const r=detect('<main><section><h2>Available Work</h2><p>No available work batches</p></section><section><h2>Task history</h2><div>Work batch 085e2c</div></section></main>');assert.equal(r.status,'NO_WORK');assert.equal(r.batches.length,0);});
test('separate cards extract stable IDs and metadata, not history',()=>{const r=detect('<main><section><h2>Available Work</h2><article><h3>Work batch abc123</h3><p>unspecified / box</p><span>2 Claimed 1 Done</span></article><article><h3>Work batch def456</h3></article></section><section><h2>Task history</h2><p>Work batch old123</p></section></main>');assert.equal(r.status,'WORK_AVAILABLE');assert.equal(r.batches.length,2);assert.equal(r.batches[0].claimed,2);assert.equal(r.batches[0].done,1);});
test('ambiguous shared history ancestor fails closed',()=>{const r=detect('<main><h2>Available Work</h2><p>Work batch abc123</p><h2>Task history</h2><p>Work batch old123</p></main>');assert.equal(r.status,'ERROR');});
test('loading, missing heading, contradictory DOM and invalid configuration are diagnostic',()=>{assert.equal(detect('<h2>Available Work</h2>').status,'LOADING');assert.equal(detect('<p>Login</p>').status,'LOADING');assert.equal(detect('<section><h2>Available Work</h2><p>No available work batches</p><p>Work batch abc123</p></section>').status,'ERROR');assert.equal(detect('<div></div>',{sectionSelector:'['}).status,'ERROR');});
test('explicit inspected selectors support stable data attributes and links',()=>{const r=detect('<section id="available"><article data-batch-id="actual-id">Task</article><article><a href="/batch/xyz">Another task</a></article></section>',{sectionSelector:'#available',cardSelector:'article'});assert.equal(r.batches[0].id,'actual-id');assert.equal(r.batches[1].id,'https://avala.ai/batch/xyz');});
test('hidden batches are ignored and ordering does not affect identity',()=>{const r=detect('<section><h2>Available Work</h2><article hidden>Work batch hidden123</article><article>Work batch def456</article><article>Work batch abc123</article></section>');assert.deepEqual(Array.from(r.batches,b=>b.id),['def456','abc123']);});
test('real screenshot card text uses full UUID without Work batch label',()=>{
 const r=detect('<main><section><h2>Available Work</h2><article><span>In Progress</span><span>11d908</span><h3>FNC (cam-03) B [33-65]</h3><p>11d9085f-<br>cb11-4166-94e9-85297786648b</p><button>Continue</button></article></section><section><h2>Task history</h2><p>Work batch old123</p></section></main>');
 assert.equal(r.status,'NO_WORK');assert.equal(r.batches.length,0);assert.equal(r.inProgressIds[0],'11d9085f-cb11-4166-94e9-85297786648b');
});
test('multiple UUID cards ignore history UUIDs and preserve identity on reorder',()=>{
 const a='11d9085f-cb11-4166-94e9-85297786648b',b='22d9085f-cb11-4166-94e9-85297786648b';
 const card=id=>`<article><h3>Camera task</h3><p>${id}</p><button>Start</button></article>`;
 const r=detect(`<main><section><h2>Available Work</h2>${card(b)}${card(a)}</section><section><h2>Task history</h2>${card('33d9085f-cb11-4166-94e9-85297786648b')}</section></main>`);
 assert.deepEqual(Array.from(r.batches,b=>b.id),[b,a]);
});
test('mixed picked and new cards only report unclaimed work',()=>{
 const r=detect('<section><h2>Available Work</h2><article><h3>Work batch picked123</h3><span>In Progress</span><button>Continue →</button></article><article><h3>Work batch new123</h3><button>Start</button></article></section>');
 assert.equal(r.status,'WORK_AVAILABLE');assert.deepEqual(Array.from(r.batches,b=>b.id),['new123']);assert.deepEqual(Array.from(r.inProgressIds),['picked123']);
});
test('resume-only card is picked; task title containing Continue is not a status',()=>{
 const r=detect('<section><h2>Available Work</h2><article><h3>Work batch picked123</h3><a href="/task/1">Resume</a></article><article><h3>Work batch new123</h3><p>Continue reviewing images</p><button>Start</button></article></section>');
 assert.deepEqual(Array.from(r.batches,b=>b.id),['new123']);
});
