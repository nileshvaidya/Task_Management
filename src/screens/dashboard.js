// Placeholder for Phase 0/1. Full Dashboard (Plan Today, Active Tasks,
// Weekly Progress, Advance Planning) is built in Phase 2.
import { getCurrentProfile } from '../auth.js';
import { renderIdentityBlock } from '../components.js';

export async function render(container) {
  container.innerHTML = `
    <div class="min-h-screen p-8" data-screen="dashboard">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <h1 class="text-2xl font-heading">Dashboard</h1>
        <div data-role="identity-mount"></div>
      </div>
      <p class="text-neutral-400">Built in Phase 2.</p>
    </div>
  `;

  const profile = await getCurrentProfile();
  if (profile) {
    container.querySelector('[data-role="identity-mount"]').appendChild(renderIdentityBlock(profile));
  }
}
