/* NewFlix Smart TV / remote-control support */
(()=>{
 'use strict';
 const KEY='newflix_tv_mode';
 const ua=navigator.userAgent||'';
 const detected=/smart-tv|smarttv|hbbtv|tizen|web0s|webos|netcast|googletv|android tv|aftb|aftt|bravia|viera|roku|fire tv/i.test(ua);
 let tvMode=localStorage.getItem(KEY)==='true'||(localStorage.getItem(KEY)!=='false'&&detected);
 const focusable='a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
 const visible=el=>!!(el&&el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden'&&getComputedStyle(el).display!=='none');
 const list=()=>[...document.querySelectorAll(focusable)].filter(el=>visible(el)&&!el.closest('[inert]'));
 function setMode(on){tvMode=!!on;document.body.classList.toggle('tv-mode',tvMode);localStorage.setItem(KEY,String(tvMode));const b=document.getElementById('tvModeToggle');if(b){b.setAttribute('aria-pressed',String(tvMode));b.innerHTML=tvMode?'⌗ TV Mode: ON':'⌗ TV Mode';}}
 function addToggle(){if(document.getElementById('tvModeToggle'))return;const b=document.createElement('button');b.id='tvModeToggle';b.type='button';b.className='tv-mode-toggle';b.setAttribute('aria-label','Toggle Smart TV mode');b.onclick=()=>setMode(!tvMode);document.body.appendChild(b);setMode(tvMode);}
 function center(el){try{el.scrollIntoView({behavior:'smooth',block:'nearest',inline:'nearest'})}catch(_){el.scrollIntoView(false)}}
 function move(dir){const all=list();if(!all.length)return;const cur=document.activeElement;let from=cur&&all.includes(cur)?cur:null;if(!from){(all.find(x=>x.matches('.main-nav a.active'))||all[0]).focus();return}const a=from.getBoundingClientRect(),cx=a.left+a.width/2,cy=a.top+a.height/2;let best=null,bestScore=Infinity;for(const el of all){if(el===from)continue;const r=el.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2,dx=x-cx,dy=y-cy;let primary,secondary;if(dir==='left'){if(dx>=-2)continue;primary=-dx;secondary=Math.abs(dy)}else if(dir==='right'){if(dx<=2)continue;primary=dx;secondary=Math.abs(dy)}else if(dir==='up'){if(dy>=-2)continue;primary=-dy;secondary=Math.abs(dx)}else{if(dy<=2)continue;primary=dy;secondary=Math.abs(dx)}const score=primary+secondary*1.65+(secondary>primary?secondary*.5:0);if(score<bestScore){bestScore=score;best=el}}if(best){best.focus({preventScroll:true});center(best)} }
 document.addEventListener('keydown',e=>{const key=e.key;const input=/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName||'');if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(key)){if(input&&((key==='ArrowLeft'||key==='ArrowRight')||document.activeElement.tagName==='TEXTAREA'))return;e.preventDefault();move(key.replace('Arrow','').toLowerCase());return}if(key==='Escape'||key==='Backspace'||key==='BrowserBack'||key==='GoBack'||e.keyCode===461||e.keyCode===10009){if(input){document.activeElement.blur();return}if(document.querySelector('.search-suggest.show')){document.querySelector('.search-suggest.show').classList.remove('show');return}if(history.length>1){e.preventDefault();history.back()}return}if(key==='Enter'&&!document.activeElement?.matches(focusable)){const first=list()[0];if(first)first.focus()}
 },true);
 document.addEventListener('focusin',e=>{if(tvMode&&e.target.matches(focusable))center(e.target)});
 document.addEventListener('DOMContentLoaded',()=>{addToggle();if(tvMode){const first=document.querySelector('.main-nav a.active')||document.querySelector('.hero-actions button, .hero-actions a, .card, main button, main a');if(first)setTimeout(()=>first.focus(),250)}});
 if(document.readyState!=='loading')addToggle();
})();
