// Auth logic for index.html: sign in, sign up, and redirecting an
// already-authenticated user straight to the app.
(function () {
  const signinTab = document.getElementById("tab-signin");
  const signupTab = document.getElementById("tab-signup");
  const signinForm = document.getElementById("signin-form");
  const signupForm = document.getElementById("signup-form");
  const errorEl = document.getElementById("auth-error");
  const noticeEl = document.getElementById("auth-notice");

  function showError(message) {
    noticeEl.classList.add("hidden");
    errorEl.textContent = message;
    errorEl.classList.remove("hidden");
  }

  function showNotice(message) {
    errorEl.classList.add("hidden");
    noticeEl.textContent = message;
    noticeEl.classList.remove("hidden");
  }

  function clearMessages() {
    errorEl.classList.add("hidden");
    noticeEl.classList.add("hidden");
  }

  function setTab(target) {
    clearMessages();
    const showSignin = target === "signin";
    signinForm.classList.toggle("hidden", !showSignin);
    signupForm.classList.toggle("hidden", showSignin);
    signinTab.classList.toggle("bg-white", showSignin);
    signinTab.classList.toggle("shadow-sm", showSignin);
    signinTab.classList.toggle("text-slate-900", showSignin);
    signinTab.classList.toggle("text-slate-500", !showSignin);
    signinTab.setAttribute("aria-selected", String(showSignin));
    signupTab.classList.toggle("bg-white", !showSignin);
    signupTab.classList.toggle("shadow-sm", !showSignin);
    signupTab.classList.toggle("text-slate-900", !showSignin);
    signupTab.classList.toggle("text-slate-500", showSignin);
    signupTab.setAttribute("aria-selected", String(!showSignin));
  }

  signinTab.addEventListener("click", () => setTab("signin"));
  signupTab.addEventListener("click", () => setTab("signup"));

  signinForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearMessages();
    const email = document.getElementById("signin-email").value.trim();
    const password = document.getElementById("signin-password").value;

    const { error } = await window.sb.auth.signInWithPassword({ email, password });
    if (error) {
      showError(error.message);
      return;
    }
    window.location.href = "/app.html";
  });

  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearMessages();
    const email = document.getElementById("signup-email").value.trim();
    const password = document.getElementById("signup-password").value;

    const { data, error } = await window.sb.auth.signUp({ email, password });
    if (error) {
      showError(error.message);
      return;
    }
    if (data.session) {
      window.location.href = "/app.html";
      return;
    }
    showNotice("Account created. Check your email to confirm before signing in.");
    setTab("signin");
  });

  (async function redirectIfSignedIn() {
    const { data } = await window.sb.auth.getSession();
    if (data.session) {
      window.location.href = "/app.html";
    }
  })();
})();
