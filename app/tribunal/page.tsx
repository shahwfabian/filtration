import artifact from "../../benchmarks/research-v2.json";
import { LabShell } from "../../components/LabShell";
import { adjudicate } from "../../lib/research/tribunal";

export default function TribunalPage() {
  const audit = adjudicate(artifact);
  return <LabShell activePath="/tribunal" eyebrow="DERIVED FINDINGS / NO MANUAL VERDICT FLAGS" title="Evidence Tribunal" status="FAIL-CLOSED">
    <section className="tribunal-hero panel"><div><p className="eyebrow">VERDICT</p><h2>{audit.verdict}</h2><p>The score is recomputed from the stored seed manifest, accounting invariants, held-out interval, stress outcomes, and declared evidence domain. The interface cannot independently assert a pass.</p></div><div className="verdict-score"><strong>{audit.score}</strong><span>evidence score / 100</span></div></section>
    <section className="panel tribunal-findings"><div className="panel-head"><span>DERIVED FINDINGS · {audit.findings.length}</span><em>SEVERITY / EVIDENCE / REMEDIATION</em></div>{audit.findings.map(finding => <article className="finding" key={finding.id}><div className={`severity ${finding.severity.toLowerCase()}`}>{finding.severity}</div><div><strong>{finding.id} · {finding.title}</strong><p>{finding.evidence}</p><small>Required next step · {finding.remediation}</small></div></article>)}</section>
    <p className="footnote"><span>NO LLM-GENERATED VERDICT</span><span>NO MANUAL PASS BOOLEAN</span><span>HOSTILE REGIMES REMAIN VISIBLE</span></p>
  </LabShell>;
}
