document.addEventListener('DOMContentLoaded',async()=>{
  const u=await requireUser();
  const qs=new URLSearchParams(location.search);
  let rooms=[];

  const modal=$('#roomEditorModal');
  const editorForm=$('#roomEditorForm');
  const editorTitle=$('#roomEditorTitle');
  const editorId=$('#editRoomId');
  const editorName=$('#editRoomName');
  const editorVisibility=$('#editRoomVisibility');
  const editorMediaType=$('#editRoomMediaType');
  const editorTmdbId=$('#editRoomTmdbId');
  const editorMediaPreview=$('#editRoomMediaPreview');
  const deleteBtn=$('#deleteRoomBtn');

  function roomCard(r){
    const owned=r.owner_id===u.id;
    const media=r.media_title||'No title selected';
    const count=Array.isArray(r.room_members)?(r.room_members[0]?.count||0):0;
    return `<article class="room-manage-card" data-room-id="${esc(r.id)}">
      <div class="room-manage-icon"><i class="fa-solid fa-users-viewfinder"></i></div>
      <div class="room-manage-copy">
        <div class="room-manage-title"><b>${esc(r.name)}</b>${owned?'<span class="owner-badge">OWNER</span>':''}</div>
        <div class="muted">${esc(media)}</div>
        <div class="room-meta-pills"><span><i class="fa-solid fa-lock${r.visibility==='public'?'-open':''}"></i> ${esc(r.visibility)}</span><span><i class="fa-solid fa-key"></i> ${esc(r.room_code||'—')}</span><span><i class="fa-solid fa-user-group"></i> ${count}</span></div>
      </div>
      <div class="room-manage-actions">
        <a class="btn primary" href="room.html?id=${encodeURIComponent(r.id)}"><i class="fa-solid fa-arrow-right"></i> Open</a>
        ${owned?`<button class="btn" type="button" data-edit-room="${esc(r.id)}"><i class="fa-solid fa-pen-to-square"></i> Manage</button>`:''}
      </div>
    </article>`;
  }

  async function load(){
    const {data,error}=await sb.from('rooms').select('*,room_members(count)').eq('is_active',true).order('created_at',{ascending:false});
    if(error){$('#roomsList').innerHTML=`<div class="empty">${esc(error.message)}</div>`;return}
    rooms=data||[];
    $('#roomsList').innerHTML=rooms.length?rooms.map(roomCard).join(''):'<div class="empty">No active rooms yet.</div>';
    $$('[data-edit-room]').forEach(btn=>btn.onclick=()=>openEditor(btn.dataset.editRoom));
  }

  async function resolveMedia(type,id){
    const n=Number(id||0);
    if(!type||!n)return {title:null,poster:null,backdrop:null};
    const m=await tmdb(`/${type}/${n}`);
    return {title:m.title||m.name||null,poster:m.poster_path||null,backdrop:m.backdrop_path||null};
  }

  function showModal(){
    modal.hidden=false;
    document.body.classList.add('modal-open');
    setTimeout(()=>editorName.focus(),30);
  }
  function closeModal(){
    modal.hidden=true;
    document.body.classList.remove('modal-open');
    editorForm.reset();
    editorMediaPreview.textContent='Keep the existing title, replace it by TMDB ID, or choose None.';
  }

  function openEditor(id){
    const r=rooms.find(x=>String(x.id)===String(id));
    if(!r||r.owner_id!==u.id)return toast('Only the room owner can manage this room.');
    editorId.value=r.id;
    editorTitle.textContent=`Manage ${r.name}`;
    editorName.value=r.name||'';
    editorVisibility.value=r.visibility||'private';
    editorMediaType.value=r.media_type||'';
    editorTmdbId.value=r.tmdb_id||'';
    editorMediaPreview.innerHTML=r.media_title?`Current title: <b>${esc(r.media_title)}</b>`:'No title is currently attached.';
    deleteBtn.dataset.roomId=r.id;
    showModal();
  }

  $('#roomEditorClose').onclick=closeModal;
  $('#roomEditorCancel').onclick=closeModal;
  modal?.addEventListener('click',e=>{if(e.target===modal)closeModal()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!modal.hidden)closeModal()});

  $('#previewRoomMedia').onclick=async()=>{
    const type=editorMediaType.value;
    const id=Number(editorTmdbId.value||0);
    if(!type||!id){editorMediaPreview.textContent='Choose Movie or TV and enter a valid TMDB ID.';return}
    try{
      editorMediaPreview.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Looking up title…';
      const m=await resolveMedia(type,id);
      editorMediaPreview.innerHTML=`Found: <b>${esc(m.title||'Untitled')}</b>`;
    }catch(err){editorMediaPreview.textContent='Could not find that TMDB title.'}
  };

  $('#clearRoomMedia').onclick=()=>{
    editorMediaType.value='';editorTmdbId.value='';editorMediaPreview.textContent='The room will have no selected title.';
  };

  editorForm.onsubmit=async e=>{
    e.preventDefault();
    const id=editorId.value;
    const btn=$('#saveRoomBtn');
    btn.disabled=true;
    const old=btn.innerHTML;btn.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Saving…';
    try{
      const name=editorName.value.trim();
      if(name.length<2||name.length>60)throw new Error('Room name must be 2–60 characters.');
      const visibility=editorVisibility.value;
      const type=editorMediaType.value||null;
      const tmdbId=Number(editorTmdbId.value||0)||null;
      if((type&&!tmdbId)||(!type&&tmdbId))throw new Error('Choose a media type and TMDB ID together.');
      const media=type&&tmdbId?await resolveMedia(type,tmdbId):{title:null,poster:null,backdrop:null};
      const {error}=await sb.rpc('newflix_update_room',{
        p_room_id:id,p_name:name,p_visibility:visibility,p_tmdb_id:tmdbId,p_media_type:type,
        p_media_title:media.title,p_poster_path:media.poster,p_backdrop_path:media.backdrop
      });
      if(error)throw error;
      toast('Room updated');closeModal();await load();
    }catch(err){toast(err.message||'Could not update room')}
    finally{btn.disabled=false;btn.innerHTML=old}
  };

  deleteBtn.onclick=async()=>{
    const id=deleteBtn.dataset.roomId;
    const r=rooms.find(x=>String(x.id)===String(id));
    if(!r)return;
    const phrase=prompt(`Permanently remove “${r.name}” and its chat, invites and playback state?\n\nType DELETE to confirm.`);
    if(phrase!=='DELETE')return;
    deleteBtn.disabled=true;
    try{
      const {error}=await sb.rpc('newflix_delete_room',{p_room_id:id});
      if(error)throw error;
      toast('Room removed permanently');closeModal();await load();
    }catch(err){toast(err.message||'Could not remove room')}
    finally{deleteBtn.disabled=false}
  };

  async function createRoom(){
    const btn=$('#createRoomBtn');btn.disabled=true;const old=btn.innerHTML;btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Creating…';
    try{
      const name=$('#roomName').value.trim()||'Watch Party';
      const vis=$('#visibility').value;
      let tmdbId=Number(qs.get('id')||0)||null;
      let type=qs.get('type')==='tv'?'tv':qs.get('type')==='movie'?'movie':null;
      let title='',poster=null,backdrop=null;
      if(tmdbId&&type){const m=await tmdb(`/${type}/${tmdbId}`);title=m.title||m.name||'';poster=m.poster_path||null;backdrop=m.backdrop_path||null}
      const {data,error}=await sb.rpc('create_room',{p_name:name,p_visibility:vis,p_tmdb_id:tmdbId,p_media_type:type,p_media_title:title||null,p_poster_path:poster,p_backdrop_path:backdrop,p_provider:'streamvault'});
      if(error)throw error;if(!data)throw new Error('Room creation returned no room ID.');location.href='room.html?id='+data;
    }catch(err){toast(err.message||'Could not create room');btn.disabled=false;btn.innerHTML=old}
  }

  $('#createRoomBtn').onclick=createRoom;
  await load();
  if(qs.get('manage')) openEditor(qs.get('manage'));
  if(qs.get('create')==='1')$('#roomName').focus();
});
