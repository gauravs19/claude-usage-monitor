import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { EventEmitter } from 'events';

const LIVE_FILE = path.join(os.homedir(), '.claude', 'statusline-live.json');

export interface LiveSessionData {
  _ts: number;
  transcript_path?: string;
  cwd?: string;
  model?: { id?: string; display_name?: string };
  context_window?: {
    context_window_size?: number;
    used_percentage?: number | null;
    remaining_percentage?: number | null;
    current_usage?: {
      input_tokens?: number;
      output_tokens?: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
    } | null;
  };
  rate_limits?: {
    five_hour?: { used_percentage?: number | null; resets_at?: number | null } | null;
    seven_day?:  { used_percentage?: number | null; resets_at?: number | null } | null;
  } | null;
}

export class StatusLineWatcher extends EventEmitter {
  private watcher: fs.FSWatcher | null = null;
  private data: LiveSessionData | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;

  start(): void {
    this.readFile();

    const dir = path.dirname(LIVE_FILE);
    if (!fs.existsSync(dir)) return;

    try {
      this.watcher = fs.watch(LIVE_FILE, { persistent: false }, () => {
        // Debounce — Claude Code writes ~every 300ms; only process on idle
        if (this.debounceTimer) clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => this.readFile(), 150);
      });
    } catch {
      // File may not exist yet; watch parent dir for creation
      try {
        const dirWatcher = fs.watch(dir, { persistent: false }, (_, filename) => {
          if (filename === 'statusline-live.json') {
            dirWatcher.close();
            this.readFile();
            this.start();
          }
        });
      } catch { /* ignore */ }
    }
  }

  stop(): void {
    this.watcher?.close();
    this.watcher = null;
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
  }

  getData(): LiveSessionData | null {
    return this.data;
  }

  /** Resolved context % — prefers native Claude value, falls back to computed */
  getContextPct(): number | null {
    const ctx = this.data?.context_window;
    if (!ctx) return null;
    if (ctx.used_percentage != null) return ctx.used_percentage;
    const u = ctx.current_usage;
    if (!u || !ctx.context_window_size) return null;
    const total = (u.input_tokens ?? 0)
      + (u.cache_creation_input_tokens ?? 0)
      + (u.cache_read_input_tokens ?? 0);
    return (total / ctx.context_window_size) * 100;
  }

  /** Returns rate limit usage if available (subscription users) */
  getRateLimits(): { fiveHourPct: number | null; sevenDayPct: number | null; fiveHourResetsAt: Date | null } {
    const rl = this.data?.rate_limits;
    return {
      fiveHourPct:     rl?.five_hour?.used_percentage  ?? null,
      sevenDayPct:     rl?.seven_day?.used_percentage  ?? null,
      fiveHourResetsAt: rl?.five_hour?.resets_at != null
        ? new Date(rl.five_hour.resets_at * 1000)
        : null,
    };
  }

  private readFile(): void {
    try {
      if (!fs.existsSync(LIVE_FILE)) return;
      const raw = fs.readFileSync(LIVE_FILE, 'utf8');
      const parsed: LiveSessionData = JSON.parse(raw);
      this.data = parsed;
      this.emit('update', parsed);
    } catch { /* malformed write in progress — skip */ }
  }
}
