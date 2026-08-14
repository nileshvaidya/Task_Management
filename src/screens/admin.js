// Placeholder body content for Phase 0/1/2. Full User Admin screen (User
// Management, Global Task Control) is built in Phase 4.
import { getCurrentProfile } from '../auth.js';
import { renderShell } from '../layout.js';

export async function render(container) {
  const user = await getCurrentProfile();
  if (!user) {
    window.location.hash = '#/login';
    return;
  }
  const content = renderShell(container, { activeRoute: '/admin', user });
  content.innerHTML = `
    <div data-screen="admin">
      <h1 class="text-2xl font-heading mb-2">User Admin</h1>
      <p class="text-neutral-400">Built in Phase 4.</p>
    </div>
  `;
}
