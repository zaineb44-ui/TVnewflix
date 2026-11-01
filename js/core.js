const C=window.NEWFLIX_CONFIG;
const sb=window.supabase.createClient(C.SUPABASE_URL,C.SUPABASE_KEY);
window.sb=sb;
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
function esc(s=''){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function toast(msg){let el=$('#toast');if(!el){el=document.createElement('div');el.id='toast';el.className='toast';document.body.append(el)}el.textContent=msg;el.classList.add('show');clearTimeout(window.__toastTimer);window.__toastTimer=setTimeout(()=>el.classList.remove('show'),2800)}
async function currentUser(){const {data}=await sb.auth.getUser();return data.user||null}
async function requireUser(){const u=await currentUser();if(!u){location.href='signin.html?next='+encodeURIComponent(location.pathname+location.search);throw new Error('auth required')}return u}
async function getProfile(id){const {data}=await sb.from('profiles').select('*').eq('id',id).maybeSingle();return data}
async function tmdb(path,params={}){const u=new URL(C.TMDB_API+path);u.searchParams.set('api_key',C.TMDB_API_KEY);u.searchParams.set('language','en-US');Object.entries(params).forEach(([k,v])=>v!==''&&v!=null&&u.searchParams.set(k,v));const r=await fetch(u);if(!r.ok)throw new Error('TMDB request failed');return r.json()}
function mediaFromParams(){const p=new URLSearchParams(location.search);return{id:Number(p.get('id')),type:p.get('type')==='tv'?'tv':'movie',season:Number(p.get('season')||1),episode:Number(p.get('episode')||1),room:p.get('room')||''}}
function applyTheme(){const accent=localStorage.getItem('newflix_accent')||'rose';document.documentElement.dataset.accent=accent;document.documentElement.dataset.compact=localStorage.getItem('newflix_compact')==='true'?'true':'false';const manual=localStorage.getItem('newflix_performance_mode')||'auto';const cached=localStorage.getItem('newflix_network_profile');let perf='balanced';try{const p=JSON.parse(cached||'null');if(p?.mode)perf=p.mode}catch{}document.documentElement.dataset.performance=manual==='auto'?perf:manual;}
applyTheme();
function mediaTypeOf(m,fallback='movie'){return m.media_type==='tv'||m.first_air_date?'tv':m.media_type==='movie'||m.release_date?'movie':fallback}
function card(m,type=mediaTypeOf(m)){
  const title=m.title||m.name||'Untitled';const date=m.release_date||m.first_air_date||'';const poster=m.poster_path?C.TMDB_IMAGE+m.poster_path:'';const rating=Number(m.vote_average||0);const badge=type==='tv'?'SERIES':'MOVIE';
  return `<article class="card" data-id="${m.id}" data-type="${type}" tabindex="0"><div class="card-media">${poster?`<img src="${poster}" alt="${esc(title)}" loading="lazy">`:`<div class="poster-fallback"><i class="fa-solid fa-film"></i></div>`}<span class="type-badge">${badge}</span><button class="quick-list" type="button" aria-label="Add ${esc(title)} to watchlist" title="Add to My List"><i class="fa-solid fa-plus"></i></button></div><div class="card-body"><div class="card-title">${esc(title)}</div><div class="card-meta">${date?date.slice(0,4):'—'}${rating?` · ⭐ ${rating.toFixed(1)}`:''}</div></div></article>`
}
function historyCard(x){const poster=x.poster_path?C.TMDB_IMAGE+x.poster_path:'';const pct=Math.max(0,Math.min(100,Number(x.progress_percent||0)));const type=x.media_type==='tv'?'tv':'movie';return `<article class="card progress-card" data-id="${x.tmdb_id}" data-type="${type}" tabindex="0"><div class="card-media">${poster?`<img src="${poster}" alt="${esc(x.title||'Continue watching')}" loading="lazy">`:`<div class="poster-fallback"><i class="fa-solid fa-film"></i></div>`}<span class="type-badge">${type==='tv'?'SERIES':'MOVIE'}</span><div class="progress-track"><span style="width:${pct}%"></span></div></div><div class="card-body"><div class="card-title">${esc(x.title||'Untitled')}</div><div class="card-meta">${type==='tv'&&x.season_number?`S${x.season_number} · E${x.episode_number||1} · `:''}${Math.round(pct)}% watched</div></div></article>`}
async function toggleWatchlist(id,type,title='',poster_path=null,btn=null){const u=await currentUser();if(!u){location.href='signin.html?next='+encodeURIComponent(location.href);return}const {data:existing}=await sb.from('watchlist').select('id').eq('user_id',u.id).eq('tmdb_id',id).eq('media_type',type).maybeSingle();if(existing){await sb.from('watchlist').delete().eq('id',existing.id);toast('Removed from My List');if(btn)btn.innerHTML='<i class="fa-solid fa-plus"></i>'}else{await sb.from('watchlist').insert({user_id:u.id,tmdb_id:id,media_type:type,title,poster_path});toast('Added to My List');if(btn)btn.innerHTML='<i class="fa-solid fa-check"></i>'}}
function bindCards(root=document){$$('.card[data-id]',root).forEach(el=>{const open=()=>location.href=`details.html?id=${el.dataset.id}&type=${el.dataset.type}`;el.addEventListener('click',e=>{if(!e.target.closest('.quick-list'))open()});el.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&!e.target.closest('.quick-list')){e.preventDefault();open()}});const q=el.querySelector('.quick-list');if(q)q.onclick=e=>{e.stopPropagation();const title=el.querySelector('.card-title')?.textContent||'';const src=el.querySelector('img')?.src||'';const poster=src.includes('/t/p/w500')?src.split('/t/p/w500')[1]:null;toggleWatchlist(Number(el.dataset.id),el.dataset.type,title,poster,q)}})}
function navbar(active='') {return `<header class="header"><div class="header-shell"><a class="logo" href="index.html" aria-label="NewFlix home"><span class="logo-mark"><i class="fa-solid fa-play"></i></span><span class="logo-word">NEW<span>FLIX</span></span></a><nav class="main-nav"><a ${active==='home'?'class="active"':''} href="index.html"><i class="fa-solid fa-house"></i><span>Home</span></a><a ${active==='movies'?'class="active"':''} href="movies.html"><i class="fa-solid fa-clapperboard"></i><span>Movies</span></a><a ${active==='series'?'class="active"':''} href="series.html"><i class="fa-solid fa-tv"></i><span>Series</span></a><a ${active==='docs'?'class="active"':''} href="documentaries.html"><i class="fa-solid fa-earth-americas"></i><span>Docs</span></a><a ${active==='watchlist'?'class="active"':''} href="watchlist.html"><i class="fa-solid fa-bookmark"></i><span>My List</span></a><a ${active==='history'?'class="active"':''} href="history.html"><i class="fa-solid fa-clock-rotate-left"></i><span>Continue</span></a><a ${active==='friends'?'class="active"':''} href="friends.html"><i class="fa-solid fa-user-group"></i><span>Friends</span></a><a ${active==='rooms'?'class="active"':''} href="rooms.html"><i class="fa-solid fa-people-group"></i><span>Together</span></a><a ${active==='settings'?'class="active"':''} href="settings.html"><i class="fa-solid fa-sliders"></i><span>Settings</span></a></nav><div class="header-tools"><div class="search-shell"><div class="search-box"><i class="fa-solid fa-magnifying-glass"></i><input id="searchInput" placeholder="Search movies & series" autocomplete="off"></div><div id="searchSuggest" class="search-suggest"></div></div><button class="network-badge" id="networkBadge" type="button" title="Connection optimizer"><span class="network-bars"><i></i><i></i><i></i></span><span class="network-badge-copy"><b id="networkBadgeLabel">Auto</b><small id="networkBadgeSpeed">Checking…</small></span></button><button class="pill icon-only surprise-btn" id="surpriseBtn" title="Surprise me"><i class="fa-solid fa-shuffle"></i></button><div class="auth-slot"><a class="pill auth-btn" href="signin.html"><i class="fa-solid fa-right-to-bracket"></i><span>Login</span></a></div></div></div></header>`}
function footer(){return `<footer class="footer"><b>NEWFLIX</b> · Discover. Watch. Share. <span class="muted">Playback is provided by third-party embeds.</span> © ${new Date().getFullYear()}</footer>`}
async function renderAuth(){const slot=$('.auth-slot');if(!slot)return;const u=await currentUser();if(!u){slot.innerHTML='<a class="pill auth-btn" href="signin.html"><i class="fa-solid fa-right-to-bracket"></i><span>Login</span></a><a class="btn primary auth-btn signup-compact" href="signup.html"><i class="fa-solid fa-user-plus"></i><span>Sign Up</span></a>';return}const p=await getProfile(u.id);const name=p?.display_name||p?.username||u.email||'Account';const initial=esc(name.trim().charAt(0).toUpperCase()||'U');const avatar=p?.avatar_url?`<img src="${esc(p.avatar_url)}" alt="" referrerpolicy="no-referrer">`:`<span>${initial}</span>`;slot.innerHTML=`<a class="account-pill" href="settings.html"><span class="nav-avatar">${avatar}</span><span class="account-copy"><b>${esc(name)}</b><small>Profile & settings</small></span><i class="fa-solid fa-chevron-down account-chevron"></i></a><button class="pill icon-only auth-btn" id="logoutBtn" type="button" title="Log out"><i class="fa-solid fa-right-from-bracket"></i></button>`;$('#logoutBtn').onclick=async()=>{await sb.auth.signOut();location.href='index.html'}}
let suggestTimer;
function setupSearch(){const i=$('#searchInput'),box=$('#searchSuggest');if(!i||i.dataset.bound)return;i.dataset.bound='1';const hide=()=>box&&box.classList.remove('show');i.addEventListener('keydown',e=>{if(e.key==='Enter'&&i.value.trim())location.href='search.html?q='+encodeURIComponent(i.value.trim());if(e.key==='Escape')hide()});i.addEventListener('input',()=>{clearTimeout(suggestTimer);const q=i.value.trim();if(q.length<2){hide();return}suggestTimer=setTimeout(async()=>{try{const d=await tmdb('/search/multi',{query:q,page:1,include_adult:false});const items=(d.results||[]).filter(x=>x.media_type==='movie'||x.media_type==='tv').slice(0,6);if(!items.length){box.innerHTML='<div class="suggest-empty">No results</div>'}else box.innerHTML=items.map(x=>{const t=x.media_type;const title=x.title||x.name||'Untitled';const poster=x.poster_path?C.TMDB_IMAGE+x.poster_path:'';return `<button class="suggest-item" data-id="${x.id}" data-type="${t}">${poster?`<img src="${poster}" alt="">`:'<span class="suggest-poster"></span>'}<span><b>${esc(title)}</b><small>${t==='tv'?'Series':'Movie'} · ${(x.release_date||x.first_air_date||'').slice(0,4)||'—'}</small></span></button>`}).join('');$$('.suggest-item',box).forEach(b=>b.onclick=()=>location.href=`details.html?id=${b.dataset.id}&type=${b.dataset.type}`);box.classList.add('show')}catch{hide()}},260)});document.addEventListener('click',e=>{if(!e.target.closest('.search-shell'))hide()})}
function setupSurprise(){const b=$('#surpriseBtn');if(!b)return;b.onclick=async()=>{b.disabled=true;try{const type=Math.random()>.45?'movie':'tv';const page=1+Math.floor(Math.random()*8);const d=await tmdb(`/discover/${type}`,{sort_by:'popularity.desc','vote_count.gte':300,page});const arr=d.results||[];const m=arr[Math.floor(Math.random()*arr.length)];if(m)location.href=`details.html?id=${m.id}&type=${type}`}catch(e){toast(e.message)}finally{b.disabled=false}}}

// ============================================================
// Adaptive Network + Performance Engine
// ============================================================
const NewFlixNetwork=(()=>{
  const CACHE_KEY='newflix_network_profile';
  const MODE_KEY='newflix_performance_mode';
  const AUTO_SOURCE_KEY='newflix_auto_source';
  const CACHE_MS=30*60*1000;
  const listeners=new Set();
  let running=null;
  let current=readCache()||{mode:'balanced',mbps:null,rtt:null,effectiveType:'unknown',saveData:false,source:'startup',testedAt:0};

  function conn(){return navigator.connection||navigator.mozConnection||navigator.webkitConnection||null}
  function readCache(){try{return JSON.parse(localStorage.getItem(CACHE_KEY)||'null')}catch{return null}}
  function manualMode(){const x=localStorage.getItem(MODE_KEY)||'auto';return ['auto','full','balanced','lite'].includes(x)?x:'auto'}
  function autoSource(){return localStorage.getItem(AUTO_SOURCE_KEY)!=='false'}
  function classify({mbps,rtt,effectiveType,saveData}){
    if(saveData||effectiveType==='slow-2g'||effectiveType==='2g')return 'lite';
    const m=Number(mbps),p=Number(rtt);
    // Slow Mode is intentionally conservative: keep effects off when throughput or latency may hurt browsing/video startup.
    if(effectiveType==='3g'||(m>0&&m<8)||(p>0&&p>450))return 'lite';
    return 'full';
  }
  function appliedMode(profile=current){const m=manualMode();return m==='auto'?(profile?.mode||'balanced'):m}
  function apply(profile=current){
    current=profile||current;
    const mode=appliedMode(current);
    document.documentElement.dataset.performance=mode;
    document.documentElement.dataset.network=mode;
    updateBadge();
    listeners.forEach(fn=>{try{fn({...current,appliedMode:mode})}catch(e){console.warn(e)}});
  }
  function save(profile){current=profile;localStorage.setItem(CACHE_KEY,JSON.stringify(profile));apply(profile);return profile}
  async function ping(){
    const samples=[];
    for(let i=0;i<2;i++){
      const t=performance.now();
      try{await fetch(`ico/favicon.svg?nf_ping=${Date.now()}_${i}`,{cache:'no-store'});samples.push(performance.now()-t)}catch{}
    }
    return samples.length?Math.round(samples.reduce((a,b)=>a+b,0)/samples.length):null;
  }
  async function downloadProbe(file,timeoutMs=9000){
    const ctl=new AbortController();const timer=setTimeout(()=>ctl.abort(),timeoutMs);const t=performance.now();
    try{const r=await fetch(`${file}?nf_speed=${Date.now()}`,{cache:'no-store',signal:ctl.signal});if(!r.ok)throw Error('probe failed');const b=await r.arrayBuffer();const sec=(performance.now()-t)/1000;return sec>0?Number(((b.byteLength*8/sec)/1e6).toFixed(2)):null}catch{return null}finally{clearTimeout(timer)}
  }
  function nativeSnapshot(){
    const c=conn();return {mbps:Number(c?.downlink)||null,rtt:Number(c?.rtt)||null,effectiveType:c?.effectiveType||'unknown',saveData:!!c?.saveData};
  }
  async function test({force=false,deep=false}={}){
    if(running&&!force)return running;
    running=(async()=>{
      const cached=readCache();if(!force&&cached&&Date.now()-Number(cached.testedAt||0)<CACHE_MS){apply(cached);return cached}
      const native=nativeSnapshot();
      // Native Network Information is instant and avoids wasting bandwidth on clearly slow/data-saver connections.
      if(native.saveData||['slow-2g','2g'].includes(native.effectiveType)){
        return save({...native,mode:'lite',source:'network-api',testedAt:Date.now()});
      }
      let rtt=await ping();
      let mbps=native.mbps;
      // Run a same-origin throughput probe when information is missing, forced, or a deeper Settings test was requested.
      if(force||deep||!mbps){
        const asset=(native.effectiveType==='3g'||(mbps&&mbps<5))?'assets/speed-256.bin':'assets/speed-1024.bin';
        const measured=await downloadProbe(asset,asset.includes('1024')?11000:8000);
        if(measured)mbps=measured;
      }
      const profile={mbps:mbps||null,rtt:rtt||native.rtt||null,effectiveType:native.effectiveType,saveData:native.saveData,mode:classify({mbps,rtt:rtt||native.rtt,effectiveType:native.effectiveType,saveData:native.saveData}),source:mbps&&mbps!==native.mbps?'active-test':'network-api',testedAt:Date.now()};
      return save(profile);
    })().finally(()=>running=null);
    return running;
  }
  function recommendation(kind='normal',profile=current){
    const mode=appliedMode(profile);
    if(kind==='watch')return mode==='full'?'moviesapi':'streamvault';
    // MoviesAPI documents Auto/adaptive quality; StreamVault documents HLS ABR + multi-source fallback.
    if(mode==='lite')return 'streamvault';
    return 'moviesapi';
  }
  function ranking(kind='normal',profile=current){
    const mode=appliedMode(profile);
    if(kind==='watch')return mode==='full'?['moviesapi','streamvault','vidzen','vidscene']:['streamvault','moviesapi','vidzen','vidscene'];
    if(mode==='lite')return ['streamvault','moviesapi','vidfast','vidzen','vidlink','vidscene'];
    return ['moviesapi','streamvault','vidfast','vidzen','vidlink','vidscene'];
  }
  function decorateSources(kind='normal'){
    const rank=ranking(kind),best=rank[0],grid=document.querySelector('.source-grid');
    document.querySelectorAll('.source-btn[data-source]').forEach(btn=>{
      const i=rank.indexOf(btn.dataset.source);btn.dataset.networkRank=i<0?'':String(i+1);btn.classList.toggle('network-recommended',btn.dataset.source===best);
      let tag=btn.querySelector('.network-rec-tag');
      if(btn.dataset.source===best){if(!tag){tag=document.createElement('span');tag.className='network-rec-tag';btn.append(tag)}tag.innerHTML='<i class="fa-solid fa-wand-magic-sparkles"></i> Best for you'}else tag?.remove();
    });
    if(grid){rank.slice().reverse().forEach(k=>{const el=grid.querySelector(`[data-source="${k}"]`);if(el)grid.prepend(el)})}
  }
  function updateBadge(){
    const b=document.getElementById('networkBadge');if(!b)return;const mode=appliedMode(current);b.dataset.mode=mode;
    const label=document.getElementById('networkBadgeLabel'),speed=document.getElementById('networkBadgeSpeed');
    if(label)label.textContent=manualMode()==='auto'?`${mode[0].toUpperCase()+mode.slice(1)} Auto`:mode[0].toUpperCase()+mode.slice(1);
    if(speed)speed.textContent=current.mbps?`${current.mbps.toFixed?current.mbps.toFixed(1):current.mbps} Mbps`:current.effectiveType&&current.effectiveType!=='unknown'?current.effectiveType.toUpperCase():'Optimized';
    b.title=`Connection optimizer: ${mode}${current.rtt?` · ${current.rtt} ms`:''}. Click to re-test.`;
  }
  function setMode(mode){if(!['auto','full','balanced','lite'].includes(mode))return;localStorage.setItem(MODE_KEY,mode);apply(current)}
  function setAutoSource(v){localStorage.setItem(AUTO_SOURCE_KEY,v?'true':'false')}
  function subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn)}
  function status(){return {...current,appliedMode:appliedMode(current),manualMode:manualMode(),autoSource:autoSource(),recommendedNormal:recommendation('normal'),recommendedWatch:recommendation('watch')}}
  function init(){
    apply(current);
    setTimeout(()=>{const b=document.getElementById('networkBadge');if(b&&!b.dataset.bound){b.dataset.bound='1';b.onclick=async()=>{b.classList.add('testing');await test({force:true,deep:false});b.classList.remove('testing');toast(`Connection optimized · ${appliedMode()} mode`)}};updateBadge()},0);
    const c=conn();if(c&&!c.__nfBound){c.__nfBound=true;c.addEventListener?.('change',()=>test({force:true,deep:false}))}
    const isPlayer=/player\.html$/i.test(location.pathname);
    test({force:false,deep:!isPlayer});
  }
  return {init,test,status,subscribe,setMode,setAutoSource,autoSource,manualMode,recommendation,ranking,decorateSources,apply};
})();
window.NewFlixNetwork=NewFlixNetwork;

document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>{renderAuth();setupSearch();setupSurprise();NewFlixNetwork.init()},0));
sb.auth.onAuthStateChange(()=>setTimeout(renderAuth,0));
