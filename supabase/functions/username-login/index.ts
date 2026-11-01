// Deploy: supabase functions deploy username-login
// This endpoint accepts a display name or username plus password.
// Gateway JWT verification is disabled in supabase/config.toml because the
// browser uses a Supabase publishable key. Supabase Auth still verifies the
// supplied password before any session is returned.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  try {
    const body = await req.json();
    const raw = String(body?.identifier || "").trim();
    const clean = raw.replace(/^@/, "").toLowerCase();
    const password = String(body?.password || "");
    if (!raw || raw.length > 100 || !password || password.length > 256) {
      return json({ error: "Enter a valid username or display name and password." }, 400);
    }

    const url = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !anonKey || !serviceKey) {
      console.error("Missing Supabase function environment variables.");
      return json({ error: "The sign-in function is missing server configuration." }, 500);
    }

    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let userId: string | null = null;

    // First try the unique username index.
    if (/^[a-z0-9_]{3,24}$/.test(clean)) {
      const { data, error } = await admin
        .from("newflix_username_index")
        .select("user_id")
        .eq("username", clean)
        .maybeSingle();
      if (error) {
        console.error("Username index lookup failed:", error.message);
        return json({ error: "Username index is not ready. Run the latest database migration." }, 503);
      }
      userId = data?.user_id || null;
    }

    // Then try an exact case-insensitive display-name match.
    if (!userId) {
      // Escape LIKE metacharacters so the lookup remains an exact match.
      const escaped = raw.replace(/[\\%_]/g, "\\$&");
      const { data, error } = await admin
        .from("profiles")
        .select("id")
        .ilike("display_name", escaped)
        .limit(2);
      if (error) {
        console.error("Display name lookup failed:", error.message);
        return json({ error: "Display-name lookup failed. Check the latest database migration." }, 503);
      }
      if (!data?.length) return json({ error: "No account matches that username or display name." }, 404);
      if (data.length > 1) return json({ error: "That display name belongs to more than one account. Use your unique username or email." }, 409);
      userId = data[0].id;
    }

    const { data: accountData, error: accountError } = await admin.auth.admin.getUserById(userId);
    const email = accountData?.user?.email;
    if (accountError || !email) {
      console.error("Auth account lookup failed:", accountError?.message);
      return json({ error: "The account could not be resolved. Use your email or contact support." }, 404);
    }

    // Password verification and session issuance are always handled by Supabase Auth.
    const authClient = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: signedIn, error: authError } = await authClient.auth.signInWithPassword({
      email,
      password,
    });
    if (authError || !signedIn.session) return json({ error: "Incorrect password." }, 401);

    return json({ session: signedIn.session, user: signedIn.user });
  } catch (error) {
    console.error("username-login function crashed:", error);
    return json({ error: "Unexpected error in the sign-in function." }, 500);
  }
});
