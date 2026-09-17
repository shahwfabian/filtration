export type StationaryBootstrapResult={observedMean:number;low:number;high:number;lag1Autocorrelation:number;meanBlockLength:number;resamples:number;method:string};
function rng(seed:number){let x=seed>>>0;return()=>{x=(1664525*x+1013904223)>>>0;return x/4294967296;};}
const mean=(xs:number[])=>xs.reduce((a,b)=>a+b,0)/xs.length;
const quantile=(xs:number[],q:number)=>{const a=[...xs].sort((x,y)=>x-y);const p=(a.length-1)*q,l=Math.floor(p),h=Math.ceil(p);return a[l]+(a[h]-a[l])*(p-l);};
export function lag1Autocorrelation(values:number[]){if(values.length<3)throw new RangeError("Autocorrelation requires at least 3 observations");const m=mean(values);let numerator=0,denominator=0;for(let i=0;i<values.length-1;i++)numerator+=(values[i]-m)*(values[i+1]-m);for(const value of values)denominator+=(value-m)**2;return denominator?numerator/denominator:0;}
/** Politis–Romano-style stationary bootstrap for an ordered dependent series. */
export function stationaryBootstrapMean(values:number[],meanBlockLength=10,resamples=2000,seed=9917):StationaryBootstrapResult{
  if(values.length<10)throw new RangeError("Stationary bootstrap requires at least 10 observations");
  if(meanBlockLength<1||!Number.isFinite(meanBlockLength))throw new RangeError("meanBlockLength must be positive");
  const draw=rng(seed),means:number[]=[];
  for(let b=0;b<resamples;b++){let index=Math.floor(draw()*values.length),total=0;for(let i=0;i<values.length;i++){if(i>0&&draw()<1/meanBlockLength)index=Math.floor(draw()*values.length);else if(i>0)index=(index+1)%values.length;total+=values[index];}means.push(total/values.length);}
  return {observedMean:mean(values),low:quantile(means,.025),high:quantile(means,.975),lag1Autocorrelation:lag1Autocorrelation(values),meanBlockLength,resamples,method:"Stationary bootstrap with geometric blocks"};
}
