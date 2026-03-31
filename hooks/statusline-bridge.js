#!/usr/bin/env node
/**
 * Claude Code statusLine bridge
 *
 * Configured via settings.json:
 *   "statusLine": { "type": "command", "command": "node ~/.claude/hooks/statusline-bridge.js" }
 *
 * Claude Code calls this ~every 300ms during active sessions, sending
 * session state JSON via stdin. We:
 *   1. Write the raw JSON to ~/.claude/statusline-live.json (VS Code extension reads it)
 *   2. Output a compact one-liner to stdout (shown in Claude's terminal status bar)
 */

const fs   = require('fs');
const os   = require('os');
const path = require('path');

const LIVE_FILE = path.join(os.homedir(), '.claude', 'statusline-live.json');

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', c => { raw += c; });
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(raw || '{}');

    // Write for VS Code extension to consume
    fs.writeFileSync(LIVE_FILE, JSON.stringify({ ...data, _ts: Date.now() }), 'utf8');

    // Render compact terminal status line
    process.stdout.write(renderLine(data) + '\n');
  } catch {
    process.stdout.write('\n');
  }
});

function renderLine(data) {
  const parts = [];

  const model = data.model?.display_name ?? data.model?.id ?? '';
  if (model) parts.push(model.replace('Claude ', '').replace(' (claude.ai)', ''));

  const ctx = data.context_window;
  if (ctx) {
    const pct = ctx.used_percentage ?? computePct(ctx);
    if (pct !== null) parts.push(`ctx:${Math.round(pct)}%`);
  }

  const rl = data.rate_limits;
  if (rl?.five_hour?.used_percentage != null) {
    parts.push(`5h:${Math.round(rl.five_hour.used_percentage)}%`);
  }
  if (rl?.seven_day?.used_percentage != null) {
    parts.push(`7d:${Math.round(rl.seven_day.used_percentage)}%`);
  }

  return parts.join(' | ');
}

function computePct(ctx) {
  if (!ctx?.context_window_size || !ctx?.current_usage) return null;
  const u = ctx.current_usage;
  const total = (u.input_tokens ?? 0)
    + (u.cache_creation_input_tokens ?? 0)
    + (u.cache_read_input_tokens ?? 0);
  return (total / ctx.context_window_size) * 100;
}
