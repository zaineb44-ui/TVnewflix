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
    const {data:result,error:functionError}=await sb.functions.invoke('username-login',{
      body:{identifier:value,password}
    });
    if(functionError){
      console.error('Identifier login function error:',functionError);
      const context=functionError.context;
      let serverMessage='';
      try{
        if(context && typeof context.json==='function'){
          const body=await context.json();
          serverMessage=body?.error||'';
        }
      }catch(_){}
      return {success:false,error:serverMessage||'Could not reach the sign-in service. Make sure the username-login Edge Function is deployed and its settings are correct.'};
    }
    // The Edge Function returns HTTP errors through functionError above.
    if(!result){
      return {success:false,error:'The sign-in service returned an empty response. Please try again.'};
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
