import assert from "node:assert/strict";
import test from "node:test";

import artifact from "../benchmarks/research-v2.json" with { type: "json" };
import { adjudicate } from "../lib/research/tribunal.ts";

test("tribunal derives a deployment block from stored hostile-regime evidence", () => {
  const verdict = adjudicate(artifact);
  assert.equal(verdict.verdict, "RESEARCH PASS · DEPLOYMENT BLOCKED");
  assert.ok(verdict.score < 100);
  assert.ok(verdict.findings.some(finding => finding.id === "T-004" && finding.severity === "HIGH"));
});

test("tribunal fails closed when an evidence count is inconsistent", () => {
  const tampered = structuredClone(artifact);
  tampered.evidenceCounts.reconciledRunCount -= 1;
  const verdict = adjudicate(tampered);
  assert.equal(verdict.verdict, "BLOCKED");
  assert.ok(verdict.findings.some(finding => finding.id === "T-002" && finding.severity === "CRITICAL"));
});

test("tribunal discloses when the gain is not attributable to the adaptive mechanism", () => {
  const verdict = adjudicate(artifact);
  const finding = verdict.findings.find(item => item.id === "T-006");
  assert.ok(finding, "stored train attribution should produce T-006");
  assert.equal(finding.severity, "MEDIUM");

  const attributed = structuredClone(artifact);
  for (const step of attributed.train.attribution.steps) step.confidenceInterval = [1, 2];
  assert.equal(adjudicate(attributed).findings.some(item => item.id === "T-006"), false);
});
