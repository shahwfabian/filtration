import Link from "next/link";
import type { ReactNode } from "react";

const navigation = [
  ["00", "Research Overview", "/"],
  ["01", "Pricing Laboratory", "/pricing"],
  ["02", "Trading Arena", "/arena"],
  ["03", "Policy Comparison", "/strategy"],
  ["04", "Stress Laboratory", "/stress"],
  ["05", "Untouched Validation", "/validation"],
  ["06", "Paired Inference", "/inference"],
  ["07", "Decision Autopsy", "/autopsy"],
  ["08", "Evidence Tribunal", "/tribunal"],
  ["09", "Methodology", "/methodology"],
] as const;

export function LabShell({
  activePath,
  eyebrow,
  title,
  status,
  children,
}: {
  activePath: string;
  eyebrow: string;
  title: string;
  status: string;
  children: ReactNode;
}) {
  return <main className="app-shell">
    <aside>
      <Link href="/" className="brand" aria-label="Filtration research overview">
        <div className="mark">Σ</div>
        <div><strong>FILTRATION</strong><small>𝓕ₜ / RESEARCH LAB</small></div>
      </Link>
      <nav aria-label="Research modules">
        {navigation.map(([index, label, href]) => <Link
          key={href}
          href={href}
          className={activePath === href ? "nav-link nav-current" : "nav-link"}
        ><span className="nav-index">{index}</span>{label}</Link>)}
      </nav>
      <div className="sidebar-bottom">
        <div className="status"><span className="dot" />RESEARCH ENGINE</div>
        <p>Synthetic experiment<br />No live-performance claim</p>
        <a href="https://github.com/shahwfabian/filtration" target="_blank" rel="noreferrer">SOURCE ↗</a>
      </div>
    </aside>
    <section className="workspace">
      <div className="mobile-nav" aria-label="Mobile research navigation">
        {navigation.map(([index, label, href]) => <Link key={href} href={href} aria-current={activePath === href ? "page" : undefined}>{index} {label}</Link>)}
      </div>
      <header>
        <div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1></div>
        <div className="header-actions"><span className="chip"><span className="dot" />{status}</span><div className="avatar">SF</div></div>
      </header>
      {children}
    </section>
  </main>;
}

export function Metric({ label, value, sub, tone = "" }: { label: string; value: string; sub: string; tone?: string }) {
  return <div className={`metric ${tone}`}><span>{label}</span><strong>{value}</strong><small>{sub}</small></div>;
}
