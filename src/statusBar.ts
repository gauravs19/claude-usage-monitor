import * as vscode from 'vscode';
import { SessionSummary } from './types';
import { ActivityWatcher } from './activityWatcher';
import { StatusLineWatcher } from './statusLineWatcher';

function fmtK(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`;
  return `${n}`;
}

function rateBar(pct: number): string {
  const filled = Math.round(pct / 20);
  return '█'.repeat(filled) + '░'.repeat(5 - filled);
}

export class StatusBarManager implements vscode.Disposable {
  private item: vscode.StatusBarItem;
  private activityWatcher: ActivityWatcher;
  private statusLineWatcher: StatusLineWatcher;
  private currentSession: SessionSummary | null = null;

  constructor(activityWatcher: ActivityWatcher, statusLineWatcher: StatusLineWatcher) {
    this.activityWatcher = activityWatcher;
    this.statusLineWatcher = statusLineWatcher;

    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.item.command = 'claudeUsage.openPanel';
    this.item.show();

    this.activityWatcher.on('activity', () => this.refresh());
    this.statusLineWatcher.on('update', () => this.refresh());
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

    // Prefer live statusLine data when available
    const live = this.statusLineWatcher.getData();
    const ctxPct = live
      ? (this.statusLineWatcher.getContextPct() ?? this.currentSession?.contextPct ?? 0)
      : (this.currentSession?.contextPct ?? 0);

    const rl = this.statusLineWatcher.getRateLimits();
    const hasRateLimits = rl.fiveHourPct !== null || rl.sevenDayPct !== null;

    // Colour thresholds
    const maxPressure = Math.max(
      ctxPct,
      rl.fiveHourPct ?? 0,
      rl.sevenDayPct ?? 0
    );
    if (maxPressure >= 80) {
      this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
    } else if (maxPressure >= 60) {
      this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    } else {
      this.item.backgroundColor = undefined;
    }

    if (!this.currentSession && !live) {
      this.item.text = `$(circuit-board) Claude`;
      this.item.tooltip = 'Claude Usage — no active session';
      return;
    }

    // Build status bar text — rate limits take priority when available (more meaningful for subscribers)
    if (hasRateLimits) {
      const parts = [`ctx:${Math.round(ctxPct)}%`];
      if (rl.fiveHourPct !== null) parts.push(`5h:${Math.round(rl.fiveHourPct)}%`);
      if (rl.sevenDayPct  !== null) parts.push(`7d:${Math.round(rl.sevenDayPct)}%`);
      this.item.text = `$(circuit-board) ${parts.join(' ')}`;
    } else {
      const s = this.currentSession;
      if (!s) { this.item.text = `$(circuit-board) ctx:${Math.round(ctxPct)}%`; }
      else {
        const totalIn  = fmtK(s.inputTokens + s.cacheReadTokens + s.cacheCreateTokens);
        const totalOut = fmtK(s.outputTokens);
        this.item.text = `$(circuit-board) ${totalIn}↑ ${totalOut}↓  ctx:${Math.round(ctxPct)}%`;
      }
    }

    // Rich tooltip
    const lines: string[] = [];

    if (live?.model) {
      lines.push(`**Model:** ${live.model.display_name ?? live.model.id ?? ''}`);
    } else if (this.currentSession) {
      lines.push(`**Model:** ${this.currentSession.model}`);
    }

    if (this.currentSession) {
      lines.push(`**Session:** ${this.currentSession.project} / ${this.currentSession.slug}`);
      lines.push(`**Turns:** ${this.currentSession.turns}  |  ~${fmtK(this.currentSession.tokensPerTurn)}/turn`);
    }

    lines.push('');
    lines.push(`**Context:** ${Math.round(ctxPct)}%  ${rateBar(ctxPct)}`);

    if (hasRateLimits) {
      lines.push('');
      lines.push('**Rate limits (subscription):**');
      if (rl.fiveHourPct !== null) {
        const resetStr = rl.fiveHourResetsAt
          ? ` — resets ${rl.fiveHourResetsAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
          : '';
        lines.push(`5-hour: ${Math.round(rl.fiveHourPct)}%  ${rateBar(rl.fiveHourPct)}${resetStr}`);
      }
      if (rl.sevenDayPct !== null) {
        lines.push(`7-day: ${Math.round(rl.sevenDayPct)}%  ${rateBar(rl.sevenDayPct)}`);
      }
    } else if (this.currentSession) {
      const cost = this.currentSession.estimatedCostUsd;
      lines.push(`**Est. cost (API rates):** ${cost < 0.01 ? '<$0.01' : `$${cost.toFixed(2)}`}`);
    }

    lines.push('');
    lines.push('_Click to open dashboard_');

    const tip = new vscode.MarkdownString(lines.join('\n\n'));
    tip.isTrusted = true;
    this.item.tooltip = tip;
  }

  private toolLabel(tool: string, summary: string): string {
    const toolShort: Record<string, string> = {
      Bash: 'Shell', Read: 'Reading', Write: 'Writing', Edit: 'Editing',
      Grep: 'Searching', Glob: 'Scanning', WebFetch: 'Fetching',
      WebSearch: 'Searching web', Agent: 'Spawning agent',
    };
    const prefix = toolShort[tool] ?? tool;
    return summary ? `${prefix}: ${summary.slice(0, 40)}` : prefix;
  }

  dispose(): void {
    this.item.dispose();
  }
}
