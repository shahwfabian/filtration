import { bs, gbmPath } from "./quant.ts";
import { DeterministicExchange } from "./exchange.ts";
import { BayesianRegimeFilter, type DecisionEvidence } from "./adverse.ts";

export type BacktestConfig={vol:number;flowIntensity:number;orderLatency:number;feePerContract:number;maxPosition:number;flowPersistence:number;flowBuyBias:number};
export const defaultBacktestConfig:BacktestConfig={vol:.2,flowIntensity:3,orderLatency:1,feePerContract:.25,maxPosition:20,flowPersistence:0,flowBuyBias:0};
export type BacktestResult={seed:number;spread:number;hedged:boolean;adverseAware:boolean;netPnl:number;optionPnl:number;hedgePnl:number;fees:number;hedgeFees:number;fills:number;fillRate:number;maxAbsInventory:number;maxAbsDelta:number;meanQuotedSpread:number;meanAdverseProbability:number;finalInventory:number;finalHedge:number;finalMid:number;finalUnderlying:number;finalOptionMark:number;meanMarkout:number;reconciles:boolean;flowBuyRate:number;flowArrivalRate:number;flowRegimePersistence:number};
function random(seed:number){let x=seed>>>0;return()=>{x=(1664525*x+1013904223)>>>0;return x/4294967296;};}
const clamp=(x:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,x));

export function runFixedSpreadBacktest(seed:number,spread:number,steps=120,hedged=false,adverseAware=false,overrides:Partial<BacktestConfig>={}):BacktestResult{
  const config={...defaultBacktestConfig,...overrides};
  if(config.flowPersistence<0||config.flowPersistence>1)throw new RangeError("flowPersistence must be in [0,1]");
  const exchange=new DeterministicExchange({tickSize:.01,multiplier:100,feePerContract:config.feePerContract,orderLatency:config.orderLatency,cancelLatency:1,maxPosition:config.maxPosition,maxOrderSize:2});
  const path=gbmPath({spot:100,strike:100,maturity:1,vol:config.vol,rate:.05,dividend:0,paths:10000,seed},"Q",steps);
  const flow=random(seed+101);const filter=new BayesianRegimeFilter();let lastEvidence:DecisionEvidence|undefined;let bid:number|undefined,ask:number|undefined,submitted=0,maxAbs=0,maxAbsDelta=0,hedgeQty=0,hedgeCash=0,hedgeFees=0,spreadSum=0,adverseSum=0,regime=0,arrivals=0,buyFills=0;const markouts:number[]=[];
  const optionMark=(underlying:number,t:number)=>bs({spot:underlying,strike:100,maturity:Math.max((steps-t)/steps,1/365),vol:config.vol,rate:.05,dividend:0,paths:1,seed}).call;
  for(let t=0;t<steps;t++){
    const underlying=path[t];
    const mid=optionMark(underlying,t);
    if(adverseAware&&lastEvidence)filter.update(lastEvidence);
    const quoteSpread=adverseAware?spread*filter.quoteMultiplier():spread;spreadSum+=quoteSpread;adverseSum+=filter.adverseProbability();
    if(bid)exchange.cancel("MM",bid);if(ask)exchange.cancel("MM",ask);
    const bidOrder=exchange.submit("MM","BUY","LIMIT",1,Math.max(.01,Math.floor((mid-quoteSpread)/.01)*.01));const askOrder=exchange.submit("MM","SELL","LIMIT",1,Math.ceil((mid+quoteSpread)/.01)*.01);bid=bidOrder.status==="REJECTED"?undefined:bidOrder.id;ask=askOrder.status==="REJECTED"?undefined:askOrder.id;submitted+=2;
    // Persistence is opt-in so the original iid baseline remains numerically stable.
    if(config.flowPersistence>0){const stays=flow()<config.flowPersistence;regime=stays?regime:(flow()<.5?-1:1);}
    const hitProbability=clamp(Math.exp(-config.flowIntensity*quoteSpread)*(1+.35*regime),0,1);
    if(flow()<hitProbability){
      arrivals++;const buyProbability=clamp(.5+config.flowBuyBias*regime,0,1);const side=flow()<buyProbability?"BUY":"SELL";const size=flow()<.85?1:2;
      if(side==="BUY")buyFills++;
      if(adverseAware){const imbalance=clamp((flow()-.5)*2+.35*regime,-1,1);const volatilityChange=Math.min(1,Math.abs(underlying-(path[Math.max(0,t-1)]??underlying))/underlying*10);lastEvidence={side,imbalance,volatilityChange};}
      exchange.submit("FLOW",side,"MARKET",size);
    }
    const fillsBefore=exchange.fills.length;exchange.advanceTo(t+1);const newFills=exchange.fills.slice(fillsBefore).filter(f=>f.maker==="MM");const nextT=Math.min(t+2,path.length-1);const nextMark=optionMark(path[nextT],nextT);newFills.forEach(f=>markouts.push(exchange.orders.get(f.makerOrderId)?.side==="BUY"?nextMark-f.price:f.price-nextMark));maxAbs=Math.max(maxAbs,Math.abs(exchange.position("MM")));
    const optionDelta=exchange.position("MM")*bs({spot:underlying,strike:100,maturity:Math.max((steps-t)/steps,1/365),vol:config.vol,rate:.05,dividend:0,paths:1,seed}).delta*exchange.config.multiplier;
    if(hedged){const target=-Math.round(optionDelta);const trade=target-hedgeQty;if(trade!==0){hedgeCash-=trade*underlying;hedgeQty+=trade;const fee=Math.abs(trade)*.01;hedgeCash-=fee;hedgeFees+=fee;}maxAbsDelta=Math.max(maxAbsDelta,Math.abs(optionDelta+hedgeQty));}else maxAbsDelta=Math.max(maxAbsDelta,Math.abs(optionDelta));
  }
  exchange.advanceTo(steps+2);const finalUnderlying=path.at(-1)??100;const finalOptionMark=optionMark(finalUnderlying,steps);const optionPnl=exchange.equity("MM",finalOptionMark);const hedgePnl=hedgeCash+hedgeQty*finalUnderlying;const netPnl=optionPnl+hedgePnl;const mmFills=exchange.fills.filter(f=>f.maker==="MM");const reconciles=Math.abs(optionPnl-(exchange.cash("MM")+exchange.position("MM")*finalOptionMark*exchange.config.multiplier))<1e-8;
  return {seed,spread,hedged,adverseAware,netPnl,optionPnl,hedgePnl,fees:exchange.fees("MM"),hedgeFees,fills:mmFills.reduce((sum,f)=>sum+f.quantity,0),fillRate:submitted?mmFills.reduce((sum,f)=>sum+f.quantity,0)/submitted:0,maxAbsInventory:maxAbs,maxAbsDelta,meanQuotedSpread:spreadSum/steps,meanAdverseProbability:adverseSum/steps,finalInventory:exchange.position("MM"),finalHedge:hedgeQty,finalMid:finalUnderlying,finalUnderlying,finalOptionMark,meanMarkout:markouts.length?markouts.reduce((a,b)=>a+b,0)/markouts.length:0,reconciles,flowBuyRate:arrivals?buyFills/arrivals:0,flowArrivalRate:arrivals/steps,flowRegimePersistence:config.flowPersistence};
}

export function summarizeBacktest(seeds:number[],spread:number,hedged=false,adverseAware=false,overrides:Partial<BacktestConfig>={}){const rows=seeds.map(seed=>runFixedSpreadBacktest(seed,spread,120,hedged,adverseAware,overrides));const mean=(key:keyof BacktestResult)=>rows.reduce((sum,row)=>sum+Number(row[key]),0)/rows.length;return {spread,hedged,adverseAware,config:{...defaultBacktestConfig,...overrides},seeds:seeds.length,meanNetPnl:mean("netPnl"),meanFees:mean("fees"),meanHedgeFees:mean("hedgeFees"),meanFillRate:mean("fillRate"),meanMaxAbsInventory:mean("maxAbsInventory"),meanMaxAbsDelta:mean("maxAbsDelta"),meanQuotedSpread:mean("meanQuotedSpread"),meanAdverseProbability:mean("meanAdverseProbability"),meanMarkout:mean("meanMarkout"),meanFlowBuyRate:mean("flowBuyRate"),meanFlowArrivalRate:mean("flowArrivalRate"),worstNetPnl:Math.min(...rows.map(r=>r.netPnl)),reconciled:rows.every(r=>r.reconciles),rows};}
