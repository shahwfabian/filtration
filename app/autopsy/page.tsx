import { LabShell } from "../../components/LabShell";
import { AutopsyClient } from "./AutopsyClient";

export default function AutopsyPage() {
  return <LabShell activePath="/autopsy" eyebrow="COUNTERFACTUAL REPLAY / OUTCOME-LEAKAGE FIREWALL" title="Decision Autopsy" status="EX-POST ONLY"><AutopsyClient /></LabShell>;
}
