# Contributing

Thanks for your interest in contributing to Claude Usage Monitor!

## Development Setup

```bash
git clone https://github.com/gauravs19/claude-usage-monitor
cd claude-usage-monitor
npm install
npm run watch  # auto-rebuild on save
```

Then press `F5` in VS Code to launch an Extension Development Host.

## Project Structure

```
src/
  extension.ts         # Activation, wiring, lifecycle
  statusBar.ts         # Status bar display + colour thresholds
  activityWatcher.ts   # Watches activity.jsonl (incremental reads)
  statusLineWatcher.ts # Watches statusline-live.json (debounced)
  usageParser.ts       # Parses JSONL session logs → aggregates
  sessionDetector.ts   # Resolves active session from PID files
  webviewPanel.ts      # Dashboard webview (HTML + JS)
  types.ts             # Shared types, pricing, context limits

hooks/
  activity-logger.js   # Claude Code hook → writes activity.jsonl
  statusline-bridge.js # Claude Code statusLine → writes live JSON
```

## Making Changes

1. Fork the repo and create a branch from `main`
2. Make your changes
3. Test locally with `F5` (Extension Development Host)
4. Ensure `npm run build` succeeds with no errors
5. Submit a pull request

## Reporting Issues

Please open an issue on GitHub with:
- Your VS Code version
- Your Claude Code version
- Steps to reproduce
- Expected vs actual behaviour

## Code Style

- TypeScript strict mode
- No external runtime dependencies (extension must be self-contained)
- Hook scripts must be pure Node.js (no npm dependencies)
- All file operations use `fs.watch` — no polling
