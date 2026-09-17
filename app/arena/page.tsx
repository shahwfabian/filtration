import { LabShell } from "../../components/LabShell";
import { ArenaClient } from "./ArenaClient";

export default function ArenaPage() {
  return <LabShell activePath="/arena" eyebrow="SEQUENTIAL DECISION GAME / FUTURE STATE HIDDEN" title="Trading Arena" status="REPLAYABLE">
    <ArenaClient />
  </LabShell>;
}
