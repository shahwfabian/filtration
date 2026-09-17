export class SeededRandom {
  private state: number;

  constructor(seed: number) {
    if (!Number.isInteger(seed)) throw new RangeError("Seed must be an integer");
    this.state = seed >>> 0;
  }

  uniform() {
    this.state = (1664525 * this.state + 1013904223) >>> 0;
    return this.state / 4294967296;
  }

  normal() {
    const u = Math.max(this.uniform(), Number.EPSILON);
    const v = Math.max(this.uniform(), Number.EPSILON);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  exponential(rate: number) {
    if (!(rate > 0)) throw new RangeError("Exponential rate must be positive");
    return -Math.log(Math.max(1 - this.uniform(), Number.EPSILON)) / rate;
  }

  poisson(mean: number) {
    if (!(mean >= 0) || !Number.isFinite(mean)) throw new RangeError("Poisson mean must be finite and non-negative");
    if (mean === 0) return 0;
    const threshold = Math.exp(-mean);
    let product = 1;
    let count = 0;
    do {
      count += 1;
      product *= this.uniform();
    } while (product > threshold);
    return count - 1;
  }
}

