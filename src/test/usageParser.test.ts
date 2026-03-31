import { describe, it, expect } from 'vitest';
import { aggregateByDay } from '../usageParser';
import { estimateCost, SessionSummary } from '../types';

describe('usageParser', () => {
  it('should aggregate sessions by day correctly', () => {
    const mockSessions: Partial<SessionSummary>[] = [
      { lastTs: '2024-03-31T10:00:00Z', inputTokens: 100, outputTokens: 50, turns: 1, estimatedCostUsd: 0.1 },
      { lastTs: '2024-03-31T15:00:00Z', inputTokens: 200, outputTokens: 100, turns: 2, estimatedCostUsd: 0.2 },
      { lastTs: '2024-03-30T10:00:00Z', inputTokens: 50, outputTokens: 25, turns: 1, estimatedCostUsd: 0.05 },
    ];

    const aggregated = aggregateByDay(mockSessions as SessionSummary[]);
    
    expect(aggregated.length).toBe(2);
    expect(aggregated[0].date).toBe('2024-03-31');
    expect(aggregated[0].inputTokens).toBe(300);
    expect(aggregated[0].sessions).toBe(2);
    
    expect(aggregated[1].date).toBe('2024-03-30');
    expect(aggregated[1].inputTokens).toBe(50);
    expect(aggregated[1].sessions).toBe(1);
  });
});

describe('types / estimateCost', () => {
  it('should calculate cost based on pricing tiers', () => {
    const usage = {
      model: 'claude-sonnet-4-6',
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
      cacheReadTokens: 0,
      cacheCreateTokens: 0
    };
    
    // Sonnet: $3.00 in, $15.00 out per million
    const cost = estimateCost(usage as any);
    expect(cost).toBe(18.00);
  });
});
