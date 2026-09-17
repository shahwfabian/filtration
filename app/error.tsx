"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="error-state"><section className="panel"><p className="eyebrow">CONTROLLED FAILURE</p><h1>The experiment could not be evaluated.</h1><p>The previous valid state has been preserved. Retry the calculation or return to the research overview.</p><button className="primary" onClick={reset}>Retry experiment</button></section></main>;
}

