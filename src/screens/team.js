// Placeholder for Phase 0/1. Full Team screen (Activity Feed + Team
// Overview) is built in Phase 3.
import { getCurrentProfile } from '../auth.js';
import { renderIdentityBlock } from '../components.js';

export async function render(container) {
  container.innerHTML = `
    <div class="min-h-screen p-8" data-screen="team">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <h1 class="text-2xl font-heading">Team</h1>
        <div data-role="identity-mount"></div>
      </div>
      <p class="text-neutral-400">Built in Phase 3.</p>
    </div>
  `;

  const profile = await getCurrentProfile();
  if (profile) {
    container.querySelector('[data-role="identity-mount"]').appendChild(renderIdentityBlock(profile));
  }
}
