import artifact from "../../benchmarks/research-v2.json";
import { LabShell } from "../../components/LabShell";
import { StressClient } from "./StressClient";

export default function StressPage() {
  const cases = artifact.stresses.map(stress => ({
    name: stress.name,
    summaries: stress.summaries,
    changes: Object.entries(stress.config).filter(([key, value]) => value !== artifact.baseConfig[key as keyof typeof artifact.baseConfig]).map(([key, value]) => `${key}=${value}`),
  }));
  return <LabShell activePath="/stress" eyebrow="HOSTILE ENVIRONMENTS / IDENTICAL FINAL SEEDS" title="Stress Laboratory" status="FAILURES INCLUDED"><StressClient cases={cases} /></LabShell>;
}
