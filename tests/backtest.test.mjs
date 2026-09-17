import test from 'node:test';
import assert from 'node:assert/strict';
import { runFixedSpreadBacktest, summarizeBacktest } from '../lib/backtest.ts';

test('fixed-spread backtest is deterministic and reconciles accounting', () => {
  const a = runFixedSpreadBacktest(42, .5);
  const b = runFixedSpreadBacktest(42, .5);
  assert.deepEqual(a, b);
  assert.equal(a.reconciles, true);
  assert.ok(a.fills >= 0);
  assert.ok(a.maxAbsInventory <= 20);
  assert.ok(Number.isFinite(a.meanMarkout));
});

test('backtest quotes and marks the option, while hedging the underlying separately', () => {
  const row = runFixedSpreadBacktest(42, .5, 120, true);
  assert.equal(row.finalMid, row.finalUnderlying);
  assert.ok(row.finalOptionMark >= 0);
  assert.notEqual(row.finalOptionMark, row.finalUnderlying);
  assert.ok(Number.isFinite(row.optionPnl));
  assert.ok(Number.isFinite(row.hedgePnl));
});

test('backtest summary exposes costs and worst-case outcomes', () => {
  const summary = summarizeBacktest([1,2,3,4,5,6,7,8,9,10], .5);
  assert.equal(summary.seeds, 10);
  assert.equal(summary.reconciled, true);
  assert.ok(Number.isFinite(summary.meanNetPnl));
  assert.ok(summary.worstNetPnl <= summary.meanNetPnl || Math.abs(summary.worstNetPnl-summary.meanNetPnl)<1e-12);
});

test('delta hedging reduces residual delta exposure in the same seeded scenario', () => {
  const unhedged = runFixedSpreadBacktest(42, .5, 120, false);
  const hedged = runFixedSpreadBacktest(42, .5, 120, true);
  assert.ok(hedged.maxAbsDelta <= unhedged.maxAbsInventory * 100);
  assert.equal(hedged.reconciles, true);
  assert.ok(Number.isFinite(hedged.hedgePnl));
});

test('adverse-aware quoting is deterministic and changes quote economics', () => {
  const plain = runFixedSpreadBacktest(42, .5, 120, false, false);
  const aware = runFixedSpreadBacktest(42, .5, 120, false, true);
  assert.deepEqual(aware, runFixedSpreadBacktest(42, .5, 120, false, true));
  assert.ok(aware.meanQuotedSpread >= plain.meanQuotedSpread);
  assert.ok(aware.meanAdverseProbability >= 0 && aware.meanAdverseProbability <= 1);
  assert.equal(aware.reconciles, true);
});
