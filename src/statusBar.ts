import * as vscode from 'vscode';
import { SessionSummary } from './types';
import { ActivityWatcher } from './activityWatcher';

function fmtK(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`;
  return `${n}`;
}

export class StatusBarManager implements vscode.Disposable {
  private item: vscode.StatusBarItem;
  private activityWatcher: ActivityWatcher;
  private currentSession: SessionSummary | null = null;

  constructor(activityWatcher: ActivityWatcher) {
    this.activityWatcher = activityWatcher;
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.item.command = 'claudeUsage.openPanel';
    this.item.tooltip = 'Claude Usage — click to open dashboard';
    this.item.show();

    this.activityWatcher.on('activity', () => this.refresh());
  }

  setCurrentSession(session: SessionSummary | null): void {
    this.currentSession = session;
    this.refresh();
  }

  refresh(): void {
    const active = this.activityWatcher.getActiveTool();

    if (active) {
      const label = this.toolLabel(active.tool, active.summary);
      this.item.text = `$(sync~spin) ${label}`;
      this.item.tooltip = `Claude is running: ${active.tool}\n${active.summary}\n\nClick to open dashboard`;
      this.item.backgroundColor = undefined;
      return;
    }

    if (!this.currentSession) {
      this.item.text = `$(circuit-board) Claude`;
      this.item.tooltip = 'Claude Usage — no session data yet';
      return;
    }

    const s = this.currentSession;
    const totalIn  = fmtK(s.inputTokens + s.cacheReadTokens + s.cacheCreateTokens);
    const totalOut = fmtK(s.outputTokens);
    const cost     = s.estimatedCostUsd < 0.01 ? '<$0.01' : `$${s.estimatedCostUsd.toFixed(2)}`;

    this.item.text = `$(circuit-board) ${totalIn}↑ ${totalOut}↓ ${cost}`;
    this.item.tooltip = [
      `Session: ${s.slug}`,
      `Project: ${s.project}`,
      `Turns: ${s.turns}`,
      `Input: ${s.inputTokens.toLocaleString()} tokens`,
      `Output: ${s.outputTokens.toLocaleString()} tokens`,
      `Cache read: ${s.cacheReadTokens.toLocaleString()} tokens`,
      `Est. cost (API rates): ${cost}`,
      '',
      'Click to open dashboard',
    ].join('\n');
  }

  private toolLabel(tool: string, summary: string): string {
    const toolShort: Record<string, string> = {
      Bash: 'Shell',
      Read: 'Reading',
      Write: 'Writing',
      Edit: 'Editing',
      Grep: 'Searching',
      Glob: 'Scanning',
      WebFetch: 'Fetching',
      WebSearch: 'Searching web',
      Agent: 'Spawning agent',
    };
    const prefix = toolShort[tool] ?? tool;
    return summary ? `${prefix}: ${summary.slice(0, 40)}` : prefix;
  }

  dispose(): void {
    this.item.dispose();
  }
}
