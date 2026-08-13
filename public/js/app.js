// Wires up app.html: auth guard, task list rendering, filtering, and CRUD.
(function () {
  const userEmailEl = document.getElementById("user-email");
  const logoutBtn = document.getElementById("logout-btn");
  const errorEl = document.getElementById("app-error");
  const newTaskForm = document.getElementById("new-task-form");
  const taskList = document.getElementById("task-list");
  const emptyState = document.getElementById("empty-state");
  const template = document.getElementById("task-item-template");
  const filterBtns = Array.from(document.querySelectorAll(".filter-btn"));

  let tasks = [];
  let currentFilter = "all";

  function showError(message) {
    errorEl.textContent = message;
    errorEl.classList.remove("hidden");
  }

  function clearError() {
    errorEl.classList.add("hidden");
  }

  function setFilter(filter) {
    currentFilter = filter;
    filterBtns.forEach((btn) => {
      const active = btn.dataset.filter === filter;
      btn.classList.toggle("bg-slate-900", active);
      btn.classList.toggle("text-white", active);
      btn.classList.toggle("text-slate-600", !active);
      btn.setAttribute("aria-selected", String(active));
    });
    render();
  }

  function render() {
    const visible =
      currentFilter === "all" ? tasks : tasks.filter((t) => t.status === currentFilter);

    taskList.innerHTML = "";
    emptyState.classList.toggle("hidden", visible.length > 0);

    for (const task of visible) {
      const node = template.content.cloneNode(true);
      const li = node.querySelector(".task-item");
      li.dataset.id = task.id;

      const checkbox = node.querySelector(".task-toggle");
      checkbox.checked = task.status === "completed";

      const titleEl = node.querySelector(".task-title");
      titleEl.textContent = task.title;
      titleEl.classList.toggle("line-through", task.status === "completed");
      titleEl.classList.toggle("text-slate-400", task.status === "completed");

      const descEl = node.querySelector(".task-description");
      if (task.description) {
        descEl.textContent = task.description;
      } else {
        descEl.remove();
      }

      taskList.appendChild(node);
    }
  }

  async function loadTasks() {
    clearError();
    try {
      tasks = await window.TasksAPI.fetchAll();
      render();
    } catch (err) {
      showError(err.message || "Failed to load tasks.");
    }
  }

  newTaskForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearError();
    const titleInput = document.getElementById("task-title");
    const descriptionInput = document.getElementById("task-description");
    const title = titleInput.value.trim();
    if (!title) return;

    try {
      const created = await window.TasksAPI.create({
        title,
        description: descriptionInput.value.trim(),
      });
      tasks.unshift(created);
      titleInput.value = "";
      descriptionInput.value = "";
      render();
    } catch (err) {
      showError(err.message || "Failed to add task.");
    }
  });

  taskList.addEventListener("change", async (event) => {
    if (!event.target.classList.contains("task-toggle")) return;
    const li = event.target.closest(".task-item");
    const id = li.dataset.id;
    const task = tasks.find((t) => String(t.id) === id);
    if (!task) return;

    const newStatus = event.target.checked ? "completed" : "pending";
    const previousStatus = task.status;
    task.status = newStatus;
    clearError();
    try {
      await window.TasksAPI.setStatus(id, newStatus);
      render();
    } catch (err) {
      task.status = previousStatus;
      event.target.checked = previousStatus === "completed";
      showError(err.message || "Failed to update task.");
    }
  });

  taskList.addEventListener("click", async (event) => {
    if (!event.target.classList.contains("task-delete")) return;
    const li = event.target.closest(".task-item");
    const id = li.dataset.id;

    clearError();
    try {
      await window.TasksAPI.remove(id);
      tasks = tasks.filter((t) => String(t.id) !== id);
      render();
    } catch (err) {
      showError(err.message || "Failed to delete task.");
    }
  });

  filterBtns.forEach((btn) => {
    btn.addEventListener("click", () => setFilter(btn.dataset.filter));
  });

  logoutBtn.addEventListener("click", async () => {
    await window.sb.auth.signOut();
    window.location.href = "/index.html";
  });

  (async function init() {
    const { data } = await window.sb.auth.getSession();
    if (!data.session) {
      window.location.href = "/index.html";
      return;
    }
    userEmailEl.textContent = data.session.user.email;
    await loadTasks();
  })();
})();
