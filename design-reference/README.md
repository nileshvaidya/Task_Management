# Handoff: WorkSync Task Tracker

## Overview
A clickable prototype for a task-management app (WorkSync) covering an employee/manager dashboard, a team activity feed + team overview, an admin/user-management console, and a "New Task" creation flow that supports scheduling, priority, assignment, and task dependencies (with a resulting "Blocked" task state).

## About the Design Files
The bundled file (`Task Tracker.dc.html`) is a **design reference built in HTML** — a working prototype showing intended look, layout, and interaction behavior. It is not production code to copy directly. The task is to **recreate this design in the target codebase's existing environment** (React, Vue, native, etc.) using its established component library and patterns — or, if no such environment exists yet, to choose the most appropriate framework and implement the designs there. Open the HTML file directly in a browser to click through the live prototype; view source for exact markup/structure reference.

## Fidelity
**High-fidelity.** Colors, typography, spacing, and component styling are final (drawn from the bound "Nocturne" design system's token sheet — see Design Tokens below). Recreate pixel-perfectly using the codebase's existing libraries wherever equivalents exist.

## Screens / Views

### 1. Dashboard (home)
- **Purpose**: Daily landing page — greet the user, quick-add a task, show active tasks, weekly progress, and a mini calendar.
- **Layout (desktop)**: Fixed 240px left sidebar + fluid main content. Main content: `grid-template-columns: minmax(0,1fr) 320px; gap: 24px`. Left column stacks "Plan Today" quick-add card and "Active Tasks" card. Right column stacks a "Weekly Progress" accent card and an "Advance Planning" mini calendar card.
- **Layout (mobile)**: Single column, top bar (brand + role/device switch + avatar) + bottom 3-tab bar (Dashboard/Team/Admin). Two stat cards (Tasks Left, High Priority) in a 2-col grid, an "Up Next" hero card for the top active task, a "Today's Queue" list, and a floating "+" action button (bottom-right, 52px circle) that opens New Task.
- **Components**:
  - Sidebar: brand mark + "WorkSync" wordmark, "+ New Task" primary block button, 3 nav items (Dashboard/Team Feed/User Admin — active item gets accent-800 background + 2px accent left border), a "View as" Employee/Manager segmented switch, a Desktop/Mobile segmented switch, and a user identity row (avatar initials, name, email) pinned to the bottom.
  - "Plan Today" card: icon + title + date tag, text input + "Add" primary button (adds a task on submit).
  - "Active Tasks" card: All/Pending segmented filter; each task row = circular toggle checkbox, title (strikethrough + muted when completed), meta line, optional "Waiting on: …" blocked line (accent-2 color, warning icon), a status `<select>` (Planned/In-Progress/Completed), and a status tag (Planned = neutral tag, In-Progress = outline tag, Completed = accent tag, Blocked = outline tag reading "Blocked"). Row uses `flex-wrap: wrap` with the status controls at `margin-left:auto` so they wrap under the text on narrow widths rather than overlapping.
  - "Weekly Progress" card: gradient background (`linear-gradient(160deg, accent-800, accent-900)`), big number "24 / 30 Tasks", thin progress bar.
  - "Advance Planning" card: month label + prev/next icon buttons, 7-col day-of-week header, 7-col date grid (today = solid accent circle/cell), "Open Full Calendar" secondary block button.

### 2. Team (Team Feed / Team Overview)
- **Purpose**: See cross-team activity and, in Overview, per-person focus + blockers.
- **Layout (desktop)**: Header with title + segmented "Activity Feed / Team Overview" tab switch.
  - Feed tab: `grid-template-columns: 1fr 300px`. Left: activity cards (avatar initials, "who / verb / where", detail text, status tag). Right: "Sprint Progress" card with 3 labeled progress bars (Engineering/Design/Marketing, each own accent color).
  - Overview tab: 2-col row of "Team Pulse" (big % + progress bar + active/completed counts) and "Blockers & Alerts" (list of title + detail); below, an auto-fit grid (`minmax(240px,1fr)`) of per-member cards (avatar, name, role, online/offline tag, "Today's Focus" checklist with strikethrough for done items).
- **Layout (mobile)**: Single column — Sprint Progress bars first, then activity cards stacked.

### 3. Admin / User Management
- **Purpose**: Manage users and see a global task table.
- **Layout (desktop)**: Header + "+ New Task" button. "User Management" card: search input + "Add User" button, then a `.table` (User [avatar+name+email] / Role / Status tag / Last Active / Actions [edit, toggle-active, delete icon buttons]). Below: "Global Task Control" card with a `.table` (Task / Owner / Status tag / "OVERRIDE" link action).
- **Layout (mobile)**: Users and global tasks each render as a stacked list of cards rather than a table.

### 4. New Task dialog (with dependencies)
- **Purpose**: Create a task for today or a future date; manager can assign to self or a direct report; anyone can attach a dependency task assigned to another user, which can mark the new task as Blocked.
- **Layout**: Centered modal (`.dialog-backdrop` + `.dialog`, max-width 600px, scrollable). Header: title + subtitle + close (X) icon button.
- **Fields, in order**: Project select + "+ New" button (creates and selects a new project) → Task Title input → Description textarea (3 rows) → 2-col row: Date (native date input, defaults to today, any future date allowed) + Estimated Time (number, step 0.5) → Assign To select (Manager role: self + direct reports; Employee role: locked to self) → Priority Level: 4 equal-width buttons (Low/Medium/High/Critical), selected state = accent border + accent-tinted background.
- **Dependencies section**: divider, "Task Dependencies & Assignment" label + description, a "Has Dependency" toggle switch. When on: a "Search existing tasks…" input, then a sub-card with "New Dependency Title" input, "Assign To" select (all other users), and a "Requires acceptance by assignee" checkbox. If both a dependency is present and "requires acceptance" is checked, the created task is saved as **Blocked**, with the blocked reason set to the dependency assignee's name + dependency title.
- **Footer**: Cancel (secondary) / Create Task (primary).

## Interactions & Behavior
- Sidebar nav / mobile bottom-tabs switch the `screen` state (dashboard/team/admin) — no page reload.
- "View as" switch toggles the acting user between the Manager (Sarah Jenkins) and an Employee (David Chen) — changes which tasks show on the dashboard, whether "Assign To" is editable in New Task, and the Admin New-Task button visibility logic.
- Desktop/Mobile switch toggles between the two layouts (there is no CSS breakpoint — this is a state-driven view switch for demoing both breakpoints in one file; a real responsive app should use actual CSS breakpoints instead).
- Clicking a task's round checkbox toggles Completed ⇄ Planned; the status `<select>` sets Planned/In-Progress/Completed directly (setting Completed clears any Blocked flag).
- Quick-add ("Plan Today") and "Create Task" both prepend a new task to the task list and clear their inputs.
- Admin table row actions: the toggle icon flips a user's Active/Inactive status; the trash icon removes the user; "Add User" appends a stub user row.
- Calendar prev/next (‹ ›) change the displayed month/year; today's cell is highlighted solid accent.
- No animations beyond native browser transitions; no loading or error states are modeled (all data is local mock state).

## State Management
Local component state (no backend):
- `device`: 'desktop' | 'mobile'
- `role`: 'manager' | 'employee' (drives `currentUser`)
- `screen`: 'dashboard' | 'team' | 'admin'
- `teamTab`: 'feed' | 'overview'
- `taskFilter`: 'all' | 'pending'
- `users[]`: {id, name, email, role, status, lastActive, managerId?}
- `tasks[]`: {id, title, desc, meta, status: 'planned'|'in-progress'|'completed', priority: 'low'|'medium'|'high'|'critical', ownerId, blocked, blockedReason}
- `projects[]`: string list
- `newTaskOpen`: boolean
- `form`: {project, title, desc, date, time, assignTo, priority, hasDependency, depSearch, depTitle, depAssignee, requiresAcceptance}
- `calMonth` / `calYear`, `searchAdmin`, `quickAdd`

A production build should replace this with real API calls (fetch users/tasks, create/update task, create/update user) but the shape above is a reasonable data contract to start from.

## Design Tokens
From the bound Nocturne design system (`_ds/nocturne-.../styles.css`):
- **Background**: `--color-bg #161826`
- **Surface**: `--color-surface #232532`
- **Text**: `--color-text #e9e9ed`
- **Accent (primary)**: `--color-accent #9184d9` — tonal ramp `--color-accent-100…900` (`#f5f4ff` → `#2b2741`)
- **Accent-2** (used for warnings/blocked/priority accents in this design): ramp `--color-accent-2-100…900` (`#f5f4ff` → `#2b293a`)
- **Neutrals**: `--color-neutral-100…900` (`#f3f5fe` → `#292b31`)
- **Divider**: `--color-divider` = `color-mix(in srgb, #e9e9ed 16%, transparent)`
- **Font**: Inter for heading and body — `--font-heading` / `--font-body`, heading weight 500
- **Radius**: `--radius-sm 4px`, `--radius-md 8px`, `--radius-lg 14px`
- **Spacing scale**: `--space-1 2.8px` … `--space-8 22.4px` (0.7× density scale)
- **Shadows**: `--shadow-sm/md/lg` — hairline ring + ambient dark blur, tuned for the dark ground
- **Components used**: `.btn` (`.btn-primary` outlined accent, `.btn-secondary`, `.btn-ghost`, `.btn-icon`, `.btn-block`), `.tag` (`.tag-accent`, `.tag-accent-2`, `.tag-neutral`, `.tag-outline`), `.field`/`.input`, `.card` (`.card-kicker`/`.card-title`/`.card-body`/`.card-meta`, `.elev-sm/md/lg`), `.table`, `.dialog-backdrop`/`.dialog` (`.dialog-title`/`.dialog-body`/`.dialog-actions`). Full source and every token/class is documented in the design system's `readme.md`, `styles.css`, and `components/*.html` pages included alongside this prototype.

## Assets
- Icons are inline SVGs (Phosphor-style glyph paths), no external icon font/library required.
- No photographs or raster images are used in this design.
- Avatars are text-initial circles (no image assets).

## Files
- `Task Tracker.dc.html` — the full interactive prototype (all 4 screens + both breakpoints + role switch, single file).
- `design-system/` — the bound Nocturne design system: `styles.css` (all tokens/components), `readme.md` (usage guide), and the `components/*.html` reference pages cited above.
