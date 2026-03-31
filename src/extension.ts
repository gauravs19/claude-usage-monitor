import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ActivityWatcher } from './activityWatcher';
import { StatusBarManager } from './statusBar';
import { UsageDashboardPanel } from './webviewPanel';
import { loadAllSessions, aggregateByDay, getClaudeProjectDir } from './usageParser';
import { detectActiveSessionId } from './sessionDetector';
import { SessionSummary } from './types';

const ACTIVITY_FILE = path.join(os.homedir(), '.claude', 'activity.jsonl');
const REFRESH_INTERVAL_MS = 60_000;

export function activate(context: vscode.ExtensionContext): void {
  const activityWatcher = new ActivityWatcher();
  const statusBar = new StatusBarManager(activityWatcher);

  activityWatcher.start();

  let sessions: SessionSummary[] = [];
  let days = aggregateByDay(sessions);

  function getWorkspaceCwd(): string | undefined {
    return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  }

  function resolveCurrentSession(allSessions: SessionSummary[]): SessionSummary | null {
    const activeId = detectActiveSessionId(getWorkspaceCwd());
    if (activeId) {
      const live = allSessions.find(s => s.sessionId === activeId);
      if (live) return live;
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

  // Watch Claude projects dir for new JSONL entries
  let projectDirWatcher: fs.FSWatcher | null = null;
  const claudeDir = getClaudeProjectDir();

  function startProjectDirWatch(): void {
    if (!fs.existsSync(claudeDir)) return;
    try {
      projectDirWatcher = fs.watch(claudeDir, { recursive: true, persistent: false }, () => {
        refresh();
      });
    } catch { /* watch not supported or dir missing */ }
  }

  startProjectDirWatch();

  // Background refresh fallback
  const refreshTimer = setInterval(refresh, REFRESH_INTERVAL_MS);

  function pushToPanel(): void {
    if (UsageDashboardPanel.currentPanel) {
      const cwd = getWorkspaceCwd();
      const currentProject = cwd ? require('path').basename(cwd) : undefined;
      UsageDashboardPanel.currentPanel.update(
        sessions,
        days,
        activityWatcher.getRecords(),
        fs.existsSync(ACTIVITY_FILE),
        currentProject
      );
    }
  }

  activityWatcher.on('activity', () => {
    statusBar.setCurrentSession(resolveCurrentSession(sessions));
    pushToPanel();
  });

  context.subscriptions.push(
    vscode.commands.registerCommand('claudeUsage.openPanel', () => {
      UsageDashboardPanel.show(context);
      pushToPanel();
    }),
    vscode.commands.registerCommand('claudeUsage.refresh', () => {
      refresh();
      vscode.window.setStatusBarMessage('Claude Usage: refreshed', 2000);
    })
  );

  context.subscriptions.push(
    statusBar,
    { dispose: () => { activityWatcher.stop(); projectDirWatcher?.close(); clearInterval(refreshTimer); } }
  );
}

export function deactivate(): void {}
