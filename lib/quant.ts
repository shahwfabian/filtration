export type Inputs = { spot: number; strike: number; maturity: number; vol: number; rate: number; dividend: number; paths: number; seed: number };
const SQRT2 = Math.sqrt(2);
export function normalCdf(x: number) { return 0.5 * (1 + erf(x / SQRT2)); }
function erf(x: number) { const sign = x < 0 ? -1 : 1; const a1=0.254829592,a2=-0.284496736,a3=1.421413741,a4=-1.453152027,a5=1.061405429,p=0.3275911; const t=1/(1+p*Math.abs(x)); return sign*(1-((((a5*t+a4)*t+a3)*t+a2)*t+a1)*t*Math.exp(-x*x)); }
export function bs(i: Inputs) { const {spot:S,strike:K,maturity:T,vol:sigma,rate:r,dividend:q}=i; if (![S,K,T,sigma,r,q].every(Number.isFinite)||S<0||K<=0||T<0||sigma<0) throw new RangeError("Invalid option inputs: require S≥0, K>0, T≥0, σ≥0 and finite rates"); if (T<=0) return {call:Math.max(S-K,0),put:Math.max(K-S,0),delta:S>K?1:0,gamma:0,vega:0,theta:0,rho:0}; if (S===0) return {call:0,put:K*Math.exp(-r*T),delta:0,gamma:0,vega:0,theta:0,rho:0}; if (sigma<=0) { const discS=S*Math.exp(-q*T),discK=K*Math.exp(-r*T); return {call:Math.max(discS-discK,0),put:Math.max(discK-discS,0),delta:discS>discK?Math.exp(-q*T):0,gamma:0,vega:0,theta:0,rho:0}; } const d1=(Math.log(S/K)+(r-q+sigma*sigma/2)*T)/(sigma*Math.sqrt(T)),d2=d1-sigma*Math.sqrt(T),pdf=Math.exp(-d1*d1/2)/Math.sqrt(2*Math.PI),call=S*Math.exp(-q*T)*normalCdf(d1)-K*Math.exp(-r*T)*normalCdf(d2),put=call-S*Math.exp(-q*T)+K*Math.exp(-r*T); return {call,put,delta:Math.exp(-q*T)*normalCdf(d1),gamma:Math.exp(-q*T)*pdf/(S*sigma*Math.sqrt(T)),vega:S*Math.exp(-q*T)*pdf*Math.sqrt(T),theta:-(S*Math.exp(-q*T)*pdf*sigma/(2*Math.sqrt(T)))-r*K*Math.exp(-r*T)*normalCdf(d2)+q*S*Math.exp(-q*T)*normalCdf(d1),rho:K*T*Math.exp(-r*T)*normalCdf(d2)}; }
function rng(seed:number) { let x=seed>>>0; return () => { x=(1664525*x+1013904223)>>>0; return x/4294967296; }; }
function gaussian(random:()=>number) { const u=Math.max(random(),1e-12),v=Math.max(random(),1e-12); return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v); }
export function monteCarlo(i: Inputs) {
  bs(i);
  if (!Number.isInteger(i.seed)) throw new RangeError("Monte Carlo seed must be an integer");
  if (!Number.isFinite(i.paths) || i.paths < 2) throw new RangeError("Monte Carlo paths must be at least 2");
  const random=rng(i.seed), requested=Math.floor(i.paths), pairCount=Math.max(50,Math.ceil(requested/2));
  const discount=Math.exp(-i.rate*i.maturity), pairValues:number[]=[], antitheticValues:number[]=[];
  for(let k=0;k<pairCount;k++){
    const z=gaussian(random), drift=(i.rate-i.dividend-i.vol*i.vol/2)*i.maturity, scale=i.vol*Math.sqrt(i.maturity);
    const st=i.spot*Math.exp(drift+scale*z), sa=i.spot*Math.exp(drift-scale*z);
    const payoff=Math.max(st-i.strike,0), antitheticPayoff=Math.max(sa-i.strike,0);
    pairValues.push(discount*(payoff+antitheticPayoff)/2);
    antitheticValues.push(discount*antitheticPayoff);
  }
  const mean=pairValues.reduce((a,b)=>a+b,0)/pairCount;
  const variance=pairValues.reduce((a,b)=>a+(b-mean)**2,0)/(pairCount-1);
  const se=Math.sqrt(variance/pairCount), z=1.96;
  const antiMean=antitheticValues.reduce((a,b)=>a+b,0)/pairCount;
  return {price:mean,se,low:mean-z*se,high:mean+z*se,antiMean, paths:pairCount*2};
}
export function gbmPath(i:Inputs, measure:"P"|"Q", count=44) { const random=rng(i.seed+measure.charCodeAt(0)), out=[i.spot], dt=i.maturity/count, drift=(measure==="P"?0.09:i.rate-i.dividend)-i.vol*i.vol/2; for(let k=0;k<count;k++) out.push(out[k]*Math.exp(drift*dt+i.vol*Math.sqrt(dt)*gaussian(random))); return out; }
export function martingaleDiagnostic(i:Inputs) { const n=10_000, random=rng(i.seed+7919), dt=i.maturity/30, drift=(i.rate-i.dividend-i.vol*i.vol/2)*dt, scale=i.vol*Math.sqrt(dt), discount=Math.exp(-i.rate*i.maturity), values:number[]=[]; for(let path=0;path<n;path++){let spot=i.spot; for(let step=0;step<30;step++) spot*=Math.exp(drift+scale*gaussian(random)); values.push(spot*discount); } const observed=values.reduce((a,b)=>a+b,0)/n, variance=values.reduce((a,b)=>a+(b-observed)**2,0)/(n-1), se=Math.sqrt(variance/n), expected=i.spot*Math.exp(-i.dividend*i.maturity); return {expected,observed,se,low:observed-1.96*se,high:observed+1.96*se,error:observed-expected}; }
