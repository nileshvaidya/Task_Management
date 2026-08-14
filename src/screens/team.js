// Placeholder body content for Phase 0/1/2. Full Team screen (Activity
// Feed + Team Overview) is built in Phase 3.
import { getCurrentProfile } from '../auth.js';
import { renderShell } from '../layout.js';

export async function render(container) {
  const user = await getCurrentProfile();
  if (!user) {
    window.location.hash = '#/login';
    return;
  }
  const content = renderShell(container, { activeRoute: '/team', user });
  content.innerHTML = `
    <div data-screen="team">
      <h1 class="text-2xl font-heading mb-2">Team</h1>
      <p class="text-neutral-400">Built in Phase 3.</p>
    </div>
  `;
}
