// Deploy: supabase functions deploy username-login
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,"Content-Type":"application/json"}});
Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
  if(req.method!=="POST")return json({error:"Method not allowed."},405);
  try{
    const {username,password}=await req.json();const clean=String(username||"").trim().replace(/^@/,"").toLowerCase();const pass=String(password||"");
    if(!/^[a-z0-9_]{3,24}$/.test(clean)||!pass)return json({error:"Enter a valid username and password."},400);
    const url=Deno.env.get("SUPABASE_URL")!,anonKey=Deno.env.get("SUPABASE_ANON_KEY")!,serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if(!url||!anonKey||!serviceKey)return json({error:"Username sign-in is not configured on the server."},500);
    const admin=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:mapping,error:lookupError}=await admin.from("newflix_username_index").select("user_id").eq("username",clean).maybeSingle();
    if(lookupError){console.error("Username index lookup failed:",lookupError.message);return json({error:"Username sign-in is not configured. Run the database upgrade first."},503);}
    if(!mapping?.user_id)return json({error:"Username not found."},404);
    const {data:account,error:accountError}=await admin.auth.admin.getUserById(mapping.user_id);
    if(accountError||!account.user?.email){console.error("Account lookup failed:",accountError?.message);return json({error:"Could not find the account for this username."},404);}
    const client=createClient(url,anonKey,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:signedIn,error:signInError}=await client.auth.signInWithPassword({email:account.user.email,password:pass});
    if(signInError||!signedIn.session)return json({error:"Incorrect username or password."},401);
    return json({session:signedIn.session,user:signedIn.user});
  }catch(error){console.error("username-login error:",error);return json({error:"Unexpected username sign-in error."},500);}
});
