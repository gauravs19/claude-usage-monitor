# Changelog

## [0.1.0] — 2026-03-31

### Added

- **Status bar** — real-time display of context window %, 5-hour and 7-day rate limits
- **Live tool activity** — spinning indicator showing what Claude is doing (Shell, Editing, Reading, etc.)
- **Colour-coded warnings** — yellow at 60%, red at 80% on any metric
- **Dashboard panel** with:
  - Summary cards: today's tokens, cost estimate, context gauge, rate limits
  - Activity feed: last 30 tool calls with name, summary, and duration
  - Efficiency panel: tool distribution, Bash error rate, context efficiency, action ratio
  - Sessions table: per-session model, turns, tokens/turn, cache hit %, context %, cost
  - Daily table: 14-day aggregate usage
- **Project filtering** — filter sessions by workspace project
- **Session detection** — resolves active session via statusLine transcript path, PID file, or recency fallback
- **Hook scripts**:
  - `activity-logger.js` — logs PreToolUse, PostToolUse, and Stop events to `~/.claude/activity.jsonl`
  - `statusline-bridge.js` — bridges Claude's statusLine API to `~/.claude/statusline-live.json` for the extension
- **Incremental file reads** — tracks byte offset, never re-reads full JSONL files
- **Auto-rotation** — `activity.jsonl` rotates at 2MB, keeping last 50% of lines
