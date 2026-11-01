async function signup(name,email,password,username){
  username=(username||name||'').trim().toLowerCase();
  if(!/^[a-z0-9_]{3,24}$/.test(username))return{success:false,error:'Username must be 3–24 characters (letters, numbers or underscores).'};
  const {data:existing}=await sb.from('profiles').select('id').eq('username',username).maybeSingle();
  if(existing)return{success:false,error:'That username is already taken.'};
  const {data,error}=await sb.auth.signUp({email,password,options:{data:{name,full_name:name,username}}});
  if(error)return{success:false,error:error.message};
  if(data.user){
    const {error:profileError}=await sb.from('profiles').upsert({id:data.user.id,display_name:name,username,email},{onConflict:'id'});
    if(profileError)console.warn('Profile will be completed after email confirmation:',profileError.message);
  }
  return{success:true,user:data.user};
}
async function signin(identifier,password){
  const value=(identifier||'').trim();let email=value;
  if(!value.includes('@')){
    const username=value.toLowerCase().replace(/^@/,'');
    const {data,error}=await sb.from('profiles').select('email').eq('username',username).maybeSingle();
    if(error)return{success:false,error:'Could not look up that username. Try signing in with your email.'};
    if(!data?.email)return{success:false,error:'Username not found. Try your email address.'};
    email=data.email;
  }
  const {data,error}=await sb.auth.signInWithPassword({email,password});
  if(error)return{success:false,error:error.message};
  const meta=data.user.user_metadata||{};
  await sb.from('profiles').upsert({id:data.user.id,email:data.user.email,username:meta.username||null,display_name:meta.full_name||meta.name||null},{onConflict:'id'});
  return{success:true,user:data.user};
}
window.signup=signup;window.signin=signin;
