let media, localTime=0, localDuration=0, localPlaying=false, lastProgressSave=0, providerKey='';
const P=()=>window.NewFlixProviders.providers;
function preferredNormal(){const saver=localStorage.getItem('newflix_data_saver')==='true';const auto=window.NewFlixNetwork?.autoSource?.()!==false;const rec=window.NewFlixNetwork?.recommendation?.('normal');const s=auto&&rec?rec:localStorage.getItem('newflix_source');if(saver&&!['streamvault','moviesapi','vidfast'].includes(s))return 'streamvault';return window.NewFlixProviders.normalKeys.includes(s)?s:'streamvault'}
function active(){return P()[providerKey]}
function paintSources(){window.NewFlixNetwork?.decorateSources?.('normal');document.querySelectorAll('.source-btn').forEach(b=>b.classList.toggle('active',b.dataset.source===providerKey));const x=$('#providerSyncLabel');if(x){const st=window.NewFlixNetwork?.status?.();x.textContent=`${active()?.adaptive?'Adaptive':'Standard'} · ${st?.appliedMode||'balanced'} mode`}}
let providerLoadTimer=null, confirmTimer=null, attemptNumber=0, triedProviders=[], healthState='idle', promptVisible=false;
const STARTUP_GRACE_MS=16000;
function providerOrder(){const rank=window.NewFlixNetwork?.ranking?.('normal')||window.NewFlixProviders.normalKeys;return [...rank,...window.NewFlixProviders.normalKeys.filter(k=>!rank.includes(k))]}
function nextUntestedProvider(){return providerOrder().find(k=>!triedProviders.includes(k))||null}
function clearHealthTimers(){clearTimeout(providerLoadTimer);clearTimeout(confirmTimer);providerLoadTimer=null;confirmTimer=null}
function setHealthMessage(title,detail){const t=$('#tvPlaybackStatusTitle'),d=$('#tvPlaybackStatusText');if(t)t.textContent=title;if(d)d.textContent=detail}
function showPlaybackCheck(){
 if(healthState!=='checking'||promptVisible)return;
 promptVisible=true;healthState='awaiting-confirmation';
 const prompt=$('#tvPlaybackCheck');if(prompt)prompt.dataset.awaiting='true';
 setHealthMessage('Is the video playing correctly?','If you can see and hear the movie, choose YES. If it is stuck, blank, or showing an error, choose NO to try another server.');
 const box=$('#tvPlaybackCheck');if(box){box.hidden=false;setTimeout(()=>$('#tvPlaybackYes')?.focus(),80)}
}
function hidePlaybackCheck(){const box=$('#tvPlaybackCheck');if(box){box.hidden=true;box.dataset.awaiting='false'}promptVisible=false}
function markPlaybackWorking(){
 if(!providerKey)return;
 clearHealthTimers();healthState='working';hidePlaybackCheck();
 localStorage.setItem('newflix_working_source',providerKey);
 const label=P()[providerKey]?.label||'Server';
 setHealthMessage(`${label} confirmed`,'Enjoy watching.');
 toast(`${label} is working`);
}
function markPlaybackFailed(reason='The server did not start the video.'){
 if(!providerKey||healthState==='switching')return;
 clearHealthTimers();hidePlaybackCheck();healthState='failed';
 const failed=providerKey,next=nextUntestedProvider();
 if(!next){
   setHealthMessage('No more servers to try',`Tried ${triedProviders.length} servers. You can retry the list or choose a server manually.`);
   const box=$('#tvPlaybackCheck');if(box){box.hidden=false;$('#tvPlaybackStatusTitle').textContent='No working server found';$('#tvPlaybackStatusText').textContent=`${reason} All available servers have been tried.`;$('#tvPlaybackYes').textContent='Retry servers';$('#tvPlaybackNo').textContent='Choose manually';$('#tvPlaybackYes').focus()}
   promptVisible=true;healthState='exhausted';const prompt=$('#tvPlaybackCheck');if(prompt)prompt.dataset.awaiting='true';return;
 }
 toast(`${P()[failed]?.label||'Server'} did not work · switching to ${P()[next]?.label||'another server'}`);
 setHealthMessage('Trying another server…',`${P()[failed]?.label||'Previous server'} did not work. Loading ${P()[next]?.label||'next server'}.`);
 healthState='switching';
 setTimeout(()=>loadProvider(next,localTime,false,{silent:true,automatic:true}),350);
}
function nextProvider(current){const rank=providerOrder(),i=rank.indexOf(current);return rank[(i+1+rank.length)%rank.length]}
function loadProvider(key,time=localTime,autoplay=false,{silent=false,automatic=false,resetAttempts=false}={}){
 if(!P()[key])return;
 if(resetAttempts){triedProviders=[];attemptNumber=0}
 if(!triedProviders.includes(key))triedProviders.push(key);
 clearHealthTimers();hidePlaybackCheck();closeServerPicker();
 providerKey=key;attemptNumber++;healthState='checking';localPlaying=false;
 localStorage.setItem('newflix_source',key);paintSources();
 const frame=$('#player');frame.onload=()=>{ /* iframe navigation is NOT proof that its video works */ };
 frame.onerror=()=>markPlaybackFailed('The embedded player could not be loaded.');
 frame.src=P()[key].url(media,time,autoplay);
 setHealthMessage(`Checking ${P()[key].label}…`,'Waiting for the video player. You will be asked to confirm playback if the server does not report its status.');
 // A cross-origin iframe cannot be inspected directly. Providers that send a
 // supported postMessage readiness/playback event are detected automatically.
 providerLoadTimer=setTimeout(()=>{
   if(healthState==='checking')showPlaybackCheck();
 },STARTUP_GRACE_MS);
 if(!silent)toast(`${P()[key].label} selected`);
}
async function saveProgress(t,d){const u=await currentUser();if(!u||Date.now()-lastProgressSave<6000)return;lastProgressSave=Date.now();const payload={user_id:u.id,tmdb_id:media.id,media_type:media.type,title:$('#mediaTitle')?.textContent||'',poster_path:window.__poster||null,season_number:media.type==='tv'?media.season:null,episode_number:media.type==='tv'?media.episode:null,position_seconds:t||0,duration_seconds:d||null,progress_percent:d?Math.min(100,(t/d)*100):0,provider:providerKey,last_watched_at:new Date().toISOString()};let x=sb.from('watch_history').select('id').eq('user_id',u.id).eq('tmdb_id',media.id).eq('media_type',media.type);if(media.type==='tv')x=x.eq('season_number',media.season).eq('episode_number',media.episode);const {data}=await x.maybeSingle();if(data)await sb.from('watch_history').update(payload).eq('id',data.id);else await sb.from('watch_history').insert(payload)}
function setupEpisodes(tv){const wrap=$('#controlsWrapper');wrap.style.display='flex';$('#seasonButtons').innerHTML=Array.from({length:tv.number_of_seasons||1},(_,i)=>`<button data-season="${i+1}" class="btn ${i+1===media.season?'primary':''}">S${i+1}</button>`).join('');$$('[data-season]').forEach(b=>b.onclick=()=>location.href=`player.html?id=${media.id}&type=tv&season=${b.dataset.season}&episode=1`)}
async function setupEpisodeButtons(){const s=await tmdb(`/tv/${media.id}/season/${media.season}`);$('#episodeSection').style.display='block';$('#episodeButtons').innerHTML=(s.episodes||[]).map(e=>`<button data-episode="${e.episode_number}" class="btn ${e.episode_number===media.episode?'primary':''}">${e.episode_number}</button>`).join('');$$('[data-episode]').forEach(b=>b.onclick=()=>location.href=`player.html?id=${media.id}&type=tv&season=${media.season}&episode=${b.dataset.episode}`)}
function toggleFullscreen(){const w=$('#playerWrap');if(document.fullscreenElement)return document.exitFullscreen?.();w?.requestFullscreen?.().catch(()=>toast('Fullscreen was blocked by the browser.'))}
function openServerPicker(){
 const overlay=$('#tvServerOverlay'),grid=$('#tvServerOptions');if(!overlay||!grid)return;
 const rank=providerOrder();
 grid.innerHTML=rank.map(k=>{const p=P()[k];return `<button class="tv-server-option" data-tv-server="${k}"><span class="tv-server-icon">▶</span><span><b>${p.label}</b><small>${p.adaptive?'Adaptive quality':'Standard stream'}${k===rank[0]?' · Recommended':''}</small></span><span class="tv-server-check">›</span></button>`}).join('');
 overlay.hidden=false;document.body.classList.add('server-picker-open');
 grid.querySelectorAll('[data-tv-server]').forEach(b=>b.addEventListener('click',()=>selectServer(b.dataset.tvServer)));
 setTimeout(()=>grid.querySelector('button')?.focus(),80);
}
function closeServerPicker(){const o=$('#tvServerOverlay');if(o){o.hidden=true;document.body.classList.remove('server-picker-open')}}
async function selectServer(key){
 const wrap=$('#playerWrap');try{if(!document.fullscreenElement&&wrap?.requestFullscreen)await wrap.requestFullscreen()}catch(_){}
 loadProvider(key,localTime,localStorage.getItem('newflix_autoplay')!=='false',{resetAttempts:true});
 setTimeout(()=>$('#player')?.focus?.(),250);
}
function bindPlaybackCheck(){
 $('#tvPlaybackYes')?.addEventListener('click',()=>{
   if(healthState==='exhausted'){const first=providerOrder()[0];hidePlaybackCheck();triedProviders=[];healthState='idle';if(first)loadProvider(first,localTime,false,{silent:true,automatic:true,resetAttempts:true});return}
   markPlaybackWorking();
 });
 $('#tvPlaybackNo')?.addEventListener('click',()=>{
   if(healthState==='exhausted'){hidePlaybackCheck();healthState='idle';openServerPicker();return}
   markPlaybackFailed('You reported that the video is not working.');
 });
}
document.addEventListener('DOMContentLoaded',async()=>{
 media=mediaFromParams();bindPlaybackCheck();
 await window.NewFlixNetwork?.test?.({force:false,deep:false});
 providerKey=preferredNormal();
 $('#fullscreenBtn')?.addEventListener('click',toggleFullscreen);
 $('#tvServerOverlay')?.addEventListener('click',e=>{if(e.target.id==='tvServerOverlay')closeServerPicker()});
 $$('.source-btn').forEach(b=>b.onclick=()=>loadProvider(b.dataset.source,localTime,localPlaying,{resetAttempts:true}));
 try{
   const m=await tmdb(`/${media.type}/${media.id}`);
   $('#mediaTitle').textContent=m.title||m.name;$('#mediaOverview').textContent=m.overview||'';window.__poster=m.poster_path;
   let resumeAt=0;const u=await currentUser();
   if(u){let q=sb.from('watch_history').select('position_seconds,duration_seconds').eq('user_id',u.id).eq('tmdb_id',media.id).eq('media_type',media.type);if(media.type==='tv')q=q.eq('season_number',media.season).eq('episode_number',media.episode);const {data:h}=await q.maybeSingle();if(h&&Number(h.position_seconds)>20&&(!h.duration_seconds||Number(h.position_seconds)<Number(h.duration_seconds)-120))resumeAt=Number(h.position_seconds)||0}
   localTime=resumeAt;openServerPicker();
   if(resumeAt>0)toast(`Resuming at ${Math.floor(resumeAt/60)}:${String(Math.floor(resumeAt%60)).padStart(2,'0')}`);
   if(media.type==='tv'){const tv=await tmdb(`/tv/${media.id}`);setupEpisodes(tv);await setupEpisodeButtons()}
 }catch(e){toast(e.message)}
});
window.addEventListener('message',e=>{
 const x=window.NewFlixProviders.normalizeMessage(e);if(!x)return;
 // Only accept status messages from the currently selected provider.
 if(x.provider!==providerKey)return;
 localTime=Number(x.currentTime||localTime);localDuration=Number(x.duration||localDuration);
 if(typeof x.playing==='boolean')localPlaying=x.playing;
 if(['playing','play'].includes(x.event)&&healthState==='checking')markPlaybackWorking();
 if(x.event==='error'){markPlaybackFailed(x.error||'The provider reported a playback error.');return}
 if(['timeupdate','playing','state'].includes(x.event))saveProgress(localTime,localDuration);
});
window.NewFlixNetwork?.subscribe?.(()=>{window.NewFlixNetwork?.decorateSources?.('normal');paintSources()});
