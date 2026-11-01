let roomChannel=null,msgChannel=null;
document.addEventListener('DOMContentLoaded',async()=>{
  const u=await requireUser(),id=new URLSearchParams(location.search).get('id');
  if(!id)return location.href='rooms.html';
  let {data:r,error}=await sb.from('rooms').select('*').eq('id',id).single();
  if(error)return $('#roomRoot').innerHTML='<div class="empty">Room unavailable.</div>';
  let {data:member}=await sb.from('room_members').select('*').eq('room_id',id).eq('user_id',u.id).maybeSingle();
  if(!member){const join=await sb.rpc('join_room',{p_room_id:id});if(join.error)return $('#roomRoot').innerHTML=`<div class="empty">${esc(join.error.message||'You need an invitation or access to this room.')}</div>`;const mr=await sb.from('room_members').select('*').eq('room_id',id).eq('user_id',u.id).maybeSingle();member=mr.data}
  const isOwner=r.owner_id===u.id;

  function paintRoom(){
    $('#roomName').textContent=r.name;
    $('#roomMeta').textContent=`${r.room_code} · ${r.visibility}${r.media_title?' · '+r.media_title:''}`;
    $('#openPlayer').href=`watchtogether-player.html?id=${r.tmdb_id||''}&type=${r.media_type||'movie'}&room=${id}`;
    $('#openPlayer').style.display=r.tmdb_id?'inline-flex':'none';
    if(member.role==='host'||member.role==='moderator')$('#controllerNote').textContent='You control playback for this room.';
    if(isOwner)$('#manageRoom').style.display='inline-flex';
  }
  paintRoom();

  async function members(){const {data}=await sb.from('room_members').select('user_id,role,profiles:user_id(username,display_name,avatar_url)').eq('room_id',id);$('#memberList').innerHTML=(data||[]).map(x=>`<div class="user-row"><div class="avatar">${x.profiles?.avatar_url?`<img src="${esc(x.profiles.avatar_url)}" alt="" referrerpolicy="no-referrer">`:esc((x.profiles?.display_name||x.profiles?.username||'?')[0].toUpperCase())}</div><div class="grow"><b>${esc(x.profiles?.display_name||x.profiles?.username||'User')}</b><div class="muted">${x.role}</div></div></div>`).join('')}
  async function messages(){const {data}=await sb.from('room_messages').select('*,profiles:user_id(username,display_name)').eq('room_id',id).order('created_at',{ascending:true}).limit(100);$('#chatMessages').innerHTML=(data||[]).map(m=>`<div class="chat-msg"><b>${esc(m.profiles?.display_name||m.profiles?.username||'User')}</b><div>${esc(m.message)}</div></div>`).join('');$('#chatMessages').scrollTop=999999}
  $('#chatForm').onsubmit=async e=>{e.preventDefault();const input=$('#chatInput'),message=input.value.trim();if(!message)return;input.value='';await sb.from('room_messages').insert({room_id:id,user_id:u.id,message})};
  $('#copyInvite').onclick=()=>{navigator.clipboard.writeText(`${location.origin}/room.html?id=${id}`);toast('Room link copied')};
  $('#inviteBtn').onclick=async()=>{const q=$('#inviteUser').value.trim();if(!q)return;const {data:p}=await sb.from('profiles').select('id,username,display_name').or(`username.eq.${q},display_name.ilike.${q}`).neq('id',u.id).limit(1).maybeSingle();if(!p)return toast('User not found');const {error}=await sb.from('room_invites').insert({room_id:id,inviter_id:u.id,invitee_id:p.id});toast(error?error.message:'Invitation sent to @'+p.username)};
  $('#leaveRoom').onclick=async()=>{if(isOwner){if(confirm('Close this room for everyone? You can permanently remove it from the Rooms manager.')){await sb.from('rooms').update({is_active:false}).eq('id',id);location.href='rooms.html'}}else{await sb.from('room_members').delete().eq('room_id',id).eq('user_id',u.id);location.href='rooms.html'}};
  $('#manageRoom').onclick=()=>location.href=`rooms.html?manage=${encodeURIComponent(id)}`;
  await members();await messages();
  roomChannel=sb.channel('room-members-'+id).on('postgres_changes',{event:'*',schema:'public',table:'room_members',filter:`room_id=eq.${id}`},members).subscribe();
  msgChannel=sb.channel('room-chat-'+id).on('postgres_changes',{event:'*',schema:'public',table:'room_messages',filter:`room_id=eq.${id}`},messages).subscribe();
});
