import test from "node:test";
import assert from "node:assert/strict";
import { stationaryBootstrapMean, lag1Autocorrelation } from "../lib/dependence.ts";

test("stationary bootstrap is deterministic and reports serial dependence",()=>{
  let state=0; const values=[];
  for(let i=0;i<120;i++){state=(i%17===0?-state:state)+((i%5)-2)*.1;values.push(state);}
  const a=stationaryBootstrapMean(values,12,300,7),b=stationaryBootstrapMean(values,12,300,7);
  assert.deepEqual(a,b); assert.ok(a.lag1Autocorrelation>0); assert.ok(a.low<=a.observedMean&&a.observedMean<=a.high); assert.equal(a.meanBlockLength,12);
});

test("dependent bootstrap validates its input contract",()=>{
  assert.throws(()=>lag1Autocorrelation([1,2]),/at least 3/);
  assert.throws(()=>stationaryBootstrapMean([1,2,3]),/at least 10/);
  assert.throws(()=>stationaryBootstrapMean(Array(10).fill(1),0),/positive/);
});
