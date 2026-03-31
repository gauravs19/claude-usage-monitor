# Changelog

All notable changes to the Claude Usage Monitor extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.6] - 2026-03-31
### Added
- **Runaway Agent Kill Switch**: Added real-time detection for high bash failure rates. Notifies you in the status bar if the agent enters a "thrashing" loop.
- **Session Budget Alerts**: Set a mock $2.00 session budget with bright visual dashboard warnings when reached to prevent massive token burn.
- **Export Session to Markdown**: 1-click export of your entire tool usage sequence, costs, and efficiency metrics to a documented file.
- **File Heatmaps**: Visualize exactly which files Claude is reading/viewing most frequently via color-coded intensity mapping.
- **Prompt Engineer Score**: Gamified ranking (S to F) and normalized scoring based on session context efficiency and error minimize.

## [0.1.5] - 2026-03-31
### Added
- **1-Click Auto Install Hooks**: Replaced complex manual terminal instructions with a single button in the dashboard that safely locates and updates your `~/.claude/settings.json` and local hook scripts automatically. Zero setup friction.

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
