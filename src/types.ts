export interface TurnUsage {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  model: string;
  timestamp: string;
  sessionId: string;
  slug: string;
  project: string; // derived from cwd
}

export interface SessionSummary {
  sessionId: string;
  slug: string;
  project: string;
  firstTs: string;
  lastTs: string;
  turns: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreateTokens: number;
  model: string;
  estimatedCostUsd: number;
  contextPct: number;        // % of model context window used (0–100)
  tokensPerTurn: number;     // average tokens consumed per turn
}

// Context window limits per model (tokens)
export const CONTEXT_LIMITS: Record<string, number> = {
  'claude-opus-4-6':   200_000,
  'claude-sonnet-4-6': 200_000,
  'claude-haiku-4-5':  200_000,
  default:             200_000,
};

export function contextPct(session: Pick<SessionSummary, 'inputTokens' | 'cacheReadTokens' | 'cacheCreateTokens' | 'outputTokens' | 'model'>): number {
  const limit = CONTEXT_LIMITS[session.model] ?? CONTEXT_LIMITS['default'];
  // Approximate: last-turn input context ≈ cumulative input + cache tokens (they accumulate in context)
  const total = session.inputTokens + session.cacheReadTokens + session.cacheCreateTokens;
  return Math.min(100, Math.round((total / limit) * 100));
}

export interface DaySummary {
  date: string; // YYYY-MM-DD
  inputTokens: number;
  outputTokens: number;
  turns: number;
  estimatedCostUsd: number;
  sessions: number;
}

export interface ActivityRecord {
  ts: number;
  event: 'PreToolUse' | 'PostToolUse' | 'Stop' | 'Notification';
  tool?: string;
  summary?: string;
  durationMs?: number;
  exitCode?: number;
  sessionId?: string;
}

export interface ToolStat {
  tool: string;
  calls: number;
  errors: number;       // exitCode !== 0
  totalDurationMs: number;
}

export interface EfficiencyStats {
  toolBreakdown: ToolStat[];         // sorted by calls desc
  bashErrorRate: number;             // 0–1
  avgToolDurationMs: Record<string, number>;
  contextEfficiency: number | null;  // outputTokens / totalInputTokens (0–1)
  totalToolCalls: number;
  sessionCostUsd?: number;
  isRunaway?: boolean;               // Based on high bash error rate in a short window
  budgetExceeded?: boolean;          // Based on user-defined session limit
  fileStats?: Record<string, number>; // path -> call count
  dailyScore?: number;
  grade?: string;
}

// Pricing per million tokens (API rates — approximation for subscription users)
export const PRICING: Record<string, { input: number; output: number; cacheRead: number; cacheCreate: number }> = {
  'claude-opus-4-6':    { input: 15.00, output: 75.00, cacheRead: 1.50,  cacheCreate: 18.75 },
  'claude-sonnet-4-6':  { input:  3.00, output: 15.00, cacheRead: 0.30,  cacheCreate:  3.75 },
  'claude-haiku-4-5':   { input:  0.80, output:  4.00, cacheRead: 0.08,  cacheCreate:  1.00 },
  default:              { input:  3.00, output: 15.00, cacheRead: 0.30,  cacheCreate:  3.75 },
};

export function estimateCost(usage: Pick<SessionSummary, 'inputTokens' | 'outputTokens' | 'cacheReadTokens' | 'cacheCreateTokens' | 'model'>): number {
  const p = PRICING[usage.model] ?? PRICING['default'];
  return (
    (usage.inputTokens      * p.input       / 1_000_000) +
    (usage.outputTokens     * p.output      / 1_000_000) +
    (usage.cacheReadTokens  * p.cacheRead   / 1_000_000) +
    (usage.cacheCreateTokens * p.cacheCreate / 1_000_000)
  );
}
