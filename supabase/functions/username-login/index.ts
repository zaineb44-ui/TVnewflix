// Deploy with: supabase functions deploy username-login
// Resolves a unique username or display name server-side; never exposes account emails.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
    const { identifier, password } = await req.json();
    const raw = String(identifier || "").trim();
    const clean = raw.replace(/^@/, "").toLowerCase();
    const pass = String(password || "");
    if (!raw || raw.length > 100 || !pass) {
      return json({ error: "Enter a valid username/display name and password." }, 400);
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!url || !anonKey || !serviceKey) {
      console.error("Username login function is missing Supabase environment variables.");
      return json({ error: "Sign-in service is not configured on the server." }, 500);
    }

    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let userId: string | null = null;

    // Username lookup is exact and takes precedence over display-name matching.
    if (/^[a-z0-9_]{3,24}$/.test(clean)) {
      const { data: usernameRow, error: usernameError } = await admin
        .from("newflix_username_index")
        .select("user_id")
        .eq("username", clean)
        .maybeSingle();
      if (usernameError) {
        console.error("Username lookup failed:", usernameError.message);
        return json({ error: "Sign-in index is unavailable. Run the database migration." }, 503);
      }
      userId = usernameRow?.user_id || null;
    }

    // If no username matched, look for an exact case-insensitive display name.
    if (!userId) {
      const { data: matches, error: displayError } = await admin
        .from("profiles")
        .select("id")
        .ilike("display_name", raw.replace(/[\\%_]/g, "\\$&"))
        .limit(2);
      if (displayError) {
        console.error("Display-name lookup failed:", displayError.message);
        return json({ error: "Display-name lookup is unavailable. Run the database migration." }, 503);
      }
      if (!matches || matches.length === 0) return json({ error: "Account not found." }, 404);
      if (matches.length > 1) return json({ error: "Display name is not unique." }, 409);
      userId = matches[0].id;
    }

    const { data: account, error: accountError } = await admin.auth.admin.getUserById(userId);
    if (accountError || !account.user?.email) {
      console.error("Could not resolve auth account:", accountError?.message);
      return json({ error: "Account not found." }, 404);
    }

    const publicClient = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: signedIn, error: signInError } = await publicClient.auth.signInWithPassword({
      email: account.user.email,
      password: pass,
    });
    if (signInError || !signedIn.session) return json({ error: "Incorrect password." }, 401);

    return json({ session: signedIn.session, user: signedIn.user });
  } catch (error) {
    console.error("identifier-login error:", error);
    return json({ error: "Unexpected sign-in error." }, 500);
  }
});
