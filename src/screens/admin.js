// Placeholder for Phase 0/1. Full User Admin screen (User Management,
// Global Task Control) is built in Phase 4.
import { getCurrentProfile } from '../auth.js';
import { renderIdentityBlock } from '../components.js';

export async function render(container) {
  container.innerHTML = `
    <div class="min-h-screen p-8" data-screen="admin">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <h1 class="text-2xl font-heading">User Admin</h1>
        <div data-role="identity-mount"></div>
      </div>
      <p class="text-neutral-400">Built in Phase 4.</p>
    </div>
  `;

  const profile = await getCurrentProfile();
  if (profile) {
    container.querySelector('[data-role="identity-mount"]').appendChild(renderIdentityBlock(profile));
  }
}
