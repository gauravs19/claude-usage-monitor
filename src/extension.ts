import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ActivityWatcher } from './activityWatcher';
import { StatusBarManager } from './statusBar';
import { UsageDashboardPanel } from './webviewPanel';
import { loadAllSessions, aggregateByDay, getClaudeProjectDir } from './usageParser';

const ACTIVITY_FILE = path.join(os.homedir(), '.claude', 'activity.jsonl');
const REFRESH_INTERVAL_MS = 60_000; // background refresh every 60s

export function activate(context: vscode.ExtensionContext): void {
  const activityWatcher = new ActivityWatcher();
  const statusBar = new StatusBarManager(activityWatcher);

  activityWatcher.start();

  let sessions = loadAllSessions();
  let days = aggregateByDay(sessions);

  // Update status bar with most recent session
  statusBar.setCurrentSession(sessions[0] ?? null);

  // Watch for new JSONL entries in Claude projects dir
  let projectDirWatcher: fs.FSWatcher | null = null;
  const claudeDir = getClaudeProjectDir();

  function startProjectDirWatch(): void {
    if (!fs.existsSync(claudeDir)) return;
    try {
      projectDirWatcher = fs.watch(claudeDir, { recursive: true, persistent: false }, () => {
        sessions = loadAllSessions();
        days = aggregateByDay(sessions);
        statusBar.setCurrentSession(sessions[0] ?? null);
        pushToPanel();
      });
    } catch { /* watch not supported or dir missing */ }
  }

  startProjectDirWatch();

  // Background refresh fallback (catches cases watch misses)
  const refreshTimer = setInterval(() => {
    sessions = loadAllSessions();
    days = aggregateByDay(sessions);
    statusBar.setCurrentSession(sessions[0] ?? null);
    pushToPanel();
  }, REFRESH_INTERVAL_MS);

  function pushToPanel(): void {
    if (UsageDashboardPanel.currentPanel) {
      UsageDashboardPanel.currentPanel.update(
        sessions,
        days,
        activityWatcher.getRecords(),
        fs.existsSync(ACTIVITY_FILE)
      );
    }
  }

  activityWatcher.on('activity', () => pushToPanel());

  // Commands
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeUsage.openPanel', () => {
      UsageDashboardPanel.show(context);
      pushToPanel();
    }),
    vscode.commands.registerCommand('claudeUsage.refresh', () => {
      sessions = loadAllSessions();
      days = aggregateByDay(sessions);
      statusBar.setCurrentSession(sessions[0] ?? null);
      pushToPanel();
      vscode.window.setStatusBarMessage('Claude Usage: refreshed', 2000);
    })
  );

  context.subscriptions.push(
    statusBar,
    { dispose: () => { activityWatcher.stop(); projectDirWatcher?.close(); clearInterval(refreshTimer); } }
  );
}

export function deactivate(): void {}
