// ============================================================
//  WCSync — shared live state + magic-link auth via Supabase
// ------------------------------------------------------------
//  The whole app STATE object is stored as one JSONB blob in a
//  single `app_state` row. Admins (listed in the `admins` table)
//  may write it; any signed-in user may read it. Everyone gets
//  realtime updates so viewers see admin edits live.
//
//  If supabase-config.js is left blank, `WCSync.enabled` is false
//  and the app runs in pure-localStorage mode (no login).
// ============================================================
(function () {
  const cfg = window.SUPABASE_CONFIG || {};
  const hasLib = !!(window.supabase && window.supabase.createClient);

  // Local development bypass: when served from localhost, run in pure local
  // (localStorage) mode with no login gate, so you can test the UI without the
  // magic link (which redirects to the deployed site). Force online testing
  // locally by adding ?online=1 to the URL.
  const host = location.hostname;
  const isLocalhost = host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host === "";
  const forceOnline = /[?&]online=1\b/.test(location.search);

  const enabled = !!(cfg.url && cfg.anonKey && hasLib) && (!isLocalhost || forceOnline);
  if (isLocalhost && !forceOnline && cfg.url) {
    console.info("[WCSync] localhost detected — running in local mode (no login). Add ?online=1 to test the live sync flow.");
  }

  const STATE_ROW_ID = 1;

  let client = null;
  let session = null;
  let adminEmails = new Set();
  let remoteCb = null;
  let authCb = null;
  let started = false;

  if (enabled) {
    client = window.supabase.createClient(cfg.url, cfg.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  } else if ((cfg.url || cfg.anonKey) && !hasLib && !isLocalhost) {
    console.warn("[WCSync] Supabase config present but the supabase-js library failed to load; running local-only.");
  }

  function currentEmail() {
    const e = session && session.user && session.user.email;
    return e ? e.toLowerCase() : null;
  }

  async function fetchAdmins() {
    if (!client || !session) { adminEmails = new Set(); return; }
    const { data, error } = await client.from("admins").select("email");
    if (error) { console.warn("[WCSync] admins lookup failed", error.message); return; }
    adminEmails = new Set((data || []).map(r => (r.email || "").toLowerCase()));
  }

  async function fetchState() {
    if (!client) return null;
    const { data, error } = await client
      .from("app_state")
      .select("data")
      .eq("id", STATE_ROW_ID)
      .maybeSingle();
    if (error) { console.warn("[WCSync] fetchState failed", error.message); return null; }
    return data ? data.data : null;
  }

  function subscribeRealtime() {
    if (!client) return;
    client
      .channel("app_state_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "app_state" },
        (payload) => {
          const row = payload.new || payload.record;
          if (row && row.data && remoteCb) remoteCb(row.data);
        }
      )
      .subscribe();
  }

  const WCSync = {
    enabled,

    isAuthed() { return !!session; },
    getEmail() { return (session && session.user && session.user.email) || null; },
    isAdmin() {
      const e = currentEmail();
      return !!e && adminEmails.has(e);
    },

    // Register callbacks (call before start()).
    onRemoteState(cb) { remoteCb = cb; },
    onAuthChange(cb) { authCb = cb; },

    async signInWithEmail(email) {
      if (!client) throw new Error("Online sync is not configured.");
      const redirectTo = window.location.origin + window.location.pathname;
      const { error } = await client.auth.signInWithOtp({
        email: email,
        options: { emailRedirectTo: redirectTo },
      });
      if (error) throw error;
    },

    async signOut() {
      if (client) await client.auth.signOut();
    },

    async pushState(state) {
      // RLS is the real guard; this client-side check just avoids a doomed request.
      if (!client || !this.isAdmin()) return;
      const { error } = await client
        .from("app_state")
        .upsert({ id: STATE_ROW_ID, data: state, updated_at: new Date().toISOString() });
      if (error) console.warn("[WCSync] pushState failed", error.message);
    },

    fetchState,

    async start() {
      if (!enabled || started) return;
      started = true;

      const { data } = await client.auth.getSession();
      session = data ? data.session : null;
      if (session) await fetchAdmins();

      client.auth.onAuthStateChange(async (_event, newSession) => {
        session = newSession;
        await fetchAdmins();
        if (authCb) authCb();
      });

      subscribeRealtime();
      if (authCb) authCb();
    },
  };

  window.WCSync = WCSync;
})();
