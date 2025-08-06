/**
 * Chrome-specific Performance API extensions
 * These APIs are only available in Chrome/Chromium browsers
 */

interface PerformanceMemory {
  /** The maximum size of the heap, in bytes, that is available to the context */
  jsHeapSizeLimit: number;
  /** The total allocated heap size, in bytes */
  totalJSHeapSize: number;
  /** The currently active segment of JS heap, in bytes */
  usedJSHeapSize: number;
}

interface Performance {
  /** Chrome-specific memory information (non-standard) */
  memory?: PerformanceMemory;
}

// Helper function to safely access performance.memory
export function getPerformanceMemory(): PerformanceMemory | undefined {
  if (typeof performance !== 'undefined' && 'memory' in performance) {
    return performance.memory;
  }
  return undefined;
}

// Type guard for performance.memory availability
export function hasPerformanceMemory(): boolean {
  return typeof performance !== 'undefined' && 'memory' in performance;
}