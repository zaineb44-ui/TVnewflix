(() => {
  'use strict';
  const lang = () => localStorage.getItem('newflix_sub_lang') || 'en';
  const enc = n => Math.max(0, Math.floor(Number(n) || 0));
  const q = obj => { const p=new URLSearchParams(); Object.entries(obj).forEach(([k,v])=>{if(v!==undefined&&v!==null&&v!=='')p.set(k,String(v))}); return p.toString(); };
  const basePath=(m,rootMovie,rootTv)=>m.type==='tv'?`${rootTv}/${m.id}/${m.season||1}/${m.episode||1}`:`${rootMovie}/${m.id}`;
  const providers = {
    streamvault:{
      label:'StreamVault', sync:'full', adaptive:true, lowBandwidth:true, origin:'https://streamvaultsrc.click', readyTimeout:12000,
      url(m,t=0){return `${basePath(m,'https://streamvaultsrc.click/embed/movie','https://streamvaultsrc.click/embed/tv')}?${q({t:enc(t)})}`},
      command(frame,cmd,x={}){const map={play:{type:'play'},pause:{type:'pause'},seek:{type:'seek',data:{time:+x.time||0}},getStatus:{type:'getState'},sync:{type:'sync',data:{time:+x.time||0,paused:!!x.paused,tolerance:x.tolerance??1.25}}};if(map[cmd])frame.contentWindow.postMessage(map[cmd],this.origin)},
      normalize(e,d){if(e.origin!==this.origin||!d||typeof d!=='object')return null; const x=d.data||{}; if(!['ready','play','pause','seeked','buffering','playing','timeupdate','ended','state','autoplay-blocked'].includes(d.type))return null;return {event:d.type,currentTime:+(x.time??x.currentTime)||0,duration:+x.duration||0,playing:typeof x.paused==='boolean'?!x.paused:(d.type==='play'||d.type==='playing'?true:d.type==='pause'||d.type==='ended'?false:undefined)};}
    },
    moviesapi:{
      label:'MoviesAPI', sync:'full', adaptive:false, lowBandwidth:false, origin:'https://moviesapi.to', readyTimeout:12000,
      url(m){return `${basePath(m,'https://moviesapi.to/movie','https://moviesapi.to/tv')}?theme=ff315b`},
      command(frame,cmd,x={}){const action=cmd==='seek'?'seek':cmd==='getStatus'?'getStatus':cmd; frame.contentWindow.postMessage({action,...(cmd==='seek'?{time:+x.time||0}:{})},'*')},
      normalize(e,d){if(e.origin!==this.origin||d?.source!=='moviesapi-player')return null; return {event:d.event,currentTime:+d.currentTime||0,duration:+d.duration||0,playing:typeof d.paused==='boolean'?!d.paused:(d.event==='play'?true:d.event==='pause'||d.event==='ended'?false:undefined)};}
    },
    vidzen:{
      label:'VidZen', sync:'full', adaptive:false, lowBandwidth:false, origin:'https://vidzen.fun', readyTimeout:12000,
      url(m,t=0){const base=basePath(m,'https://vidzen.fun/movie','https://vidzen.fun/tv');return t?`${base}?startAt=${enc(t)}`:base},
      command(frame,cmd,x={}){const c=cmd==='getStatus'?'getStatus':cmd; frame.contentWindow.postMessage(JSON.stringify({command:c,...(cmd==='seek'?{time:+x.time||0}:{})}),'*')},
      normalize(e,d){if(e.origin!==this.origin)return null; if(typeof d==='string'){try{d=JSON.parse(d)}catch{return null}} if(d?.type!=='PLAYER_EVENT')return null; const x=d.data||{}; return {event:x.event,currentTime:+(x.currentTime??x.time)||0,duration:+x.duration||0,playing:typeof x.playing==='boolean'?x.playing:(x.event==='play'?true:x.event==='pause'||x.event==='ended'?false:undefined)};}
    },
    vidscene:{
      label:'VidScene', sync:'full', adaptive:true, lowBandwidth:true, origin:'https://player.vidscene.app', readyTimeout:12000,
      url(m,t=0,autoplay=false){const base=basePath(m,'https://player.vidscene.app/movie','https://player.vidscene.app/tv');return `${base}?${q({theme:'ff315b',autoplay:autoplay?'true':'false',progress:enc(t),persistProgress:'false',languages:lang(),nextEpisodeButton:m.type==='tv'?'true':undefined,episodeSelector:m.type==='tv'?'true':undefined})}`},
      command(frame,cmd,x={}){const command=cmd==='seek'?'seekTo':cmd; frame.contentWindow.postMessage({type:'VIDSCENE_PLAYER_COMMAND',command,...(cmd==='seek'?{time:+x.time||0}:{})},this.origin)},
      normalize(e,d){if(e.origin!==this.origin||d?.type!=='VIDSCENE_PLAYER_EVENT')return null; const x=d.data||{}; return {event:x.event,currentTime:+x.currentTime||0,duration:+x.duration||0,playing:typeof x.paused==='boolean'?!x.paused:undefined,error:x.message||null};}
    },
    vidfast:{
      label:'VidFast', sync:'reload', adaptive:true, lowBandwidth:true, origin:'https://vidfast.vc', readyTimeout:0,
      url(m,t=0,autoplay=false){const base=basePath(m,'https://vidfast.vc/movie','https://vidfast.vc/tv');return `${base}?${q({autoPlay:autoplay?'true':'false',startAt:enc(t),theme:'ff315b',title:'true',poster:'true',nextButton:m.type==='tv'?'true':undefined,autoNext:m.type==='tv'?'true':undefined,sub:lang()})}`},
      command(){}, normalize(){return null;}
    },
    vidlink:{
      label:'VidLink', sync:'position', adaptive:false, lowBandwidth:false, origin:'https://vidlink.pro', readyTimeout:0,
      url(m,t=0,autoplay=false){const base=basePath(m,'https://vidlink.pro/movie','https://vidlink.pro/tv');return `${base}?${q({primaryColor:'ff315b',secondaryColor:'8b5cf6',iconColor:'ffffff',icons:'vid',title:'true',poster:'true',autoplay:autoplay?'true':'false',startAt:enc(t),nextbutton:m.type==='tv'?'true':undefined})}`},
      command(){}, normalize(e,d){if(e.origin!==this.origin||d?.type!=='PLAYER_EVENT')return null;const x=d.data||{};return {event:x.event,currentTime:+x.currentTime||0,duration:+x.duration||0,playing:x.event==='play'?true:x.event==='pause'||x.event==='ended'?false:undefined};}
    }
  };
  function normalizeMessage(e){for(const p of Object.values(providers)){const x=p.normalize?.(e,e.data);if(x)return {...x,provider:Object.keys(providers).find(k=>providers[k]===p)}}return null}
  window.NewFlixProviders={providers,normalizeMessage,fullSyncKeys:['streamvault','moviesapi','vidzen','vidscene'],normalKeys:['streamvault','moviesapi','vidzen','vidscene','vidfast','vidlink']};
})();
