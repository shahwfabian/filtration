import { summarizeBacktest } from "./backtest.ts";
import { policyCandidates, type PolicyCandidate } from "./validation.ts";

export type RealityCheckResult={candidateMeans:{name:string;meanNetPnl:number}[];observedMaxMean:number;bootstrapPValue:number;resamples:number;seeds:number;reconciled:boolean;method:string;benchmark:string};
function rng(seed:number){let x=seed>>>0;return()=>{x=(1664525*x+1013904223)>>>0;return x/4294967296;};}
function mean(xs:number[]){return xs.reduce((a,b)=>a+b,0)/xs.length;}

/**
 * A compact White-style max-mean bootstrap diagnostic. Each candidate's
 * per-seed P&L is centered before resampling, then the maximum candidate mean
 * is recomputed. This controls the candidate-family search in the null
 * bootstrap, but is not a substitute for dependent-return or live-data
 * inference.
 */
export function realityCheck(seeds:number[],candidates:PolicyCandidate[]=policyCandidates,resamples=2000,seed=7701):RealityCheckResult{
  if(seeds.length<10)throw new RangeError("Reality Check requires at least 10 seeds");
  if(!candidates.length)throw new RangeError("Reality Check requires at least one candidate");
  const rows=candidates.map(policy=>summarizeBacktest(seeds,policy.spread,policy.hedged,policy.adverseAware,policy.overrides).rows);
  const series=rows.map(candidateRows=>candidateRows.map(row=>row.netPnl));
  const candidateMeans=series.map((values,index)=>({name:candidates[index].name,meanNetPnl:mean(values)}));
  const observedMaxMean=Math.max(...candidateMeans.map(row=>row.meanNetPnl));
  const benchmark=series[0];
  const differentials=series.map(values=>values.map((value,index)=>value-benchmark[index]));
  const centered=differentials.map(values=>{const m=mean(values);return values.map(value=>value-m);});
  const draw=rng(seed);let exceed=0;
  for(let b=0;b<resamples;b++){
    const indices=Array.from({length:seeds.length},()=>Math.floor(draw()*seeds.length));
    const bootstrapMeans=centered.map(values=>indices.reduce((total,index)=>total+values[index],0)/seeds.length);
    if(Math.max(...bootstrapMeans)>=observedMaxMean-mean(benchmark))exceed++;
  }
  return {candidateMeans,observedMaxMean,bootstrapPValue:(exceed+1)/(resamples+1),resamples,seeds:seeds.length,reconciled:rows.every(candidateRows=>candidateRows.every(row=>row.reconciles)),method:"Paired centered max-mean bootstrap over candidate-minus-benchmark differentials",benchmark:candidates[0].name};
}
