async function signup(name,email,password,username){
  const cleanUsername=(username||'').trim().toLowerCase();
  if(!/^[a-z0-9_]{3,24}$/.test(cleanUsername))
    return {success:false,error:'Username must be 3–24 characters (letters, numbers or underscores).'};

  const {data,error}=await sb.auth.signUp({
    email:email.trim().toLowerCase(),
    password,
    options:{data:{name:name.trim(),full_name:name.trim(),display_name:name.trim(),username:cleanUsername}}
  });
  if(error){
    const msg=error.message||'Could not create your account.';
    if(/already registered|already exists|duplicate/i.test(msg))
      return {success:false,error:'This email is already registered. Try signing in instead.'};
    return {success:false,error:msg};
  }
  return {success:true,user:data.user,session:data.session};
}

async function signin(identifier,password){
  const value=(identifier||'').trim();
  if(!value) return {success:false,error:'Enter your email, username, or display name.'};
  if(!password) return {success:false,error:'Enter your password.'};

  if(value.includes('@')){
    const {data,error}=await sb.auth.signInWithPassword({
      email:value.toLowerCase(),
      password
    });
    if(error) return {success:false,error:authError(error)};
    await syncSignedInProfile(data.user);
    return {success:true,user:data.user};
  }

  try{
    const response=await fetch(`${NEWFLIX_CONFIG.SUPABASE_URL}/functions/v1/username-login`,{
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'apikey':NEWFLIX_CONFIG.SUPABASE_KEY,
        'Authorization':`Bearer ${NEWFLIX_CONFIG.SUPABASE_KEY}`
      },
      body:JSON.stringify({identifier:value,password})
    });
    const result=await response.json().catch(()=>({}));
    if(!response.ok){
      if(response.status===404)return {success:false,error:'No account was found with that username or display name.'};
      if(response.status===409)return {success:false,error:'More than one account uses that display name. Please sign in with your unique username or email instead.'};
      if(response.status===401)return {success:false,error:'Incorrect password.'};
      if(response.status===429)return {success:false,error:'Too many attempts. Please wait a moment and try again.'};
      return {success:false,error:result.error||'Username/display-name sign-in is not configured. Run the database migration and deploy the username-login function.'};
    }
    if(!result.session)return {success:false,error:'Sign-in did not return a session. Please try again.'};
    const {data,error}=await sb.auth.setSession({
      access_token:result.session.access_token,
      refresh_token:result.session.refresh_token
    });
    if(error)return {success:false,error:authError(error)};
    await syncSignedInProfile(data.user||result.user);
    return {success:true,user:data.user||result.user};
  }catch(err){
    console.error('Identifier sign-in failed:',err);
    return {success:false,error:'Could not reach sign-in service. Check your connection and try again.'};
  }
}

async function syncSignedInProfile(user){
  if(!user?.id)return;
  const meta=user.user_metadata||{};
  const {error}=await sb.from('profiles').upsert({
    id:user.id,
    username:(meta.username||'').toLowerCase()||null,
    display_name:meta.display_name||meta.full_name||meta.name||null
  },{onConflict:'id'});
  if(error)console.warn('Profile sync will be completed by the database trigger:',error.message);
}
function authError(error){
  const message=error?.message||'Sign-in failed.';
  if(/invalid login credentials/i.test(message))return 'Incorrect email or password.';
  if(/email not confirmed/i.test(message))return 'Please confirm your email address before signing in.';
  return message;
}
window.signup=signup;
window.signin=signin;
