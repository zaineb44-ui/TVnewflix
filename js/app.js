document.addEventListener('DOMContentLoaded',async()=>{
  try{
    const trend=await tmdb('/trending/all/week');
    const media=(trend.results||[]).filter(x=>x.media_type==='movie'||x.media_type==='tv');
    const hero=media.find(x=>x.backdrop_path)||media[0];
    if(hero){const h=$('#hero');h.style.backgroundImage=`url(${C.TMDB_BACKDROP}${hero.backdrop_path||''})`;$('#heroTitle').textContent=hero.title||hero.name;$('#heroOverview').textContent=hero.overview||'Discover something worth watching.';$('#heroMeta').innerHTML=`<span>${hero.media_type==='tv'?'Series':'Movie'}</span><span>${(hero.release_date||hero.first_air_date||'').slice(0,4)||'New'}</span><span>⭐ ${Number(hero.vote_average||0).toFixed(1)}</span>`;$('#watchHero').onclick=()=>location.href=`details.html?id=${hero.id}&type=${hero.media_type}`;$('#listHero').onclick=()=>toggleWatchlist(hero.id,hero.media_type,hero.title||hero.name,hero.poster_path,$('#listHero'))}
    const main=$('#homeSections');
    const addSection=(title,subtitle,items,type=null,link='')=>{if(!items?.length)return;const s=document.createElement('section');s.className='section-shell';s.innerHTML=`<div class="section-title"><div><h2>${esc(title)}</h2><p class="muted">${esc(subtitle)}</p></div>${link?`<a class="section-link" href="${link}">View all <i class="fa-solid fa-arrow-right"></i></a>`:''}</div><div class="cards">${items.map(m=>card(m,type||m.media_type||mediaTypeOf(m))).join('')}</div>`;main.append(s);bindCards(s)};
    const u=await currentUser();
    if(u){const {data:hx}=await sb.from('watch_history').select('*').eq('user_id',u.id).order('last_watched_at',{ascending:false}).limit(8);if(hx?.length){const s=document.createElement('section');s.className='section-shell';s.innerHTML=`<div class="section-title"><div><h2>Continue Watching</h2><p class="muted">Jump back in exactly where you stopped.</p></div><a class="section-link" href="history.html">View history <i class="fa-solid fa-arrow-right"></i></a></div><div class="cards">${hx.map(historyCard).join('')}</div>`;main.append(s);bindCards(s)}}
    addSection('Trending Now','What everyone is watching this week.',media.slice(0,12),null,'search.html?q=trending');
    const [movies,series,docs,top] = await Promise.all([
      tmdb('/movie/popular'),tmdb('/tv/popular'),tmdb('/discover/movie',{with_genres:99,sort_by:'popularity.desc','vote_count.gte':80}),tmdb('/movie/top_rated')
    ]);
    addSection('Popular Movies','Big-screen favorites and current hits.',movies.results?.slice(0,12),'movie','movies.html');
    addSection('Binge-worthy Series','Start one episode. Stay for six.',series.results?.slice(0,12),'tv','series.html');
    addSection('Documentary Spotlight','Real stories, remarkable people, and ideas worth exploring.',docs.results?.slice(0,12),'movie','documentaries.html');
    addSection('Critically Loved','Highly rated films when you want something great.',top.results?.filter(x=>(x.vote_count||0)>1000).slice(0,12),'movie','movies.html');
  }catch(e){$('#homeSections').innerHTML=`<div class="empty">Could not load catalog. ${esc(e.message)}</div>`}
});
