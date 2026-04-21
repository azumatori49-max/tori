import type { AgeEstimate } from '@/types/agey';

/**
 * 推定年齢のフレーム間揺らぎを均す移動平均バッファ。
 * 中央値ベースで外れ値耐性を持たせる。
 */
export class AgeBuffer {
  private samples: AgeEstimate[] = [];

  constructor(private readonly windowSize: number) {}

  push(estimate: AgeEstimate): void {
    this.samples.push(estimate);
    if (this.samples.length > this.windowSize) {
      this.samples.shift();
    }
  }

  clear(): void {
    this.samples = [];
  }

  size(): number {
    return this.samples.length;
  }

  /** 中央値 (外れ値に強い) */
  median(): number | null {
    if (this.samples.length === 0) return null;
    const sorted = [...this.samples].map((s) => s.age).sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
      const lo = sorted[mid - 1];
      const hi = sorted[mid];
      if (lo === undefined || hi === undefined) return null;
      return (lo + hi) / 2;
    }
    const v = sorted[mid];
    return v ?? null;
  }
}
