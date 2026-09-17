import { stationaryBootstrapMean } from "../lib/dependence.ts";

let state=0;const rewards=[];for(let t=0;t<240;t++){state=(t%23===0?-state:state)+((t%7)-3)*.08;rewards.push(state);}
console.log(JSON.stringify({generatedAt:"2026-08-11",synthetic:true,orderedObservations:rewards.length,result:stationaryBootstrapMean(rewards,12,2000,9917)},null,2));
