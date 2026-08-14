// Sign-in / sign-up. Real Supabase Auth flow — see src/auth.js for the
// logic; this module is DOM wiring only.
import { signIn, signUp, fetchActiveManagers, getSessionUser } from '../auth.js';
import { escapeHtml } from '../components.js';

export async function render(container) {
  const alreadySignedIn = await getSessionUser();
  if (alreadySignedIn) {
    window.location.hash = '#/dashboard';
    return;
  }

  container.innerHTML = `
    <div class="min-h-screen flex items-center justify-center p-4" data-screen="login">
      <div class="card elev-md" style="width:min(400px,100%)">
        <div class="card-kicker">WorkSync</div>

        <div class="seg" role="radiogroup" aria-label="Sign in or sign up" style="margin-bottom:16px">
          <label class="seg-opt"><input type="radio" name="auth-tab" value="signin" checked />Sign In</label>
          <label class="seg-opt"><input type="radio" name="auth-tab" value="signup" />Sign Up</label>
        </div>

        <p data-role="error" class="hidden" style="font-size:13px;color:var(--color-accent-2-200);background:var(--color-accent-2-900);border:1px solid var(--color-accent-2-700);border-radius:var(--radius-md);padding:8px 12px;margin-bottom:14px"></p>
        <p data-role="notice" class="hidden" style="font-size:13px;color:var(--color-accent-100);background:var(--color-accent-900);border:1px solid var(--color-accent-700);border-radius:var(--radius-md);padding:8px 12px;margin-bottom:14px"></p>

        <form data-form="signin" class="space-y-3">
          <div class="field"><label for="signin-email">Email</label>
            <input class="input" id="signin-email" name="email" type="email" required autocomplete="email" />
          </div>
          <div class="field"><label for="signin-password">Password</label>
            <input class="input" id="signin-password" name="password" type="password" required autocomplete="current-password" />
          </div>
          <button type="submit" class="btn btn-primary btn-block">Sign In</button>
        </form>

        <form data-form="signup" class="hidden space-y-3">
          <div class="field"><label for="signup-name">Name</label>
            <input class="input" id="signup-name" name="name" type="text" required autocomplete="name" />
          </div>
          <div class="field"><label for="signup-email">Email</label>
            <input class="input" id="signup-email" name="email" type="email" required autocomplete="email" />
          </div>
          <div class="field"><label for="signup-password">Password</label>
            <input class="input" id="signup-password" name="password" type="password" required minlength="6" autocomplete="new-password" />
          </div>
          <div class="field"><label for="signup-role">Role</label>
            <!-- No native "required" here: rejection is enforced by
                 validateSignupForm and surfaced via the custom error
                 banner above, not a browser validation bubble. -->
            <select class="input" id="signup-role" name="role">
              <option value="">Select a role…</option>
              <option value="manager">Manager</option>
              <option value="employee">Employee</option>
            </select>
          </div>
          <div class="field hidden" data-role="manager-field"><label for="signup-manager">Reports to</label>
            <select class="input" id="signup-manager" name="managerId">
              <option value="">Select your manager…</option>
            </select>
          </div>
          <button type="submit" class="btn btn-primary btn-block">Create Account</button>
        </form>
      </div>
    </div>
  `;

  const errorEl = container.querySelector('[data-role="error"]');
  const noticeEl = container.querySelector('[data-role="notice"]');
  const signinForm = container.querySelector('[data-form="signin"]');
  const signupForm = container.querySelector('[data-form="signup"]');
  const roleSelect = container.querySelector('#signup-role');
  const managerField = container.querySelector('[data-role="manager-field"]');

  function showError(message) {
    noticeEl.classList.add('hidden');
    errorEl.textContent = message;
    errorEl.classList.remove('hidden');
  }

  function clearMessages() {
    errorEl.classList.add('hidden');
    noticeEl.classList.add('hidden');
  }

  container.querySelectorAll('input[name="auth-tab"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      clearMessages();
      const isSignin = radio.value === 'signin' && radio.checked;
      if (radio.checked) {
        signinForm.classList.toggle('hidden', radio.value !== 'signin');
        signupForm.classList.toggle('hidden', radio.value !== 'signup');
      }
      void isSignin;
    });
  });

  roleSelect.addEventListener('change', () => {
    managerField.classList.toggle('hidden', roleSelect.value !== 'employee');
  });

  signinForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearMessages();
    const { error } = await signIn({
      email: container.querySelector('#signin-email').value.trim(),
      password: container.querySelector('#signin-password').value,
    });
    if (error) {
      showError(error.message);
      return;
    }
    window.location.hash = '#/dashboard';
  });

  signupForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearMessages();
    const { error } = await signUp({
      name: container.querySelector('#signup-name').value.trim(),
      email: container.querySelector('#signup-email').value.trim(),
      password: container.querySelector('#signup-password').value,
      role: roleSelect.value,
      managerId: container.querySelector('#signup-manager').value,
    });
    if (error) {
      showError(error.message);
      return;
    }
    window.location.hash = '#/dashboard';
  });

  // Populate the manager picker in the background — never block the form
  // itself on this, and never touch the DOM if the screen was already
  // navigated away from by the time it resolves.
  fetchActiveManagers()
    .then((managers) => {
      const managerSelect = container.querySelector('#signup-manager');
      if (!managerSelect) return;
      managerSelect.insertAdjacentHTML(
        'beforeend',
        managers.map((m) => `<option value="${escapeHtml(m.id)}">${escapeHtml(m.name)}</option>`).join('')
      );
    })
    .catch(() => {
      // Network/config failure while backfilling the picker — the form
      // itself already rendered and works; nothing more to do here.
    });
}
