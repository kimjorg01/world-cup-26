// ============================================================
//  SUPABASE CONFIG
// ------------------------------------------------------------
//  Fill these in after creating your free Supabase project
//  (Supabase dashboard -> Project Settings -> API).
//
//  BOTH values are safe to commit and ship to the browser:
//   - The "anon public" key is a *public* client key by design.
//   - Your data is protected by Row Level Security (see SETUP.md),
//     NOT by hiding this key.
//
//  Leave both blank to run the app fully locally (localStorage
//  only, no login) exactly like before — handy for development.
// ============================================================
window.SUPABASE_CONFIG = {
  url: "https://sceaunxpuccwcdzohpza.supabase.co",      // e.g. "https://abcdefghijklmno.supabase.co"
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjZWF1bnhwdWNjd2Nkem9ocHphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2NzcyOTcsImV4cCI6MjA5NzI1MzI5N30.zhBDE_LHEu0H9fHT9fMsbzJt_Zvw6livfFhAt0AagVo",  // the long "anon public" key
};
