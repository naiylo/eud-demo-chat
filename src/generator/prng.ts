/*
  Used as a performance enhancement compared to Math.random() for the fuzzer
*/

export function mulberry32(seed: number): () => number {
  return function () {
    let z = (seed += 0x6d2b79f5);
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  };
}
