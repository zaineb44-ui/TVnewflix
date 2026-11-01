/* NewFlix TV navigation: D-pad focus, predictable page scrolling and lightweight rendering. */
(()=>{'use strict';
 const KEY='newflix_tv_mode',ua=navigator.userAgent||'';
 const detected=/smart-tv|smarttv|hbbtv|tizen|web0s|webos|netcast|googletv|android tv|aftb|aftt|bravia|viera|roku|fire tv/i.test(ua);
 let tvMode=localStorage.getItem(KEY)==='true'||(localStorage.getItem(KEY)!=='false'&&detected);
 const selector='a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
 const visible=el=>!!(el&&el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden'&&getComputedStyle(el).display!=='none'&&!el.closest('[hidden],[inert]'));
 const list=()=>[...document.querySelectorAll(selector)].filter(visible);
 function setMode(on){tvMode=!!on;document.documentElement.classList.toggle('tv-mode',tvMode);document.body?.classList.toggle('tv-mode',tvMode);localStorage.setItem(KEY,String(tvMode));const b=document.getElementById('tvModeToggle');if(b){b.setAttribute('aria-pressed',String(tvMode));b.textContent=tvMode?'TV MODE ON':'TV MODE';}}
 function addToggle(){if(document.getElementById('tvModeToggle'))return;const b=document.createElement('button');b.id='tvModeToggle';b.type='button';b.className='tv-mode-toggle';b.setAttribute('aria-label','Toggle Smart TV mode');b.onclick=()=>setMode(!tvMode);document.body.appendChild(b);setMode(tvMode)}
 function center(el){try{el.scrollIntoView({behavior:'auto',block:'nearest',inline:'nearest'})}catch(_){el.scrollIntoView(false)}}
 function geometricMove(dir){const all=list(),from=document.activeElement;if(!all.length)return null;if(!all.includes(from))return all.find(x=>x.matches('.main-nav a.active'))||all[0];const a=from.getBoundingClientRect(),cx=a.left+a.width/2,cy=a.top+a.height/2;let best=null,scoreBest=Infinity;for(const el of all){if(el===from)continue;const r=el.getBoundingClientRect(),dx=r.left+r.width/2-cx,dy=r.top+r.height/2-cy;let primary,secondary;if(dir==='left'){if(dx>=-3)continue;primary=-dx;secondary=Math.abs(dy)}else if(dir==='right'){if(dx<=3)continue;primary=dx;secondary=Math.abs(dy)}else if(dir==='up'){if(dy>=-3)continue;primary=-dy;secondary=Math.abs(dx)}else{if(dy<=3)continue;primary=dy;secondary=Math.abs(dx)}const score=primary+secondary*1.25+(secondary>primary?secondary*.4:0);if(score<scoreBest){scoreBest=score;best=el}}return best}
 function scrollPage(dir){const step=Math.max(280,Math.round(innerHeight*.68));const before=scrollY;window.scrollBy({top:dir==='down'?step:-step,left:0,behavior:'auto'});if(scrollY===before){const scrollers=[...document.querySelectorAll('main,.page,.cards,.modal-body')].filter(el=>el.scrollHeight>el.clientHeight+30);const target=scrollers.find(el=>{const r=el.getBoundingClientRect();return dir==='down'?r.bottom>0&&r.top<innerHeight:r.top<innerHeight&&r.bottom>0});if(target)target.scrollTop+=dir==='down'?step:-step;}
 setTimeout(()=>{const candidates=list().filter(el=>{const r=el.getBoundingClientRect();return r.bottom>20&&r.top<innerHeight-20});if(!candidates.length)return;const y=dir==='down'?0:innerHeight;let best=candidates.sort((a,b)=>Math.abs((a.getBoundingClientRect().top+a.getBoundingClientRect().height/2)-y)-Math.abs((b.getBoundingClientRect().top+b.getBoundingClientRect().height/2)-y))[0];if(best){best.focus({preventScroll:true});center(best)}},70)}
 function move(dir){const next=geometricMove(dir);if(next){next.focus({preventScroll:true});center(next)}else if(dir==='up'||dir==='down')scrollPage(dir)}
 document.addEventListener('keydown',e=>{
  const key=e.key,el=document.activeElement,input=/^(INPUT|TEXTAREA|SELECT)$/.test(el?.tagName||'');
  const playbackPrompt=document.getElementById('tvPlaybackCheck');
  const promptIsAvailable=!!playbackPrompt&&playbackPrompt.dataset.awaiting==='true';
  const promptIsVisible=promptIsAvailable&&!playbackPrompt.hidden;
  const backKey=['Escape','Backspace','BrowserBack','GoBack','Back'].includes(key)||e.keyCode===461||e.keyCode===10009;
  // INFO/Menu toggles the playback question; Back also hides/restores it.
  if(promptIsAvailable&&(key==='Info'||key==='i'||key==='Menu'||e.keyCode===457||e.keyCode===457)){
    e.preventDefault();playbackPrompt.hidden=!playbackPrompt.hidden;
    if(!playbackPrompt.hidden)document.getElementById('tvPlaybackYes')?.focus();
    return;
  }
  if(promptIsAvailable&&backKey){
    e.preventDefault();playbackPrompt.hidden=!playbackPrompt.hidden;
    if(!playbackPrompt.hidden)document.getElementById('tvPlaybackYes')?.focus();
    return;
  }
  if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(key)){if(input&&((key==='ArrowLeft'||key==='ArrowRight')||el.tagName==='TEXTAREA'))return;e.preventDefault();move(key.slice(5).toLowerCase());return}if(backKey){if(document.querySelector('#tvServerOverlay:not([hidden])')){e.preventDefault();document.querySelector('#tvServerOverlay').hidden=true;document.body.classList.remove('server-picker-open');return}if(input){el.blur();return}if(history.length>1){e.preventDefault();history.back()}return}if(key==='Enter'&&!el?.matches(selector)){const first=list()[0];if(first)first.focus()}},true);
 document.addEventListener('focusin',e=>{if(tvMode&&e.target.matches(selector))center(e.target)});
 document.addEventListener('DOMContentLoaded',()=>{addToggle();if(tvMode){const first=document.querySelector('.tv-server-option,.main-nav a.active,.hero-actions button,.hero-actions a,main button,main a');if(first)setTimeout(()=>first.focus(),350)}});
 if(document.readyState!=='loading')addToggle();
})();
