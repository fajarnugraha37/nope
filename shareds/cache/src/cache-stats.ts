/**
 * Cache statistics and metrics tracking
 */

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  evictions: number;
  size: number;
  totalSize: number;
}

export interface CacheMetrics extends CacheStats {
  hitRate: number;
  missRate: number;
  avgSize: number;
}

export class CacheStatistics {
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    evictions: 0,
    size: 0,
    totalSize: 0,
  };

  recordHit() {
    this.stats.hits++;
  }

  recordMiss() {
    this.stats.misses++;
  }

  recordSet() {
    this.stats.sets++;
  }

  recordDelete() {
    this.stats.deletes++;
  }

  recordEviction() {
    this.stats.evictions++;
  }

  updateSize(size: number, totalSize: number) {
    this.stats.size = size;
    this.stats.totalSize = totalSize;
  }

  getStats(): Readonly<CacheStats> {
    return { ...this.stats };
  }

  getMetrics(): CacheMetrics {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      hitRate: total > 0 ? this.stats.hits / total : 0,
      missRate: total > 0 ? this.stats.misses / total : 0,
      avgSize: this.stats.size > 0 ? this.stats.totalSize / this.stats.size : 0,
    };
  }

  reset() {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      size: 0,
      totalSize: 0,
    };
  }
}
