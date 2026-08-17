// Phase 6 — PWA install prompt capture. beforeinstallprompt isn't a
// jsdom-native event type, so it's dispatched here as a plain Event with
// preventDefault/prompt/userChoice attached directly, matching the shape
// the real browser event has.
import { describe, it, expect, beforeEach } from 'vitest';
import { installState, promptInstall } from './pwaInstall.js';

function dispatchBeforeInstallPrompt({ outcome = 'accepted' } = {}) {
  const event = new Event('beforeinstallprompt', { cancelable: true });
  /** @type {any} */ (event).prompt = () => {};
  /** @type {any} */ (event).userChoice = Promise.resolve({ outcome });
  window.dispatchEvent(event);
  return event;
}

describe('pwaInstall', () => {
  beforeEach(async () => {
    // Reset the module's captured-event availability between tests by
    // consuming any leftover deferred prompt from a prior test.
    await promptInstall();
    installState.setState({ available: false });
  });

  it('captures beforeinstallprompt, prevents the default mini-infobar, and marks the prompt available', () => {
    const event = dispatchBeforeInstallPrompt();
    expect(event.defaultPrevented).toBe(true);
    expect(installState.getState().available).toBe(true);
  });

  it('promptInstall() triggers the captured prompt and resolves with the outcome, then clears availability', async () => {
    dispatchBeforeInstallPrompt({ outcome: 'accepted' });
    const outcome = await promptInstall();
    expect(outcome).toBe('accepted');
    expect(installState.getState().available).toBe(false);
  });

  it('promptInstall() returns null when no prompt has been captured', async () => {
    const outcome = await promptInstall();
    expect(outcome).toBeNull();
  });

  it('appinstalled clears availability even without promptInstall() being called', () => {
    dispatchBeforeInstallPrompt();
    expect(installState.getState().available).toBe(true);
    window.dispatchEvent(new Event('appinstalled'));
    expect(installState.getState().available).toBe(false);
  });
});
