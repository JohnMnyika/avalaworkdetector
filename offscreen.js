let context,repeatTimer,closeTimer;
async function stop() {
 clearInterval(repeatTimer);clearTimeout(closeTimer);repeatTimer=null;
 const previous=context;context=null;
 if(previous&&previous.state!=='closed') await previous.close();
}
function chime(volume,loud) {
 const start=context.currentTime;
 for(const [delay,frequency] of (loud?[[0,740],[0.25,990],[0.5,740],[0.75,990]]:[[0,660],[0.16,880]])) {
  const oscillator=context.createOscillator(),gain=context.createGain();
  oscillator.type=loud?'triangle':'sine';oscillator.frequency.value=frequency;
  gain.gain.setValueAtTime(0,start+delay);
  gain.gain.linearRampToValueAtTime(volume*(loud?0.8:0.18),start+delay+0.025);
  gain.gain.exponentialRampToValueAtTime(0.001,start+delay+0.35);
  oscillator.connect(gain).connect(context.destination);oscillator.start(start+delay);oscillator.stop(start+delay+0.4);
 }
}
let chain=Promise.resolve();
chrome.runtime.onMessage.addListener((message,sender,respond)=>{
 if(message.target!=='audio') return;
 const task=async()=>{
  await stop();if(message.action==='stop') return;
  const volume=Math.min(1,Math.max(0,message.volume/100));
  context=new AudioContext();await context.resume();
  const cycle=()=>{
   chime(volume,message.mode!=='chime');
   if(message.mode==='voice') chrome.runtime.sendMessage({type:'SPEAK_ALERT',volume,phrase:message.phrase}).catch(()=>{});
  };
  cycle();
  if(message.repeat) repeatTimer=setInterval(cycle,6000);
  else closeTimer=setTimeout(stop,1500);
 };
 chain=chain.then(task,task);chain.then(()=>respond({ok:true}),error=>respond({error:error.message}));return true;
});
