import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const SESSIONS_DIR = path.join(os.homedir(), '.claude', 'sessions');

interface LiveSession {
  pid: number;
  sessionId: string;
  cwd: string;
  startedAt: number;
  kind: string;
  entrypoint: string;
}

/**
 * Returns the sessionId of the Claude Code process currently running
 * in the given workspace directory, or null if none found.
 *
 * Falls back to most-recently-started session if no cwd match.
 */
export function detectActiveSessionId(workspaceCwd?: string): string | null {
  if (!fs.existsSync(SESSIONS_DIR)) return null;

  const sessions: LiveSession[] = [];

  try {
    for (const file of fs.readdirSync(SESSIONS_DIR)) {
      if (!file.endsWith('.json')) continue;
      try {
        const raw = fs.readFileSync(path.join(SESSIONS_DIR, file), 'utf8');
        const s: LiveSession = JSON.parse(raw);
        if (s.sessionId && isProcessAlive(s.pid)) {
          sessions.push(s);
        }
      } catch { /* malformed or already gone */ }
    }
  } catch { return null; }

  if (sessions.length === 0) return null;

  // Prefer session whose cwd matches current workspace
  if (workspaceCwd) {
    const normalised = workspaceCwd.replace(/\\/g, '/').toLowerCase();
    const match = sessions.find(s =>
      s.cwd?.replace(/\\/g, '/').toLowerCase() === normalised
    );
    if (match) return match.sessionId;
  }

  // Fallback: most recently started
  sessions.sort((a, b) => b.startedAt - a.startedAt);
  return sessions[0].sessionId;
}

function isProcessAlive(pid: number): boolean {
  try {
    // Signal 0 = existence check, throws if process doesn't exist
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
