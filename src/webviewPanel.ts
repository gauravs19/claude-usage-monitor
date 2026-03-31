import * as vscode from 'vscode';
import { SessionSummary, DaySummary, ActivityRecord } from './types';

export class UsageDashboardPanel implements vscode.Disposable {
  static currentPanel: UsageDashboardPanel | undefined;

  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];

  static show(context: vscode.ExtensionContext): UsageDashboardPanel {
    if (UsageDashboardPanel.currentPanel) {
      UsageDashboardPanel.currentPanel.panel.reveal();
      return UsageDashboardPanel.currentPanel;
    }
    const panel = vscode.window.createWebviewPanel(
      'claudeUsageDashboard',
      'Claude Usage',
      vscode.ViewColumn.Beside,
      { enableScripts: true, retainContextWhenHidden: true }
    );
    UsageDashboardPanel.currentPanel = new UsageDashboardPanel(panel, context);
    return UsageDashboardPanel.currentPanel;
  }

  private constructor(panel: vscode.WebviewPanel, _context: vscode.ExtensionContext) {
    this.panel = panel;
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    this.panel.webview.html = this.skeleton();
  }

  update(
    sessions: SessionSummary[], days: DaySummary[], activity: ActivityRecord[],
    hooksActive: boolean, currentProject?: string,
    liveMetrics?: { contextPct: number | null; fiveHourPct: number | null; sevenDayPct: number | null; fiveHourResetsAt: Date | null }
  ): void {
    this.panel.webview.postMessage({ type: 'update', sessions, days, activity, hooksActive, currentProject, liveMetrics });
  }

  reveal(): void {
    this.panel.reveal();
  }

  dispose(): void {
    UsageDashboardPanel.currentPanel = undefined;
    this.panel.dispose();
    this.disposables.forEach(d => d.dispose());
  }

  private skeleton(): string {
    return /* html */`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Claude Usage</title>
<style>
  :root {
    --bg: var(--vscode-editor-background);
    --fg: var(--vscode-editor-foreground);
    --border: var(--vscode-panel-border, #333);
    --card-bg: var(--vscode-sideBar-background, #1e1e1e);
    --accent: var(--vscode-focusBorder, #007acc);
    --muted: var(--vscode-descriptionForeground, #888);
    --green: #4ec9b0;
    --yellow: #dcdcaa;
    --red: #f44747;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: var(--vscode-font-family); font-size: 13px; color: var(--fg); background: var(--bg); padding: 16px; }
  h2 { font-size: 15px; font-weight: 600; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
  h3 { font-size: 12px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: .06em; margin-bottom: 8px; }

  .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
  button { background: var(--accent); color: #fff; border: none; padding: 4px 12px; border-radius: 3px; cursor: pointer; font-size: 12px; }

  .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; margin-bottom: 24px; }
  .card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 6px; padding: 12px; }
  .card-label { font-size: 11px; color: var(--muted); margin-bottom: 4px; }
  .card-value { font-size: 22px; font-weight: 700; }
  .card-sub { font-size: 11px; color: var(--muted); margin-top: 2px; }

  .section { margin-bottom: 24px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { text-align: left; padding: 6px 8px; color: var(--muted); font-weight: 600; border-bottom: 1px solid var(--border); }
  td { padding: 6px 8px; border-bottom: 1px solid var(--border, #2a2a2a); vertical-align: middle; }
  tr:hover td { background: var(--card-bg); }
  .model-tag { font-size: 10px; padding: 1px 5px; border-radius: 3px; background: var(--card-bg); border: 1px solid var(--border); color: var(--muted); }
  .cost { color: var(--yellow); }

  .activity { background: var(--card-bg); border: 1px solid var(--border); border-radius: 6px; padding: 0; max-height: 280px; overflow-y: auto; }
  .activity-item { display: flex; gap: 10px; padding: 7px 12px; border-bottom: 1px solid var(--border); font-size: 12px; }
  .activity-item:last-child { border-bottom: none; }
  .activity-ts { color: var(--muted); white-space: nowrap; flex-shrink: 0; }
  .activity-tool { color: var(--green); font-weight: 600; flex-shrink: 0; min-width: 60px; }
  .activity-summary { color: var(--fg); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .activity-dur { color: var(--muted); flex-shrink: 0; }

  .notice { background: var(--card-bg); border: 1px solid var(--accent); border-radius: 6px; padding: 12px; font-size: 12px; color: var(--muted); }
  .notice code { color: var(--green); font-family: var(--vscode-editor-font-family); font-size: 11px; display: block; margin-top: 6px; }

  .empty { color: var(--muted); font-size: 12px; padding: 16px; text-align: center; }
  .filter-bar { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
  .filter-bar select { background: var(--card-bg); color: var(--fg); border: 1px solid var(--border); border-radius: 3px; padding: 3px 6px; font-size: 12px; cursor: pointer; }
  .filter-bar label { font-size: 11px; color: var(--muted); }
  .active-project-badge { font-size: 10px; padding: 2px 6px; border-radius: 10px; background: var(--accent); color: #fff; }
</style>
</head>
<body>
<div class="header">
  <h2>⚡ Claude Usage Monitor</h2>
  <button onclick="refresh()">↻ Refresh</button>
</div>

<div id="cards" class="cards"></div>

<div class="section">
  <h3>Activity Feed</h3>
  <div id="activity-feed" class="activity"><p class="empty">Waiting for activity…</p></div>
  <div id="hooks-notice" style="display:none;margin-top:8px"></div>
</div>

<div class="section">
  <div class="filter-bar">
    <h3 style="margin:0">Sessions</h3>
    <select id="project-filter" onchange="applyFilter()">
      <option value="">All projects</option>
    </select>
    <span id="active-badge" style="display:none" class="active-project-badge"></span>
  </div>
  <div id="sessions-table"></div>
</div>

<div class="section">
  <h3>Daily Usage</h3>
  <div id="days-table"></div>
</div>

<script>
const vscode = acquireVsCodeApi();
function refresh() { vscode.postMessage({ type: 'refresh' }); }

let _allSessions = [];
let _days = [];
let _currentProject = '';

function fmtK(n) {
  if (n >= 1e6) return (n/1e6).toFixed(1)+'M';
  if (n >= 1e3) return (n/1e3).toFixed(0)+'K';
  return n+'';
}
function fmtCost(c) { return c < 0.01 ? '<$0.01' : '$'+c.toFixed(2); }
function relTime(ts) {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff/60000);
  if (m < 1) return 'just now';
  if (m < 60) return m+'m ago';
  const h = Math.floor(m/60);
  if (h < 24) return h+'h ago';
  return Math.floor(h/24)+'d ago';
}

// Readable session label: "project / MM-DD HH:mm" — slug shown on hover
function sessionLabel(s) {
  const d = new Date(s.firstTs);
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const dd = String(d.getDate()).padStart(2,'0');
  const hh = String(d.getHours()).padStart(2,'0');
  const mi = String(d.getMinutes()).padStart(2,'0');
  return \`\${s.project} / \${mm}-\${dd} \${hh}:\${mi}\`;
}

function applyFilter() {
  const sel = document.getElementById('project-filter').value;
  renderSessions(sel ? _allSessions.filter(s => s.project === sel) : _allSessions);
}

function renderSessions(sessions) {
  document.getElementById('sessions-table').innerHTML = sessions.length === 0
    ? '<p class="empty">No sessions match</p>'
    : \`<table>
      <tr><th>Session</th><th>Model</th><th>Turns</th><th>Tok/turn</th><th>In</th><th>Out</th><th>Cache%</th><th>Ctx%</th><th>Cost</th><th>Last</th></tr>
      \${sessions.slice(0,30).map(s => {
        const totalIn = s.inputTokens+s.cacheReadTokens+s.cacheCreateTokens;
        const cacheHit = totalIn > 0 ? Math.round(s.cacheReadTokens/totalIn*100) : 0;
        const ctxColor = s.contextPct >= 80 ? 'var(--red)' : s.contextPct >= 60 ? 'var(--yellow)' : 'inherit';
        return \`<tr title="\${s.slug}">
          <td>\${sessionLabel(s)}</td>
          <td><span class="model-tag">\${s.model.replace('claude-','').replace('-4-6','4.6').replace('-4-5','4.5')}</span></td>
          <td>\${s.turns}</td>
          <td>\${fmtK(s.tokensPerTurn??0)}</td>
          <td>\${fmtK(totalIn)}</td>
          <td>\${fmtK(s.outputTokens)}</td>
          <td>\${cacheHit}%</td>
          <td style="color:\${ctxColor}">\${s.contextPct}%</td>
          <td class="cost">\${fmtCost(s.estimatedCostUsd)}</td>
          <td>\${relTime(s.lastTs)}</td>
        </tr>\`;
      }).join('')}
    </table>\`;
}

window.addEventListener('message', e => {
  const msg = e.data;
  if (msg.type !== 'update') return;
  const { sessions, days, activity, hooksActive, currentProject, liveMetrics } = msg;

  _allSessions = sessions;
  _days = days;
  _currentProject = currentProject ?? '';

  // Populate project filter dropdown, preserve current selection
  const filterEl = document.getElementById('project-filter');
  const prevSel = filterEl.value;
  const projects = [...new Set(sessions.map(s => s.project))].sort();
  filterEl.innerHTML = '<option value="">All projects</option>'
    + projects.map(p => \`<option value="\${p}"\${p===prevSel?' selected':''}>\${p}</option>\`).join('');

  // Show active project badge and auto-select current workspace on first load
  const badge = document.getElementById('active-badge');
  if (currentProject) {
    badge.style.display = 'inline';
    badge.textContent = currentProject;
    // Auto-select current workspace only if filter hasn't been manually changed
    if (!prevSel && projects.includes(currentProject)) {
      filterEl.value = currentProject;
    }
  } else {
    badge.style.display = 'none';
  }

  // Summary cards — always across ALL sessions for today (not filtered)
  const today = new Date().toISOString().slice(0,10);
  const todaySessions = sessions.filter(s => s.lastTs.slice(0,10) === today);
  const todayIn   = todaySessions.reduce((a,s) => a+s.inputTokens+s.cacheReadTokens+s.cacheCreateTokens, 0);
  const todayOut  = todaySessions.reduce((a,s) => a+s.outputTokens, 0);
  const todayCost = todaySessions.reduce((a,s) => a+s.estimatedCostUsd, 0);
  const latest    = sessions[0] ?? null;

  // Prefer live context % from statusLine if available
  const ctxPct = liveMetrics?.contextPct ?? latest?.contextPct ?? 0;
  const ctxColor = ctxPct >= 80 ? 'var(--red)' : ctxPct >= 60 ? 'var(--yellow)' : 'var(--green)';

  // Cache efficiency across today
  const todayTotalInput = todaySessions.reduce((a,s) => a+s.inputTokens+s.cacheReadTokens+s.cacheCreateTokens, 0);
  const todayCacheRead  = todaySessions.reduce((a,s) => a+s.cacheReadTokens, 0);
  const cacheHitPct = todayTotalInput > 0 ? Math.round(todayCacheRead / todayTotalInput * 100) : 0;

  const fiveHourPct  = liveMetrics?.fiveHourPct  ?? null;
  const sevenDayPct  = liveMetrics?.sevenDayPct  ?? null;
  const fiveHourReset = liveMetrics?.fiveHourResetsAt
    ? 'resets '+new Date(liveMetrics.fiveHourResetsAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})
    : 'subscription limit';

  document.getElementById('cards').innerHTML = [
    card('Today In',  fmtK(todayIn),  todaySessions.length+' sessions · '+fmtCost(todayCost)+' est.'),
    card('Today Out', fmtK(todayOut), 'cache hit '+cacheHitPct+'%'),
    cardWithBar('Context Window', Math.round(ctxPct)+'%', latest ? sessionLabel(latest)+' · '+fmtK(latest.tokensPerTurn??0)+'/turn' : '—', ctxPct, ctxColor),
    fiveHourPct !== null
      ? cardWithBar('5-Hour Limit', Math.round(fiveHourPct)+'%', fiveHourReset,  fiveHourPct, fiveHourPct>=80?'var(--red)':fiveHourPct>=60?'var(--yellow)':'var(--green)')
      : card('Total Sessions', sessions.length+'', sessions.reduce((a,s)=>a+s.turns,0)+' turns total'),
    sevenDayPct !== null
      ? cardWithBar('7-Day Limit', Math.round(sevenDayPct)+'%', 'subscription limit', sevenDayPct, sevenDayPct>=80?'var(--red)':sevenDayPct>=60?'var(--yellow)':'var(--green)')
      : card('Total Sessions', sessions.length+'', sessions.reduce((a,s)=>a+s.turns,0)+' turns total'),
  ].filter((v,i,a) => a.indexOf(v)===i).join(''); // dedup if both rate limit cards are null

  // Activity feed
  const feedEl = document.getElementById('activity-feed');
  if (activity.length === 0) {
    feedEl.innerHTML = '<p class="empty">No activity yet — configure hooks to see live updates</p>';
  } else {
    feedEl.innerHTML = [...activity].reverse().slice(0,30).map(r => {
      const ts = new Date(r.ts).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit', second:'2-digit'});
      const dur = r.durationMs ? (r.durationMs/1000).toFixed(1)+'s' : '';
      const icon = r.event === 'PreToolUse' ? '▶' : r.event === 'PostToolUse' ? '✓' : r.event === 'Stop' ? '■' : '●';
      return \`<div class="activity-item">
        <span class="activity-ts">\${ts}</span>
        <span class="activity-tool">\${icon} \${r.tool ?? r.event}</span>
        <span class="activity-summary">\${r.summary ?? ''}</span>
        <span class="activity-dur">\${dur}</span>
      </div>\`;
    }).join('');
  }

  // Hooks notice
  const noticeEl = document.getElementById('hooks-notice');
  if (!hooksActive) {
    noticeEl.style.display = 'block';
    noticeEl.innerHTML = \`<div class="notice">
      <strong>Live activity requires hooks.</strong> Add to <code>~/.claude/settings.json</code>:
      <code>"hooks": { "PreToolUse": [{"matcher":"","hooks":[{"type":"command","command":"node ~/.claude/hooks/activity-logger.js"}]}], "PostToolUse": [{"matcher":"","hooks":[{"type":"command","command":"node ~/.claude/hooks/activity-logger.js"}]}] }</code>
    </div>\`;
  } else {
    noticeEl.style.display = 'none';
  }

  // Sessions table — apply current filter
  applyFilter();

  // Days table
  document.getElementById('days-table').innerHTML = days.length === 0
    ? '<p class="empty">No data</p>'
    : \`<table>
      <tr><th>Date</th><th>Sessions</th><th>Turns</th><th>In</th><th>Out</th><th>Est. Cost</th></tr>
      \${days.slice(0,14).map(d => \`<tr>
        <td>\${d.date === today ? '<strong>Today</strong>' : d.date}</td>
        <td>\${d.sessions}</td>
        <td>\${d.turns}</td>
        <td>\${fmtK(d.inputTokens)}</td>
        <td>\${fmtK(d.outputTokens)}</td>
        <td class="cost">\${fmtCost(d.estimatedCostUsd)}</td>
      </tr>\`).join('')}
    </table>\`;
});

function card(label, value, sub) {
  return \`<div class="card"><div class="card-label">\${label}</div><div class="card-value">\${value}</div><div class="card-sub">\${sub}</div></div>\`;
}
function cardWithBar(label, value, sub, pct, color) {
  return \`<div class="card">
    <div class="card-label">\${label}</div>
    <div class="card-value" style="color:\${color}">\${value}</div>
    <div style="margin:4px 0;height:4px;background:var(--border);border-radius:2px">
      <div style="height:100%;width:\${pct}%;background:\${color};border-radius:2px;transition:width .3s"></div>
    </div>
    <div class="card-sub">\${sub}</div>
  </div>\`;
}
</script>
</body>
</html>`;
  }
}
