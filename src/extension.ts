import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ActivityWatcher } from './activityWatcher';
import { StatusBarManager } from './statusBar';
import { StatusLineWatcher } from './statusLineWatcher';
import { UsageDashboardPanel } from './webviewPanel';
import { loadAllSessions, aggregateByDay, getClaudeProjectDir } from './usageParser';
import { detectActiveSessionId } from './sessionDetector';
import { SessionSummary } from './types';
import { installHooks } from './hookInstaller';

const ACTIVITY_FILE = path.join(os.homedir(), '.claude', 'activity.jsonl');
const REFRESH_INTERVAL_MS = 60_000;

export function activate(context: vscode.ExtensionContext): void {
  const activityWatcher  = new ActivityWatcher();
  const statusLineWatcher = new StatusLineWatcher();
  const statusBar = new StatusBarManager(activityWatcher, statusLineWatcher);

  activityWatcher.start();
  statusLineWatcher.start();

  let sessions: SessionSummary[] = [];
  let days = aggregateByDay(sessions);

  function getWorkspaceCwd(): string | undefined {
    return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  }

  function resolveCurrentSession(allSessions: SessionSummary[]): SessionSummary | null {
    // Prefer session matching transcript_path from live statusLine data
    const transcriptPath = statusLineWatcher.getData()?.transcript_path;
    if (transcriptPath) {
      const sid = path.basename(transcriptPath, '.jsonl');
      const live = allSessions.find(s => s.sessionId === sid);
      if (live) return live;
    }

    const activeId = detectActiveSessionId(getWorkspaceCwd());
    if (activeId) {
      const match = allSessions.find(s => s.sessionId === activeId);
      if (match) return match;
    }

    // Fallback: most recent session active within last 2 hours
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    return allSessions.find(s => s.lastTs > twoHoursAgo) ?? allSessions[0] ?? null;
  }

  function refresh(): void {
    sessions = loadAllSessions();
    days = aggregateByDay(sessions);
    statusBar.setCurrentSession(resolveCurrentSession(sessions));
    pushToPanel();
  }

  refresh();

  // Watch Claude projects dir for JSONL changes
  let projectDirWatcher: fs.FSWatcher | null = null;
  const claudeDir = getClaudeProjectDir();

  function startProjectDirWatch(): void {
    if (!fs.existsSync(claudeDir)) return;
    try {
      projectDirWatcher = fs.watch(claudeDir, { recursive: true, persistent: false }, () => refresh());
    } catch { /* watch not supported */ }
  }
  startProjectDirWatch();

  const refreshTimer = setInterval(refresh, REFRESH_INTERVAL_MS);

  function pushToPanel(): void {
    if (UsageDashboardPanel.currentPanel) {
      const cwd = getWorkspaceCwd();
      const currentProject = cwd ? path.basename(cwd) : undefined;
      const liveData = statusLineWatcher.getData();
      const rateLimits = statusLineWatcher.getRateLimits();
      const current = resolveCurrentSession(sessions);
      
      const ctxEff = current && (current.inputTokens + current.cacheReadTokens > 0)
        ? current.outputTokens / (current.inputTokens + current.cacheReadTokens + current.cacheCreateTokens)
        : null;
      
      const efficiency = activityWatcher.computeEfficiency(ctxEff, current?.estimatedCostUsd);

      if (efficiency.isRunaway) {
        vscode.window.setStatusBarMessage('$(warning) Claude: High Bash Errors Detected!', 3000);
      }
      if (efficiency.budgetExceeded) {
        vscode.window.setStatusBarMessage('$(alert) Claude: Session Budget Exceeded!', 3000);
      }

      UsageDashboardPanel.currentPanel.update(
        sessions, days,
        activityWatcher.getRecords(),
        fs.existsSync(ACTIVITY_FILE),
        currentProject,
        liveData ? { ...rateLimits, contextPct: statusLineWatcher.getContextPct() } : undefined,
        efficiency
      );
    }
  }

  activityWatcher.on('activity', () => {
    statusBar.setCurrentSession(resolveCurrentSession(sessions));
    pushToPanel();
  });

  // statusLine updates are frequent (~300ms) — only push to panel, don't re-parse files
  statusLineWatcher.on('update', () => {
    statusBar.setCurrentSession(resolveCurrentSession(sessions));
    pushToPanel();
  });

  context.subscriptions.push(
    vscode.commands.registerCommand('claudeUsage.openPanel', () => {
      UsageDashboardPanel.show();
      pushToPanel();
    }),
    vscode.commands.registerCommand('claudeUsage.refresh', () => {
      refresh();
      vscode.window.setStatusBarMessage('Claude Usage: refreshed', 2000);
    }),
    vscode.commands.registerCommand('claudeUsage.installHooks', async () => {
      await installHooks(context);
      refresh();
    })
  );

  context.subscriptions.push(
    statusBar,
    {
      dispose: () => {
        activityWatcher.stop();
        statusLineWatcher.stop();
        projectDirWatcher?.close();
        clearInterval(refreshTimer);
      }
    }
  );
}

export function deactivate(): void {}
