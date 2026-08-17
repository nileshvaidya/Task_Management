// Captures the browser's `beforeinstallprompt` event (Phase 6) so the app
// can offer its own "Install App" button instead of relying solely on
// the browser's own inconsistent/easy-to-miss built-in UI. Must be
// imported once, early (main.js) — before any screen renders — since a
// missed event (no listener attached yet) is gone for good.
import { createStore } from './state.js';

export const installState = createStore({ available: false });

let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredPrompt = event;
  installState.setState({ available: true });
});

// Covers both "installed via our button" and "installed via the browser's
// own UI/address-bar icon" — either way, stop offering to install again.
window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  installState.setState({ available: false });
});

/**
 * Triggers the captured install prompt. Resolves with the browser's
 * outcome ('accepted'|'dismissed'), or null if no prompt is currently
 * available (already installed, browser doesn't support it, or the event
 * hasn't fired yet).
 */
export async function promptInstall() {
  if (!deferredPrompt) return null;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
  installState.setState({ available: false });
  return outcome;
}
