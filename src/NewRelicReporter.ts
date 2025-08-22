import { TraceData } from './types';

export class NewRelicReporter {
  private readonly debug: boolean;

  constructor(debug: boolean = false) {
    this.debug = debug;
  }

  public isNewRelicAvailable(): boolean {
    return typeof window !== 'undefined' && 
           window.newrelic !== undefined &&
           typeof window.newrelic.recordCustomEvent === 'function';
  }

  public async sendTrace(data: TraceData): Promise<void> {
    try {
      if (!this.isNewRelicAvailable()) {
        if (this.debug) {
          console.warn('New Relic is not available. Skipping trace submission.');
          console.log('Trace data that would have been sent:', data);
        }
        return;
      }

      // Send main LCP event
      const mainEventData = this.formatMainEventData(data);
      
      if (this.debug) {
        console.log('Sending LCP trace to New Relic:', mainEventData);
      }

      window.newrelic?.recordCustomEvent('LCPPerformanceTrace', mainEventData);

      // Send individual resource events
      const resourceEvents = this.formatResourceEvents(data);
      resourceEvents.forEach((resourceEvent, index) => {
        if (this.debug) {
          console.log(`Sending resource ${index + 1} to New Relic:`, resourceEvent);
        }
        window.newrelic?.recordCustomEvent('LCPResourceTrace', resourceEvent);
      });

      if (this.debug) {
        console.log(`LCP trace sent successfully to New Relic (1 main event + ${resourceEvents.length} resource events)`);
      }
    } catch (error) {
      console.error('Failed to send trace to New Relic:', error);
      if (this.debug) {
        console.error('Trace data that failed to send:', data);
      }
    }
  }

  private formatMainEventData(data: TraceData): Record<string, unknown> {
    const eventData: Record<string, unknown> = {
      lcpValue: Math.round(data.lcp.value),
      lcpElement: this.getElementSelector(data.lcp.element),
      lcpUrl: this.truncateString(data.lcp.url, 200),
      domContentLoaded: Math.round(data.navigation.domContentLoaded),
      loadComplete: Math.round(data.navigation.loadComplete),
      firstContentfulPaint: Math.round(data.navigation.firstContentfulPaint),
      resourceCount: data.resources.length,
      userAgent: this.truncateString(data.userAgent, 200),
      url: this.sanitizeUrl(data.url),
      timestamp: data.timestamp,
      samplingRate: 1.0,
      traceId: this.generateTraceId(data.timestamp)
    };

    Object.keys(eventData).forEach(key => {
      if (eventData[key] === null || eventData[key] === undefined) {
        delete eventData[key];
      }
    });

    return eventData;
  }

  private formatResourceEvents(data: TraceData): Array<Record<string, unknown>> {
    const traceId = this.generateTraceId(data.timestamp);
    
    return data.resources.map((resource, index) => {
      const resourceEvent: Record<string, unknown> = {
        traceId,
        resourceIndex: index,
        resourceName: this.truncateString(resource.name, 200),
        resourceDuration: Math.round(resource.duration),
        resourceStartTime: Math.round(resource.startTime),
        resourceTransferSize: resource.transferSize,
        resourceEncodedSize: resource.encodedBodySize,
        resourceDecodedSize: resource.decodedBodySize,
        resourceInitiatorType: resource.initiatorType,
        lcpValue: Math.round(data.lcp.value),
        url: this.sanitizeUrl(data.url),
        timestamp: data.timestamp
      };

      Object.keys(resourceEvent).forEach(key => {
        if (resourceEvent[key] === null || resourceEvent[key] === undefined) {
          delete resourceEvent[key];
        }
      });

      return resourceEvent;
    });
  }

  private generateTraceId(timestamp: number): string {
    return `lcp_${timestamp}_${Math.random().toString(36).substring(2, 15)}`;
  }

  private getElementSelector(element: Element | null): string {
    if (!element) {
      return 'unknown';
    }

    try {
      const tagName = element.tagName.toLowerCase();
      const id = element.id ? `#${element.id}` : '';
      const classes = element.className 
        ? `.${element.className.split(' ').filter(c => c).join('.')}` 
        : '';
      
      return this.truncateString(`${tagName}${id}${classes}`, 100);
    } catch (error) {
      return 'unknown';
    }
  }

  private sanitizeUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      const params = new URLSearchParams(urlObj.search);
      
      const sensitiveParams = ['token', 'key', 'password', 'secret', 'auth', 'api_key', 'apikey'];
      sensitiveParams.forEach(param => {
        if (params.has(param)) {
          params.set(param, '[REDACTED]');
        }
      });

      urlObj.search = params.toString();
      return this.truncateString(urlObj.toString(), 200);
    } catch (error) {
      return this.truncateString(url, 200);
    }
  }

  private truncateString(str: string, maxLength: number): string {
    if (!str) return '';
    return str.length > maxLength ? str.substring(0, maxLength - 3) + '...' : str;
  }
}