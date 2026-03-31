import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { SessionSummary, DaySummary, estimateCost } from './types';

const CLAUDE_DIR = path.join(os.homedir(), '.claude', 'projects');

interface RawAssistantLine {
  type: 'assistant';
  sessionId: string;
  slug?: string;
  cwd?: string;
  timestamp: string;
  message?: {
    model?: string;
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
    };
  };
}

function projectNameFromCwd(cwd: string): string {
  if (!cwd) return 'unknown';
  return path.basename(cwd.replace(/\\/g, '/'));
}

function parseJSONLFile(filePath: string): RawAssistantLine[] {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return content
      .split('\n')
      .filter(Boolean)
      .map(line => { try { return JSON.parse(line); } catch { return null; } })
      .filter((l): l is RawAssistantLine => l?.type === 'assistant' && !!l.message?.usage);
  } catch {
    return [];
  }
}

export function loadAllSessions(): SessionSummary[] {
  if (!fs.existsSync(CLAUDE_DIR)) return [];

  const sessions = new Map<string, SessionSummary>();

  try {
    const projectDirs = fs.readdirSync(CLAUDE_DIR);
    for (const dir of projectDirs) {
      const dirPath = path.join(CLAUDE_DIR, dir);
      let files: string[];
      try {
        const stat = fs.statSync(dirPath);
        if (stat.isDirectory()) {
          files = fs.readdirSync(dirPath).filter(f => f.endsWith('.jsonl')).map(f => path.join(dirPath, f));
        } else if (dir.endsWith('.jsonl')) {
          files = [dirPath];
        } else {
          continue;
        }
      } catch {
        continue;
      }

      for (const file of files) {
        const lines = parseJSONLFile(file);
        for (const line of lines) {
          const sid = line.sessionId;
          const usage = line.message!.usage!;
          const model = line.message!.model ?? 'claude-sonnet-4-6';

          if (!sessions.has(sid)) {
            sessions.set(sid, {
              sessionId: sid,
              slug: line.slug ?? sid.slice(0, 8),
              project: projectNameFromCwd(line.cwd ?? ''),
              firstTs: line.timestamp,
              lastTs: line.timestamp,
              turns: 0,
              inputTokens: 0,
              outputTokens: 0,
              cacheReadTokens: 0,
              cacheCreateTokens: 0,
              model,
              estimatedCostUsd: 0,
            });
          }

          const s = sessions.get(sid)!;
          s.turns++;
          s.inputTokens       += usage.input_tokens ?? 0;
          s.outputTokens      += usage.output_tokens ?? 0;
          s.cacheReadTokens   += usage.cache_read_input_tokens ?? 0;
          s.cacheCreateTokens += usage.cache_creation_input_tokens ?? 0;
          if (line.timestamp > s.lastTs) s.lastTs = line.timestamp;
          if (line.timestamp < s.firstTs) s.firstTs = line.timestamp;
          s.estimatedCostUsd = estimateCost(s);
        }
      }
    }
  } catch {
    // fs errors — return what we have
  }

  return Array.from(sessions.values()).sort((a, b) => b.lastTs.localeCompare(a.lastTs));
}

export function aggregateByDay(sessions: SessionSummary[]): DaySummary[] {
  const days = new Map<string, DaySummary>();

  for (const s of sessions) {
    const date = s.lastTs.slice(0, 10); // YYYY-MM-DD
    if (!days.has(date)) {
      days.set(date, { date, inputTokens: 0, outputTokens: 0, turns: 0, estimatedCostUsd: 0, sessions: 0 });
    }
    const d = days.get(date)!;
    d.inputTokens       += s.inputTokens;
    d.outputTokens      += s.outputTokens;
    d.turns             += s.turns;
    d.estimatedCostUsd  += s.estimatedCostUsd;
    d.sessions++;
  }

  return Array.from(days.values()).sort((a, b) => b.date.localeCompare(a.date));
}

export function getClaudeProjectDir(): string {
  return CLAUDE_DIR;
}
