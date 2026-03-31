# Claude Usage Monitor — Extension Spec

## Problem
Claude Code gives no ambient visibility into:
1. How many tokens / estimated cost a session is consuming
2. What Claude is actually doing during long-running processing (tool calls)

## Goals
- G1: Show token usage (in/out/cache) for the current session in the VS Code status bar
- G2: Show a live activity feed — "what tool is running right now" — during processing
- G3: Click-through dashboard with per-session and per-day breakdowns
- G4: Zero external API calls — all data is local file reads

## Non-Goals
- Not a billing system — cost estimates use API pricing, not subscription billing
- Not a Claude Code replacement UI — complements, doesn't replace
- No telemetry or data upload of any kind

---

## Data Architecture

### Source 1: JSONL Conversation Logs
Path: `~/.claude/projects/<project-slug>/<session-id>.jsonl`

Every assistant turn emits a line containing:
```json
{
  "type": "assistant",
  "sessionId": "...",
  "slug": "...",
  "cwd": "...",
  "timestamp": "ISO8601",
  "message": {
    "model": "claude-sonnet-4-6",
    "usage": {
      "input_tokens": 1,
      "output_tokens": 25,
      "cache_creation_input_tokens": 431,
      "cache_read_input_tokens": 25412
    }
  }
}
```
Used for: session/day aggregation, cost estimation.

### Source 2: Activity Hook Log
Path: `~/.claude/activity.jsonl` (created by the bundled hook script)

Written by `hooks/activity-logger.js` on each `PreToolUse` / `PostToolUse` / `Stop` event:
```json
{ "ts": 1234567890, "event": "PreToolUse", "tool": "Bash", "summary": "npm install" }
{ "ts": 1234567891, "event": "PostToolUse", "tool": "Bash", "durationMs": 4200, "exitCode": 0 }
```
Used for: real-time activity feed and status bar "Claude is running: …" indicator.

---

## Components

### StatusBarManager (`src/statusBar.ts`)
- **Idle**: `$(circuit-board) 42K↑ 8K↓ $0.12` — tokens + estimated cost for most recent session
- **Active tool**: `$(sync~spin) Shell: npm test` — spins while a tool is executing
- **Click**: opens dashboard panel
- Auto-clears active tool after 2 min (failsafe if PostToolUse hook isn't configured)

### ActivityWatcher (`src/activityWatcher.ts`)
- Watches `~/.claude/activity.jsonl` with `fs.watch`
- Incremental reads (tracks byte offset — no re-reading entire file)
- Falls back to watching parent dir if file doesn't exist yet
- Emits `'activity'` events consumed by StatusBar and WebviewPanel

### UsageParser (`src/usageParser.ts`)
- Scans `~/.claude/projects/` recursively for `.jsonl` files
- Parses assistant lines, aggregates by sessionId
- Derives project name from `cwd` field
- Groups sessions by date for daily summaries
- Cost estimation based on API pricing (see Pricing section)

### UsageDashboardPanel (`src/webviewPanel.ts`)
- VS Code Webview (singleton, opens beside current editor)
- Receives data via `postMessage` from extension host — no FS access from webview
- Sections:
  - **Summary cards**: Today in/out tokens, last session, total sessions
  - **Activity feed**: Last 30 tool calls with tool name, summary, duration
  - **Sessions table**: Recent 20 sessions with model, turns, tokens, cost, relative time
  - **Daily table**: Last 14 days with aggregate stats
- Shows "hooks not configured" notice if `activity.jsonl` doesn't exist yet

---

## Hook Setup

The extension bundles `hooks/activity-logger.js`. Users add to `~/.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse":  [{ "matcher": "", "hooks": [{ "type": "command", "command": "node ~/.claude/hooks/activity-logger.js" }] }],
    "PostToolUse": [{ "matcher": "", "hooks": [{ "type": "command", "command": "node ~/.claude/hooks/activity-logger.js" }] }],
    "Stop":        [{ "matcher": "", "hooks": [{ "type": "command", "command": "node ~/.claude/hooks/activity-logger.js" }] }]
  }
}
```

Hook receives event type via `CLAUDE_HOOK_EVENT` env var and event data via stdin JSON.

---

## Pricing Model (API rates — approximation)

| Model | Input | Output | Cache Read | Cache Create |
|---|---|---|---|---|
| claude-opus-4-6   | $15/MTok | $75/MTok | $1.50/MTok | $18.75/MTok |
| claude-sonnet-4-6 | $3/MTok  | $15/MTok | $0.30/MTok | $3.75/MTok  |
| claude-haiku-4-5  | $0.80/MTok | $4/MTok | $0.08/MTok | $1.00/MTok |

**Note:** Claude Code subscription users do not pay these per-token rates. Cost estimates are for reference and relative comparison only.

---

## Refresh Strategy

| Trigger | Action |
|---|---|
| `fs.watch` on `~/.claude/projects/` (recursive) | Reload sessions on any JSONL change |
| `fs.watch` on `~/.claude/activity.jsonl` | Reload activity feed on append |
| 60s interval timer | Fallback refresh (catches missed watch events) |
| Manual `claudeUsage.refresh` command | Immediate reload |

---

## Extension Manifest

- **Activation**: `onStartupFinished` — loads passively on VS Code start
- **Commands**: `claudeUsage.openPanel`, `claudeUsage.refresh`
- **Status bar**: Right alignment, priority 100

---

## Build

```bash
npm install
npm run build       # esbuild → dist/extension.js
npm run watch       # incremental rebuild
```

No webpack. esbuild only. Bundle target: Node CJS (VS Code extension host).

---

## Open Questions / Future

- [ ] Per-project cost budget alerts (threshold notification)
- [ ] Export CSV of daily usage
- [ ] Support for multiple Claude Code installations / profiles
- [ ] Show cache hit rate as efficiency metric
