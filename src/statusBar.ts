import * as vscode from 'vscode';
import { SessionSummary } from './types';
import { ActivityWatcher } from './activityWatcher';

function fmtK(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`;
  return `${n}`;
}

function contextBar(pct: number): string {
  // 5-block bar: ░░░░░ → █████
  const filled = Math.round(pct / 20);
  return '█'.repeat(filled) + '░'.repeat(5 - filled);
}

export class StatusBarManager implements vscode.Disposable {
  private item: vscode.StatusBarItem;
  private activityWatcher: ActivityWatcher;
  private currentSession: SessionSummary | null = null;

  constructor(activityWatcher: ActivityWatcher) {
    this.activityWatcher = activityWatcher;
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.item.command = 'claudeUsage.openPanel';
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
      this.item.tooltip = 'Claude Usage — no active session found';
      return;
    }

    const s = this.currentSession;
    const totalIn  = fmtK(s.inputTokens + s.cacheReadTokens + s.cacheCreateTokens);
    const totalOut = fmtK(s.outputTokens);
    const cost     = s.estimatedCostUsd < 0.01 ? '<$0.01' : `$${s.estimatedCostUsd.toFixed(2)}`;
    const ctx      = s.contextPct;

    // Colour the status bar when context is getting full
    if (ctx >= 80) {
      this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
    } else if (ctx >= 60) {
      this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    } else {
      this.item.backgroundColor = undefined;
    }

    this.item.text = `$(circuit-board) ${totalIn}↑ ${totalOut}↓  ctx:${ctx}%`;
    this.item.tooltip = new vscode.MarkdownString([
      `**Session:** ${s.slug}  |  **Project:** ${s.project}`,
      `**Turns:** ${s.turns}  |  **~${s.tokensPerTurn.toLocaleString()} tokens/turn**`,
      ``,
      `**Context window:** ${ctx}%  ${contextBar(ctx)}`,
      `Input: ${s.inputTokens.toLocaleString()}  |  Cache read: ${fmtK(s.cacheReadTokens)}  |  Output: ${s.outputTokens.toLocaleString()}`,
      ``,
      `**Est. cost (API rates):** ${cost}`,
      ``,
      `_Click to open dashboard_`,
    ].join('\n\n'));
    this.item.tooltip.isTrusted = true;
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
