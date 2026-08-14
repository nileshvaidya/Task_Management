// Placeholder for Phase 0 — proves routing + the Nocturne theme render
// correctly. Real Supabase email/password sign-in/sign-up forms land in
// Phase 1.
export function render(container) {
  container.innerHTML = `
    <div class="min-h-screen flex items-center justify-center p-4" data-screen="login">
      <div class="card elev-md" style="width:min(360px,100%)">
        <div class="card-kicker">WorkSync</div>
        <h1 class="card-title" style="font-size:22px">Sign in</h1>
        <p class="card-body">
          Authentication arrives in Phase 1. This placeholder confirms the
          router and the Nocturne theme are wired correctly.
        </p>
        <button type="button" class="btn btn-primary btn-block" disabled>
          Sign in (coming in Phase 1)
        </button>
      </div>
    </div>
  `;
}
