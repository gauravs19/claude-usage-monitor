# Changelog

All notable changes to the Claude Usage Monitor extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.4] - 2026-03-31
### Added
- **Estimated Time Saved Panel**: Added an explicit ROI calculator to the right of the efficiency panel. Automatically breaks down the exact hours/minutes saved by combining Code Writing, Reading Context, and Executing Tool time compared to a human typing baseline.
- **Premium Dashboard Upgrade**: Fully revamped webview dashboard CSS with glassmorphism card backgrounds, animated sweeping gradients on focus, staggered entrance animations, and sleek pills for the Live Activity Feed.

## [0.1.3] - 2026-03-31
### Added
- **Marketplace Launch Ready**: Standardized README, streamlined installation process, and optimized `.vscodeignore` payload size.
- Inserted `galleryBanner` to ensure a premium look in the VS Code Marketplace.

## [0.1.0] - 2026-03-31
### Added
- **Status bar** — real-time display of context window %, 5-hour and 7-day rate limits.
- **Live tool activity** — spinning indicator showing what Claude is doing (Shell, Editing, Reading, etc.).
- **Colour-coded warnings** — yellow at 60%, red at 80% on any metric.
- **Dashboard panel** with:
  - Summary cards: today's tokens, cost estimate, context gauge, rate limits.
  - Activity feed: last 30 tool calls with name, summary, and duration.
  - Efficiency panel: tool distribution, Bash error rate, context efficiency, action ratio.
  - Sessions table: per-session model, turns, tokens/turn, cache hit %, context %, cost.
  - Daily table: 14-day aggregate usage.
- **Project filtering** — filter sessions by workspace project.
- **Session detection** — resolves active session via statusLine transcript path, PID file, or recency fallback.
- **Hook scripts**:
  - `activity-logger.js` — logs PreToolUse, PostToolUse, and Stop events to `~/.claude/activity.jsonl`.
  - `statusline-bridge.js` — bridges Claude's statusLine API to `~/.claude/statusline-live.json`.
- **Incremental file reads** — tracks byte offset, never re-reads full JSONL files.
- **Auto-rotation** — `activity.jsonl` rotates at 2MB, keeping last 50% of lines.
