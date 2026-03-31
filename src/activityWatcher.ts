import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { EventEmitter } from 'events';
import { ActivityRecord } from './types';

const ACTIVITY_FILE = path.join(os.homedir(), '.claude', 'activity.jsonl');
const MAX_RECORDS = 50;

export class ActivityWatcher extends EventEmitter {
  private fileOffset = 0;
  private watcher: fs.FSWatcher | null = null;
  private records: ActivityRecord[] = [];
  private activeToolTimer: NodeJS.Timeout | null = null;
  private activeTool: string | null = null;
  private activeSummary: string | null = null;

  start(): void {
    // Read existing records first
    this.readNewLines();

    // Watch for new writes
    const dir = path.dirname(ACTIVITY_FILE);
    if (!fs.existsSync(dir)) return;

    try {
      this.watcher = fs.watch(ACTIVITY_FILE, { persistent: false }, (event) => {
        if (event === 'change') this.readNewLines();
      });
    } catch {
      // File doesn't exist yet — watch parent dir for creation
      try {
        const dirWatcher = fs.watch(dir, { persistent: false }, (event, filename) => {
          if (filename === 'activity.jsonl') {
            dirWatcher.close();
            this.readNewLines();
            this.start(); // re-attach file watcher
          }
        });
      } catch { /* ignore */ }
    }
  }

  stop(): void {
    this.watcher?.close();
    this.watcher = null;
    if (this.activeToolTimer) clearTimeout(this.activeToolTimer);
  }

  getRecords(): ActivityRecord[] {
    return [...this.records];
  }

  getActiveTool(): { tool: string; summary: string } | null {
    if (!this.activeTool) return null;
    return { tool: this.activeTool, summary: this.activeSummary ?? '' };
  }

  private readNewLines(): void {
    try {
      if (!fs.existsSync(ACTIVITY_FILE)) return;
      const stat = fs.statSync(ACTIVITY_FILE);
      if (stat.size <= this.fileOffset) return;

      const fd = fs.openSync(ACTIVITY_FILE, 'r');
      const buf = Buffer.alloc(stat.size - this.fileOffset);
      fs.readSync(fd, buf, 0, buf.length, this.fileOffset);
      fs.closeSync(fd);
      this.fileOffset = stat.size;

      const lines = buf.toString('utf8').split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const record: ActivityRecord = JSON.parse(line);
          this.records.push(record);
          if (this.records.length > MAX_RECORDS) this.records.shift();
          this.handleRecord(record);
        } catch { /* malformed line */ }
      }
    } catch { /* file read error */ }
  }

  private handleRecord(record: ActivityRecord): void {
    if (record.event === 'PreToolUse') {
      this.activeTool = record.tool ?? null;
      this.activeSummary = record.summary ?? null;

      // Auto-clear after 2 min in case PostToolUse hook isn't configured
      if (this.activeToolTimer) clearTimeout(this.activeToolTimer);
      this.activeToolTimer = setTimeout(() => {
        this.activeTool = null;
        this.activeSummary = null;
        this.emit('activity', record);
      }, 120_000);

      this.emit('activity', record);
    } else if (record.event === 'PostToolUse' || record.event === 'Stop') {
      this.activeTool = null;
      this.activeSummary = null;
      if (this.activeToolTimer) clearTimeout(this.activeToolTimer);
      this.emit('activity', record);
    }
  }
}
