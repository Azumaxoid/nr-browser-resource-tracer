import { ResourceTimingData, NavigationTimingData } from './types';

export class ResourceCollector {
  private readonly maxResources: number;

  constructor(maxResources: number = 10) {
    this.maxResources = maxResources;
  }

  public collectResourceTiming(): ResourceTimingData[] {
    try {
      if (!window.performance || !window.performance.getEntriesByType) {
        console.warn('Performance API not available');
        return [];
      }

      const entries = window.performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      
      return entries.map(entry => ({
        name: entry.name,
        startTime: entry.startTime,
        duration: entry.duration,
        transferSize: entry.transferSize || 0,
        encodedBodySize: entry.encodedBodySize || 0,
        decodedBodySize: entry.decodedBodySize || 0,
        initiatorType: entry.initiatorType || 'other'
      }));
    } catch (error) {
      console.error('Error collecting resource timing:', error);
      return [];
    }
  }

  public collectNavigationTiming(): NavigationTimingData {
    const defaultData: NavigationTimingData = {
      domContentLoaded: 0,
      loadComplete: 0,
      firstContentfulPaint: 0,
      largestContentfulPaint: 0
    };

    try {
      if (!window.performance || !window.performance.timing) {
        console.warn('Navigation Timing API not available');
        return defaultData;
      }

      const timing = window.performance.timing;
      const navigationStart = timing.navigationStart || 0;

      const domContentLoaded = timing.domContentLoadedEventEnd - navigationStart;
      const loadComplete = timing.loadEventEnd - navigationStart;

      let firstContentfulPaint = 0;
      let largestContentfulPaint = 0;

      const paintEntries = window.performance.getEntriesByType('paint') as PerformancePaintTiming[];
      const fcpEntry = paintEntries.find(entry => entry.name === 'first-contentful-paint');
      if (fcpEntry) {
        firstContentfulPaint = fcpEntry.startTime;
      }

      const lcpEntries = window.performance.getEntriesByType('largest-contentful-paint');
      if (lcpEntries.length > 0) {
        const lastEntry = lcpEntries[lcpEntries.length - 1] as PerformanceEntry;
        largestContentfulPaint = lastEntry.startTime;
      }

      return {
        domContentLoaded: domContentLoaded > 0 ? domContentLoaded : 0,
        loadComplete: loadComplete > 0 ? loadComplete : 0,
        firstContentfulPaint,
        largestContentfulPaint
      };
    } catch (error) {
      console.error('Error collecting navigation timing:', error);
      return defaultData;
    }
  }

  public collectCriticalResources(lcpElement: Element | null): ResourceTimingData[] {
    try {
      const allResources = this.collectResourceTiming();
      
      if (!lcpElement) {
        return this.getTopResourcesByDuration(allResources);
      }

      const criticalResources: ResourceTimingData[] = [];
      
      const elementUrl = this.getElementResourceUrl(lcpElement);
      if (elementUrl) {
        const matchingResource = allResources.find(r => r.name === elementUrl);
        if (matchingResource) {
          criticalResources.push(matchingResource);
        }
      }

      const stylesheets = allResources.filter(r => 
        r.initiatorType === 'link' && r.name.includes('.css')
      );
      criticalResources.push(...stylesheets);

      const remainingSlots = this.maxResources - criticalResources.length;
      if (remainingSlots > 0) {
        const otherResources = allResources
          .filter(r => !criticalResources.includes(r))
          .sort((a, b) => b.duration - a.duration)
          .slice(0, remainingSlots);
        criticalResources.push(...otherResources);
      }

      return criticalResources.slice(0, this.maxResources);
    } catch (error) {
      console.error('Error collecting critical resources:', error);
      return this.getTopResourcesByDuration(this.collectResourceTiming());
    }
  }

  private getElementResourceUrl(element: Element): string | null {
    if (element.tagName === 'IMG') {
      return (element as HTMLImageElement).src || null;
    }
    
    if (element.tagName === 'VIDEO') {
      return (element as HTMLVideoElement).src || null;
    }

    const backgroundImage = window.getComputedStyle(element).backgroundImage;
    if (backgroundImage && backgroundImage !== 'none') {
      const match = backgroundImage.match(/url\(["']?(.+?)["']?\)/);
      if (match) {
        return match[1];
      }
    }

    return null;
  }

  private getTopResourcesByDuration(resources: ResourceTimingData[]): ResourceTimingData[] {
    return resources
      .sort((a, b) => b.duration - a.duration)
      .slice(0, this.maxResources);
  }
}