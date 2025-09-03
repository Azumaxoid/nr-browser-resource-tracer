import { LCPEntry } from './types';

export class LCPMonitor {
  private observer: PerformanceObserver | null = null;
  private currentLCP: LCPEntry | null = null;
  private readonly threshold: number;
  private readonly onLCPDetected: (entry: LCPEntry) => void;
  private isObserving = false;
  private hasTriggered = false;
  private fallbackCheckInterval: number | null = null;

  constructor(threshold: number, onLCPDetected: (entry: LCPEntry) => void) {
    this.threshold = threshold;
    this.onLCPDetected = onLCPDetected;
  }

  public start(): void {
    if (this.isObserving) {
      return;
    }

    this.isObserving = true;
    this.hasTriggered = false;

    if (this.supportsPerformanceObserver()) {
      this.startPerformanceObserver();
    } else {
      this.startFallbackMethod();
    }
  }

  public stop(): void {
    if (!this.isObserving) {
      return;
    }

    this.isObserving = false;

    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    if (this.fallbackCheckInterval) {
      clearInterval(this.fallbackCheckInterval);
      this.fallbackCheckInterval = null;
    }
  }

  public getCurrentLCP(): LCPEntry | null {
    return this.currentLCP;
  }

  public isRunning(): boolean {
    return this.isObserving;
  }

  private supportsPerformanceObserver(): boolean {
    return typeof PerformanceObserver !== 'undefined' && 
           PerformanceObserver.supportedEntryTypes?.includes('largest-contentful-paint');
  }

  private startPerformanceObserver(): void {
    try {
      this.observer = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        for (const entry of entries) {
          if (entry.entryType === 'largest-contentful-paint') {
            this.handleLCPEntry(entry as PerformanceLargestContentfulPaint);
          }
        }
      });

      this.observer.observe({ 
        type: 'largest-contentful-paint', 
        buffered: true 
      });
    } catch (error) {
      console.warn('Failed to start PerformanceObserver, falling back to alternative method:', error);
      this.startFallbackMethod();
    }
  }

  private startFallbackMethod(): void {
    const checkLCP = (): void => {
      try {
        const entries = performance.getEntriesByType('largest-contentful-paint');
        if (entries && entries.length > 0) {
          const lastEntry = entries[entries.length - 1] as PerformanceLargestContentfulPaint;
          this.handleLCPEntry(lastEntry);
        }
      } catch (error) {
        console.error('Error in fallback LCP check:', error);
      }
    };

    checkLCP();
    
    this.fallbackCheckInterval = window.setInterval(checkLCP, 1000);

    window.addEventListener('load', () => {
      setTimeout(() => {
        checkLCP();
        if (this.fallbackCheckInterval) {
          clearInterval(this.fallbackCheckInterval);
          this.fallbackCheckInterval = null;
        }
      }, 2000);
    }, { once: true });
  }

  private handleLCPEntry(entry: PerformanceLargestContentfulPaint): void {
    const lcpValue = entry.startTime || entry.renderTime || 0;
    
    const lcpEntry: LCPEntry = {
      value: lcpValue,
      element: entry.element || null,
      url: entry.url || '',
      timestamp: Date.now()
    };

    this.currentLCP = lcpEntry;

    if (lcpValue > this.threshold && !this.hasTriggered) {
      this.hasTriggered = true;
      this.onLCPDetected(lcpEntry);
    }
  }
}

interface PerformanceLargestContentfulPaint extends PerformanceEntry {
  renderTime: number;
  loadTime: number;
  size: number;
  id: string;
  url?: string;
  element?: Element;
}