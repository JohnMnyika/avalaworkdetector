/* Isolated adapter. No Avala class names or private APIs are assumed. */
(() => {
 const text=el=>(el?.textContent||'').replace(/\s+/g,' ').trim();
 const uuid=/\b[0-9a-f]{8}-\s*[0-9a-f]{4}-\s*[0-9a-f]{4}-\s*[0-9a-f]{4}-\s*[0-9a-f]{12}\b/i;
 const batchLabel=/\bWork batch\s+[a-z0-9][a-z0-9_-]*/i;
 const shortId=/^[0-9a-f]{6}$/i;
 const visible=el=>{
  if(el.closest('[hidden],[aria-hidden="true"],#avala-alert-pro')) return false;
  for(let node=el;node;node=node.parentElement) {const style=getComputedStyle(node);if(style.display==='none'||style.visibility==='hidden') return false;}
  return true;
 };
 const leaves=(root,pattern)=>Array.from(root.querySelectorAll('*')).filter(el=>visible(el)&&pattern.test(text(el))&&!Array.from(el.children).some(c=>pattern.test(text(c))));
 function dashboardLabels(root) {
  const ids=leaves(root,shortId);
  return ids.filter(label=>{
   for(let card=label.parentElement;card&&card!==root;card=card.parentElement) {
    if(ids.filter(id=>card.contains(id)).length>1) break;
    const status=leaves(card,/^(Available|In Progress)$/i).length;
    const action=Array.from(card.querySelectorAll('button,a,[role=button]')).some(el=>visible(el)&&/^(Start Working|Resume|Continue)(?:\s*[→➜➔])?$/i.test(text(el)));
    if(status&&action) return !leaves(card,uuid).length&&!leaves(card,batchLabel).length;
   }
   return false;
  });
 }
 function findAvailableWorkSection(config={}) {
  if(config.sectionSelector) {const root=document.querySelector(config.sectionSelector);return root&&visible(root)?{root,heading:root,explicit:true}:null;}
  const headings=leaves(document.body,/^Available Work$/i);
  if(headings.length!==1) return null;
  const heading=headings[0];
  // Climb only until content is found. Never use an ancestor containing history.
  for(let root=heading.parentElement;root&&root!==document.body;root=root.parentElement) {
   if(leaves(root,/^(Task history|Quick Actions)$/i).length) break;
   if(/No available work batches|Work batch\s+[\w-]+/i.test(text(root))||uuid.test(text(root))||dashboardLabels(root).length) return {root,heading,explicit:false};
  }
  return {root:heading.parentElement,heading,explicit:false,unresolved:true};
 }
 function parseCard(card,label) {
  const value=text(card), match=text(label).match(/\bWork batch\s+([a-z0-9][a-z0-9_-]*)/i);
  const anchor=card.matches('a[href]')?card:card.querySelector('a[href]');
  let url;
  if(anchor) {const candidate=new URL(anchor.getAttribute('href'),location.href);if(candidate.origin==='https://avala.ai') {candidate.hash='';url=candidate.href;}}
  const fullId=text(label).match(uuid)?.[0]?.replace(/\s/g,'').toLowerCase();
  const id=card.getAttribute('data-batch-id')||fullId||match?.[1]||url||(shortId.test(text(label))?text(label).toLowerCase():undefined);
  if(!id) return null;
  const countsBeforeLabels=/\d+\s*Claimed/i.test(value);
  const count=label=> {const pattern=countsBeforeLabels?new RegExp('(\\d+)\\s*'+label,'i'):new RegExp(label+'\\s*:?\\s*(\\d+)','i');const match=value.match(pattern);return match?Number(match[1]):undefined;};
  const type=value.match(/([\w -]+\s*\/\s*[\w -]+)/)?.[1]?.trim();
  const title=card.querySelector('h1,h2,h3,h4,h5,h6,[role=heading]');
  return {id,name:match?'Work batch '+match[1]:title?text(title):'Work batch '+id,type,claimed:count('Claimed'),done:count('Done'),url};
 }
 function isPickedCard(card) {
  // Status text must be a separate visible label, not words in a task title.
  if(leaves(card,/^In Progress$/i).length) return true;
  return [card,...card.querySelectorAll('button,a,[role=button]')].some(el=>visible(el)&&/^(Resume|Continue)(?:\s*[→➜➔])?$/i.test(text(el)));
 }
 function scan(config={}) {
  const timestamp=Date.now();
  try {
   const section=findAvailableWorkSection(config);
   if(!section) return {status:'LOADING',batches:[],timestamp,error:'Available Work heading not found. Open the worker dashboard or configure its section selector.',found:false};
   if(leaves(section.root,/^Task history$/i).length) throw Error('Section includes Task history. Choose a narrower Available Work container.');
   const empty=leaves(section.root,/^No available work batches[.!]?$/i).length>0;
   let labels=config.cardSelector?Array.from(section.root.querySelectorAll(config.cardSelector)).filter(visible):leaves(section.root,uuid);
   if(!config.cardSelector) {
    const legacy=leaves(section.root,batchLabel);
    labels.push(...legacy.filter(el=>!labels.some(other=>el.contains(other)||other.contains(el))));
    labels.push(...dashboardLabels(section.root).filter(el=>!labels.some(other=>el.contains(other)||other.contains(el))));
   }
   const batches=new Map(),inProgressIds=new Set();
   for(const label of labels) {
    let card=label;
    if(!config.cardSelector) {
     while(card.parentElement&&card.parentElement!==section.root) {
      if(labels.filter(l=>card.parentElement.contains(l)).length>1) break;
      card=card.parentElement;
     }
    }
    const batch=parseCard(card,label);
    if(batch) {if(isPickedCard(card)) inProgressIds.add(batch.id);else batches.set(batch.id,batch);}
   }
   for(const id of inProgressIds) batches.delete(id);
   if(empty&&batches.size) throw Error('Conflicting empty and work states; waiting for a consistent dashboard.');
   if(!batches.size&&(empty||inProgressIds.size)) return {status:'NO_WORK',batches:[],inProgressIds:[...inProgressIds],timestamp,found:true};
   if(!batches.size) return {status:'LOADING',batches:[],timestamp,found:true,error:'Available Work found, but no confirmed empty state or identifiable batches. Configure the detector if this persists.'};
   return {status:'WORK_AVAILABLE',batches:[...batches.values()],inProgressIds:[...inProgressIds],timestamp,found:true};
  } catch(error) {return {status:'ERROR',batches:[],timestamp,error:error.message,found:false};}
 }
 globalThis.AvalaDetector={scan,findAvailableWorkSection};
})();
