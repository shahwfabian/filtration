import type { CustomerSide, ToxicityPosterior } from "./types.ts";

type Evidence = {
  side: CustomerSide | null;
  imbalance: number;
  observedReturn: number;
};

const normalDensity = (value: number, mean: number, standardDeviation: number) => {
  const z = (value - mean) / standardDeviation;
  return Math.exp(-0.5 * z * z) / (standardDeviation * Math.sqrt(2 * Math.PI));
};

const normalize = (values: number[]): [number, number, number] => {
  const total = Math.max(values.reduce((sum, value) => sum + value, 0), Number.EPSILON);
  return values.map(value => value / total) as [number, number, number];
};

export class DirectionalToxicityFilter {
  private probabilities: [number, number, number] = [0.1, 0.8, 0.1];

  posterior(): ToxicityPosterior {
    return {
      informedSell: this.probabilities[0],
      uninformed: this.probabilities[1],
      informedBuy: this.probabilities[2],
    };
  }

  update(evidence: Evidence) {
    const transition = [
      [0.82, 0.16, 0.02],
      [0.09, 0.82, 0.09],
      [0.02, 0.16, 0.82],
    ];
    const predicted = transition[0].map((_, next) => this.probabilities.reduce(
      (sum, probability, previous) => sum + probability * transition[previous][next],
      0,
    )) as [number, number, number];
    const sideLikelihood = evidence.side === null
      ? [0.95, 1, 0.95]
      : evidence.side === "BUY"
        ? [0.18, 0.5, 0.82]
        : [0.82, 0.5, 0.18];
    const imbalanceMeans = [-0.5, 0, 0.5];
    const returnMeans = [-0.001, 0, 0.001];
    const likelihood = predicted.map((probability, index) => probability
      * sideLikelihood[index]
      * normalDensity(evidence.imbalance, imbalanceMeans[index], 0.5)
      * normalDensity(evidence.observedReturn, returnMeans[index], 0.004));
    this.probabilities = normalize(likelihood);
    return this.posterior();
  }
}
