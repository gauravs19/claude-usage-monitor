# Claude Usage Monitor

> Know what Claude Code is doing — and what it's costing you — without leaving VS Code.

![VS Code](https://img.shields.io/badge/VS%20Code-%5E1.85.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Version](https://img.shields.io/badge/version-0.1.0-purple)

---

## The Problem

Claude Code is a powerful coding agent, but it gives you **zero ambient visibility** into its activity. You can't see:

- How much of your context window is consumed
- Whether you're approaching your 5-hour or 7-day rate limits
- What tool Claude is currently running during long processing
- How many tokens a session has burned — or what it's costing you
- Whether Claude is thrashing on failed shell commands

You're flying blind. This extension fixes that.

---

## What You Get

### Status Bar (always visible)

| State | Display | What it means |
|---|---|---|
| Idle (subscription) | `⊙ ctx:45% 5h:12% 7d:3%` | Context + rate limit usage at a glance |
| Idle (API key) | `⊙ 42K↑ 8K↓ ctx:45%` | Token counts + context window |
| Active | `⟳ Shell: npm test` | Live indicator of what Claude is doing |
| Warning | Yellow background | Any metric hits 60% |
| Critical | Red background | Any metric hits 80% |

Hover for a rich tooltip: model name, session info, turns, tokens/turn, rate limit reset times.

### Dashboard (click to open)

| Section | What you see |
|---|---|
| **Summary cards** | Today's tokens in/out, cost estimate, context gauge, 5h/7d rate limits |
| **Activity feed** | Last 30 tool calls — tool name, what it was doing, how long it took |
| **Efficiency panel** | Tool distribution chart, Bash error rate, context efficiency ratio, action ratio |
| **Sessions table** | Per-session: model, turns, tokens/turn, cache hit %, context %, cost |
| **Daily table** | 14-day aggregate — sessions, turns, tokens, estimated cost |

Filter sessions by project. Current workspace is auto-selected.

---

## How It Works

Three local data sources. No external API calls. No telemetry.

| Source | What it reads | Update speed |
|---|---|---|
| `~/.claude/projects/**/*.jsonl` | Full session history, token counts per turn | On turn-end |
| `~/.claude/activity.jsonl` | Live tool activity (via hook scripts) | Near-instant |
| `~/.claude/statusline-live.json` | Real-time context %, rate limits, model info | ~300ms |

Everything runs locally using `fs.watch` — no polling, minimal overhead.

---

## Quick Start

### 1. Install the extension

```bash
git clone https://github.com/gauravs19/claude-usage-monitor
cd claude-usage-monitor
npm install && npm run build
npx @vscode/vsce package --no-dependencies --allow-missing-repository
code --install-extension claude-usage-monitor-0.1.0.vsix
```

### 2. Deploy hook scripts

```bash
cp hooks/activity-logger.js ~/.claude/hooks/activity-logger.js
cp hooks/statusline-bridge.js ~/.claude/hooks/statusline-bridge.js
```

### 3. Configure Claude Code

Add to `~/.claude/settings.json`:

```json
{
  "statusLine": {
    "type": "command",
    "command": "node $HOME/.claude/hooks/statusline-bridge.js"
  },
  "hooks": {
    "PreToolUse": [
      { "matcher": "", "hooks": [{ "type": "command", "command": "node $HOME/.claude/hooks/activity-logger.js", "async": true }] }
    ],
    "PostToolUse": [
      { "matcher": "", "hooks": [{ "type": "command", "command": "node $HOME/.claude/hooks/activity-logger.js", "async": true }] }
    ],
    "Stop": [
      { "matcher": "", "hooks": [{ "type": "command", "command": "node $HOME/.claude/hooks/activity-logger.js", "async": true }] }
    ]
  }
}
```

### 4. Reload VS Code

`Ctrl+Shift+P` → **Developer: Reload Window**

---

## Efficiency Metrics

The dashboard doesn't just show numbers — it helps you understand session quality:

| Metric | What it tells you |
|---|---|
| **Tool distribution** | Which tools Claude uses most (bar chart + avg duration) |
| **Bash error rate** | % of shell commands that fail — high means Claude is thrashing |
| **Context efficiency** | Output tokens ÷ input tokens — low means lots of reading, little writing |
| **Action ratio** | (Read + Write + Edit) ÷ total calls — high means an editing-heavy session |

---

## Why This Exists

Most AI coding tools give you a chat interface and a monthly bill. No visibility in between.

Claude Code subscription users hit opaque rate limits with no warning. API key users rack up costs with no feedback loop. And everyone wonders "what is Claude doing right now?" during long operations.

**Claude Usage Monitor** puts usage data where you already work — your editor's status bar — so you can make informed decisions about when to continue, when to pause, and when a session needs a fresh context window.

---

## Comparison

| Feature | Claude Usage Monitor | Token counters | API dashboards |
|---|---|---|---|
| Lives in VS Code | ✅ Status bar + panel | ✅ Status bar only | ❌ Browser tab |
| Live tool activity | ✅ Real-time feed | ❌ | ❌ |
| Rate limit tracking | ✅ 5h + 7d limits | ❌ | Partial |
| Session history | ✅ Multi-session, 14-day | ❌ Current file only | ✅ But delayed |
| Cost estimation | ✅ Per-session + daily | ✅ Per-file | ✅ |
| Efficiency analytics | ✅ Error rate, action ratio | ❌ | ❌ |
| Project filtering | ✅ Workspace-scoped | ❌ | ❌ |
| Privacy | ✅ 100% local | Varies | ❌ Requires API calls |

---

## Commands

| Command | Action |
|---|---|
| `Claude Usage: Open Dashboard` | Open the webview panel |
| `Claude Usage: Refresh` | Force reload all session data |

---

## Architecture

```
~/.claude/projects/**/*.jsonl   →  usageParser.ts      →  session/day aggregates
~/.claude/activity.jsonl        →  activityWatcher.ts   →  live tool feed + efficiency
~/.claude/statusline-live.json  →  statusLineWatcher.ts →  real-time ctx%, rate limits

All three → extension.ts → statusBar.ts + webviewPanel.ts
```

**Design choices:**
- `fs.watch` (not polling) on all data files — minimal CPU overhead
- Incremental JSONL reads — tracks byte offset, never re-reads full files
- Hook scripts run `async: true` — never block Claude's tool execution
- `activity.jsonl` auto-rotates at 2 MB — keeps last 50% of lines
- Session resolved via transcript_path → PID file → recency fallback

---

## Requirements

- VS Code `^1.85.0`
- Node.js `18+` (for hook scripts)
- Claude Code `2.1+`

---

## License

MIT
