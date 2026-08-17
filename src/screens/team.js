// Team screen: Activity Feed tab (real activity_log, team-scoped) and Team
// Overview tab (Team Pulse, Blockers & Alerts, per-member Today's Focus).
// Both tabs' data is fetched once on mount; switching tabs is a plain
// show/hide re-render, no framework routing within the screen.
//
// Assumption (stated per the build brief's rule 4 — non-data-model,
// proceeding rather than blocking): the design reference's Activity Feed
// also shows a "Sprint Progress" sidebar, but Phase 3's own build/test-case
// list (brief section 3) doesn't call for it, and the data model has no
// "sprint" concept — only flat projects — so mapping one to the other would
// be an extra undocumented assumption on top. Left out of this phase; can
// be revisited if a future phase defines what a "sprint" is here.
import { getCurrentProfile } from '../auth.js';
import { renderShell } from '../layout.js';
import { renderActivityCard, renderMemberCard, renderListSkeleton, renderErrorState, escapeHtml } from '../components.js';
import { createStore } from '../state.js';
import { fetchTeamActivity } from '../activity.js';
import { fetchAllTeamTasks } from '../tasks.js';
import { fetchTeamMembers } from '../users.js';
import { computeTeamPulse, computeBlockers, computeTodaysFocus } from '../teamStats.js';
import { todayISODate } from '../dateUtils.js';
import { downloadTeamTaskReportCSV, downloadTeamTaskReportPDF } from '../reportDownload.js';

export async function render(container) {
  const user = await getCurrentProfile();
  if (!user) {
    window.location.hash = '#/login';
    return;
  }

  const content = renderShell(container, { activeRoute: '/team', user });
  content.setAttribute('data-screen', 'team');
  const store = createStore({
    tab: 'feed',
    activity: [],
    teamTasks: [],
    teamMembers: [],
    loading: true,
    error: false,
  });

  async function loadData() {
    store.setState({ loading: true, error: false });
    try {
      const [activity, teamTasks, teamMembers] = await Promise.all([
        fetchTeamActivity(),
        fetchAllTeamTasks(user.id),
        fetchTeamMembers(user.id),
      ]);
      store.setState({ activity, teamTasks, teamMembers, loading: false });
    } catch {
      store.setState({ loading: false, error: true });
    }
  }

  function paint() {
    renderContent(content, store.getState());
    wireEvents(content, store, loadData);
  }

  store.subscribe(paint);
  paint();
  await loadData();
}

export function renderContent(content, state) {
  content.innerHTML = `
    <div class="flex items-start justify-between gap-5 mb-6 flex-wrap">
      <div>
        <h1 class="text-2xl font-heading mb-1">Team Feed</h1>
        <p class="text-neutral-400 m-0">Live updates and progress across your team.</p>
      </div>
      <div class="flex items-center gap-3 flex-wrap">
        <div class="seg" role="radiogroup" aria-label="Team screen tab">
          <label class="seg-opt"><input type="radio" name="team-tab" value="feed" ${state.tab === 'feed' ? 'checked' : ''} />Activity Feed</label>
          <label class="seg-opt"><input type="radio" name="team-tab" value="overview" ${state.tab === 'overview' ? 'checked' : ''} />Team Overview</label>
        </div>
        <div class="flex items-center gap-2">
          <button type="button" class="btn btn-secondary" data-action="export-csv" ${state.loading || state.error ? 'disabled' : ''} style="padding:7px 12px;font-size:13px">Export CSV</button>
          <button type="button" class="btn btn-secondary" data-action="export-pdf" ${state.loading || state.error ? 'disabled' : ''} style="padding:7px 12px;font-size:13px">Export PDF</button>
        </div>
      </div>
    </div>

    ${
      state.loading
        ? renderListSkeleton()
        : state.error
          ? renderErrorState('Could not load team data.')
          : state.tab === 'feed'
            ? renderFeedTab(state)
            : renderOverviewTab(state)
    }
  `;
}

function renderFeedTab(state) {
  return `
    <div data-tab="feed" class="flex flex-col gap-4">
      ${
        state.activity.length === 0
          ? `<p class="text-neutral-500 text-sm py-4">No team activity yet.</p>`
          : state.activity.map(renderActivityCard).join('')
      }
    </div>`;
}

function renderOverviewTab(state) {
  const pulse = computeTeamPulse(state.teamTasks);
  const blockers = computeBlockers(state.teamTasks);
  const today = todayISODate();

  return `
    <div data-tab="overview">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
        <div class="card elev-sm p-5">
          <div class="card-title mb-2.5">Team Pulse</div>
          <div style="font-size:38px;font-weight:600;font-family:var(--font-heading)">${pulse.pct}%</div>
          <p style="font-size:13px;color:var(--color-neutral-400);margin:2px 0 10px">Avg Completion</p>
          <div style="height:6px;border-radius:999px;background:var(--color-neutral-800);overflow:hidden;margin-bottom:8px">
            <div style="height:100%;width:${pulse.pct}%;background:var(--color-accent)"></div>
          </div>
          <div style="display:flex;gap:16px;font-size:12px;color:var(--color-neutral-500)">
            <span>${pulse.active} Tasks Active</span><span>${pulse.completed} Completed</span>
          </div>
        </div>
        <div class="card elev-sm p-5" data-role="blockers">
          <div class="card-title mb-2.5">Blockers &amp; Alerts</div>
          ${
            blockers.length === 0
              ? `<p class="text-neutral-500 text-sm">No blockers right now.</p>`
              : blockers
                  .map(
                    (b) => `
                <div style="padding:10px 0;border-top:1px solid var(--color-divider)">
                  <div style="font-size:13px;font-weight:500;color:var(--color-accent-2-200)">${escapeHtml(b.title)}</div>
                  <div style="font-size:12px;color:var(--color-neutral-500)">${escapeHtml(b.detail)}</div>
                </div>`
                  )
                  .join('')
          }
        </div>
      </div>
      <div class="grid gap-4" style="grid-template-columns:repeat(auto-fit,minmax(240px,1fr))" data-role="member-cards">
        ${
          state.teamMembers.length === 0
            ? `<p class="text-neutral-500 text-sm">No team members found.</p>`
            : state.teamMembers
                .map((m) => renderMemberCard(m, computeTodaysFocus(state.teamTasks, m.id, today)))
                .join('')
        }
      </div>
    </div>`;
}


function wireEvents(content, store, loadData) {
  content.querySelectorAll('input[name="team-tab"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      if (radio.checked) store.setState({ tab: radio.value });
    });
  });

  content.querySelector('[data-action="retry"]')?.addEventListener('click', () => loadData());

  content.querySelector('[data-action="export-csv"]')?.addEventListener('click', () => {
    const { teamTasks, teamMembers } = store.getState();
    downloadTeamTaskReportCSV(teamTasks, teamMembers);
  });

  content.querySelector('[data-action="export-pdf"]')?.addEventListener('click', () => {
    const { teamTasks, teamMembers } = store.getState();
    downloadTeamTaskReportPDF(teamTasks, teamMembers).catch((err) => {
      console.error('PDF export failed:', err);
    });
  });
}
