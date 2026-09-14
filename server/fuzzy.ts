/**
 * Typo-tolerance for part-number search.
 *
 * Damerau-Levenshtein (optimal string alignment) distance with an early-exit
 * band: counts insertions, deletions, substitutions and adjacent
 * transpositions — the four classic typing mistakes. Returns max + 1 as soon
 * as the distance provably exceeds `max`, so scanning the whole part_numbers
 * table stays cheap.
 */
export function editDistance(a: string, b: string, max: number): number {
  if (a === b) return 0
  const la = a.length, lb = b.length
  if (Math.abs(la - lb) > max) return max + 1
  let p2: number[] = []
  let p1 = Array.from({ length: lb + 1 }, (_, j) => j)
  const cur = new Array<number>(lb + 1)
  for (let i = 1; i <= la; i++) {
    cur[0] = i
    let best = cur[0]
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let v = Math.min(p1[j] + 1, cur[j - 1] + 1, p1[j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, p2[j - 2] + 1)
      }
      cur[j] = v
      if (v < best) best = v
    }
    if (best > max) return max + 1
    p2 = p1
    p1 = cur.slice()
  }
  return p1[lb]
}

/**
 * How many typos we tolerate for a query of this (normalized) length.
 * Short codes get none — a 1-edit "match" on a 4-char code is a different part.
 */
export function fuzzyMax(len: number): number {
  if (len >= 9) return 2
  if (len >= 5) return 1
  return 0
}
