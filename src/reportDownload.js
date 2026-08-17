// Team task history export (Phase 7) — the DOM/library side (actually
// triggering a file download) that reportExport.js's pure row/CSV
// functions deliberately stay free of, so those can be unit-tested without
// a browser or the jsPDF library involved.
//
// jsPDF/jspdf-autotable are dynamically imported inside
// downloadTeamTaskReportPDF rather than imported at module top level:
// jsPDF pulls in html2canvas + dompurify as transitive dependencies, which
// bloated the Team screen's own JS chunk by ~140KB gzipped when eagerly
// bundled — a real cost paid on every Team screen visit for a feature most
// visits never use. A dynamic import() gives it its own on-demand chunk,
// fetched only when "Export PDF" is actually clicked.
import { buildTaskReportRows, tasksToCSV, toReportTableBody, REPORT_TABLE_HEAD } from './reportExport.js';

const REPORT_TITLE = 'WorkSync — Team Task History';

/**
 * @param {Array} teamTasks
 * @param {Array<{ id: string, name: string }>} teamMembers
 */
function reportRows(teamTasks, teamMembers) {
  return buildTaskReportRows(teamTasks, new Map(teamMembers.map((m) => [m.id, m])));
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/**
 * @param {Array} teamTasks
 * @param {Array<{ id: string, name: string }>} teamMembers
 */
export function downloadTeamTaskReportCSV(teamTasks, teamMembers) {
  const csv = tasksToCSV(reportRows(teamTasks, teamMembers));
  triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), 'worksync-team-tasks.csv');
}

/**
 * @param {Array} teamTasks
 * @param {Array<{ id: string, name: string }>} teamMembers
 */
export async function downloadTeamTaskReportPDF(teamTasks, teamMembers) {
  const rows = reportRows(teamTasks, teamMembers);
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF();
  doc.text(REPORT_TITLE, 14, 15);
  doc.setFontSize(10);
  doc.text(new Date().toLocaleDateString(), 14, 21);
  autoTable(doc, { head: [REPORT_TABLE_HEAD], body: toReportTableBody(rows), startY: 26 });
  doc.save('worksync-team-tasks.pdf');
}
