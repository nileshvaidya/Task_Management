// Creates the shared Supabase client from config injected at build time
// (see scripts/generate-config.js). Exposed as window.sb so other page
// scripts can use it without a bundler/import system.
(function () {
  if (!window.SUPABASE_CONFIG || !window.SUPABASE_CONFIG.url || !window.SUPABASE_CONFIG.anonKey) {
    console.error(
      "Missing Supabase config. Run `npm run build` with SUPABASE_URL and SUPABASE_ANON_KEY set " +
        "(see .env.example) before serving public/."
    );
    return;
  }

  window.sb = window.supabase.createClient(
    window.SUPABASE_CONFIG.url,
    window.SUPABASE_CONFIG.anonKey
  );
})();
