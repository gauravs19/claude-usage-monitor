#!/usr/bin/env node
/**
 * Claude Code hook — writes tool activity to ~/.claude/activity.jsonl
 *
 * Configure in ~/.claude/settings.json:
 *   hooks.PreToolUse  → this script
 *   hooks.PostToolUse → this script
 *   hooks.Stop        → this script
 *
 * Claude Code passes event JSON via stdin.
 * CLAUDE_HOOK_EVENT env var identifies the event type.
 */

const fs   = require('fs');
const path = require('path');
const os   = require('os');

const ACTIVITY_FILE = path.join(os.homedir(), '.claude', 'activity.jsonl');
const EVENT = process.env.CLAUDE_HOOK_EVENT ?? 'PreToolUse';

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { raw += chunk; });
process.stdin.on('end', () => {
  try {
    const event = JSON.parse(raw || '{}');
    const record = buildRecord(EVENT, event);
    fs.appendFileSync(ACTIVITY_FILE, JSON.stringify(record) + '\n', 'utf8');
  } catch (e) {
    // Never crash — hooks must not block Claude
  }
  process.exit(0);
});

function buildRecord(eventType, event) {
  const base = { ts: Date.now(), event: eventType };

  if (eventType === 'PreToolUse') {
    return {
      ...base,
      tool: event.tool_name,
      summary: summarize(event.tool_name, event.tool_input),
    };
  }

  if (eventType === 'PostToolUse') {
    return {
      ...base,
      tool: event.tool_name,
      summary: summarize(event.tool_name, event.tool_input),
      durationMs: event.duration_ms ?? null,
      exitCode: event.tool_output?.exit_code ?? null,
    };
  }

  if (eventType === 'Stop') {
    return { ...base, summary: 'Session stopped' };
  }

  if (eventType === 'Notification') {
    return { ...base, summary: event.message ?? '' };
  }

  return base;
}

function summarize(tool, input) {
  if (!input) return '';
  switch (tool) {
    case 'Bash':
      return truncate(input.command ?? '', 80);
    case 'Read':
      return path.basename(input.file_path ?? '');
    case 'Write':
      return path.basename(input.file_path ?? '');
    case 'Edit':
      return path.basename(input.file_path ?? '');
    case 'Grep':
      return `"${truncate(input.pattern ?? '', 40)}"`;
    case 'Glob':
      return input.pattern ?? '';
    case 'WebFetch':
      return truncate(input.url ?? '', 60);
    case 'WebSearch':
      return truncate(input.query ?? '', 60);
    case 'Agent':
      return truncate(input.prompt ?? '', 60);
    default:
      return truncate(JSON.stringify(input), 60);
  }
}

function truncate(str, max) {
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}
