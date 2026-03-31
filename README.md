# Claude Usage Monitor

> VS Code extension — real-time Claude Code token usage, subscription rate limits, and session efficiency in the status bar.

![VS Code](https://img.shields.io/badge/VS%20Code-%5E1.85.0-blue) ![License](https://img.shields.io/badge/license-MIT-green)

---

## What it does

Claude Code gives you no ambient visibility into what's being consumed or what it's doing during long processing runs. This extension fixes that.

**Status bar (always visible):**
- Idle: `ctx:45% 5h:12% 7d:3%` — context window pressure + subscription rate limits
- Active: `⟳ Editing: extension.ts` — live tool activity, spins while Claude works
- Colour-coded: yellow at 60%, red at 80% on any metric

**Click → Dashboard panel:**

| Section | What you get |
|---|---|
| Summary cards | Today's tokens, cost estimate, context gauge, 5h/7d rate limits |
| Activity feed | Last 30 tool calls — tool name, what it was doing, duration |
| Efficiency panel | Tool distribution chart, Bash error rate, context efficiency ratio |
| Sessions table | Per-session: model, turns, tokens/turn, cache hit %, context %, cost |
| Daily table | 14-day aggregate — sessions, turns, tokens, estimated cost |

---

## Data sources

Three complementary sources, no external API calls:

| Source | What it provides | Latency |
|---|---|---|
| `~/.claude/projects/**/*.jsonl` | Full session history, token counts per turn | On turn-end |
| `~/.claude/activity.jsonl` | Live tool activity (hook-written) | ~instant (async) |
| `~/.claude/statusline-live.json` | Real-time context %, rate limits, transcript path | ~300ms (native statusLine API) |

---

## Install

### 1. Build the extension

```bash
git clone https://github.com/gauravs19/claude-usage-monitor
cd claude-usage-monitor
npm install
npm run build
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

## Status bar states

| State | Display | Meaning |
|---|---|---|
| Idle (subscription) | `⊙ ctx:45% 5h:12% 7d:3%` | Context + rate limit usage |
| Idle (API key) | `⊙ 42K↑ 8K↓ ctx:45%` | Tokens + context |
| Active tool | `⟳ Shell: npm test` | Claude is running a command |
| Warning | Yellow background | Any metric ≥ 60% |
| Critical | Red background | Any metric ≥ 80% |

Hover for a rich tooltip: model, session, turns, tokens/turn, rate limit reset time.

---

## Efficiency metrics

The dashboard's **Efficiency** panel helps you understand how a session is going:

| Metric | What it means |
|---|---|
| **Tool distribution** | Which tools Claude is spending time on (bar chart + avg duration) |
| **Bash error rate** | `exitCode != 0` / total Bash calls — high = Claude is thrashing on commands |
| **Context efficiency** | `output tokens / input tokens` — low = lots of reading, little output |
| **Action ratio** | `(Read + Write + Edit) / total calls` — high = editing-heavy session |

---

## Architecture

```
~/.claude/projects/**/*.jsonl   →  usageParser.ts    →  session/day aggregates
~/.claude/activity.jsonl        →  activityWatcher.ts →  live tool feed + efficiency
~/.claude/statusline-live.json  →  statusLineWatcher.ts→  real-time ctx%, rate limits

All three → extension.ts → statusBar.ts + webviewPanel.ts
```

**Key design decisions:**
- `fs.watch` (not polling) on all data files — low overhead
- Incremental JSONL reads — tracks byte offset, never re-reads full files
- Hook scripts run `async: true` — never block Claude's tool execution
- `activity.jsonl` rotates at 2MB — keeps last 50% of lines
- Session resolved by matching `transcript_path` from statusLine → pid file → recency fallback

---

## How it compares to claude-hud

[claude-hud](https://github.com/jarrodwatts/claude-hud) is a terminal statusLine plugin. This extension is complementary, not competing:

| | claude-hud | This extension |
|---|---|---|
| Surface | Terminal status line | VS Code status bar + webview |
| History | Current session only | All sessions, 14-day daily view |
| Rate limits | Yes | Yes (from statusLine bridge) |
| Cost estimate | No | Yes (API pricing approximation) |
| Efficiency metrics | No | Yes (tool breakdown, error rate) |
| Project filter | No | Yes (workspace-scoped) |

Both can coexist — the statusLine bridge outputs the same compact line claude-hud would show in the terminal.

---

## Commands

| Command | Action |
|---|---|
| `Claude Usage: Open Dashboard` | Open the webview panel |
| `Claude Usage: Refresh` | Force reload all session data |

---

## Requirements

- VS Code `^1.85.0`
- Node.js `18+` (for hook scripts)
- Claude Code `2.1+`

---

## License

MIT
