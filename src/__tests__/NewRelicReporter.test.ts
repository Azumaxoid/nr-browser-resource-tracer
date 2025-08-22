import { NewRelicReporter } from '../NewRelicReporter';
import { TraceData } from '../types';

describe('NewRelicReporter', () => {
  let reporter: NewRelicReporter;
  let mockRecordCustomEvent: jest.Mock;

  beforeEach(() => {
    mockRecordCustomEvent = jest.fn();
    (window as any).newrelic = {
      recordCustomEvent: mockRecordCustomEvent
    };
  });

  afterEach(() => {
    delete (window as any).newrelic;
    jest.clearAllMocks();
  });

  describe('isNewRelicAvailable', () => {
    it('should return true when New Relic is available', () => {
      reporter = new NewRelicReporter();
      expect(reporter.isNewRelicAvailable()).toBe(true);
    });

    it('should return false when New Relic is not available', () => {
      delete (window as any).newrelic;
      reporter = new NewRelicReporter();
      expect(reporter.isNewRelicAvailable()).toBe(false);
    });

    it('should return false when recordCustomEvent is not a function', () => {
      (window as any).newrelic = { recordCustomEvent: 'not a function' };
      reporter = new NewRelicReporter();
      expect(reporter.isNewRelicAvailable()).toBe(false);
    });
  });

  describe('sendTrace', () => {
    const mockTraceData: TraceData = {
      lcp: {
        value: 3000,
        element: null,
        url: 'https://example.com/image.jpg',
        timestamp: Date.now()
      },
      resources: [
        {
          name: 'https://example.com/script.js',
          startTime: 100,
          duration: 50,
          transferSize: 1024,
          encodedBodySize: 1000,
          decodedBodySize: 2000,
          initiatorType: 'script'
        }
      ],
      navigation: {
        domContentLoaded: 500,
        loadComplete: 1000,
        firstContentfulPaint: 300,
        largestContentfulPaint: 3000
      },
      userAgent: 'Mozilla/5.0 Test Browser',
      url: 'https://example.com/page',
      timestamp: Date.now()
    };

    it('should send formatted trace to New Relic', async () => {
      reporter = new NewRelicReporter();
      await reporter.sendTrace(mockTraceData);

      expect(mockRecordCustomEvent).toHaveBeenCalledWith(
        'LCPPerformanceTrace',
        expect.objectContaining({
          lcpValue: 3000,
          lcpElement: 'unknown',
          lcpUrl: 'https://example.com/image.jpg',
          domContentLoaded: 500,
          loadComplete: 1000,
          firstContentfulPaint: 300,
          resourceCount: 1
        })
      );

      expect(mockRecordCustomEvent).toHaveBeenCalledWith(
        'LCPResourceTrace',
        expect.objectContaining({
          resourceName: 'https://example.com/script.js',
          resourceDuration: 50,
          resourceTransferSize: 1024
        })
      );
    });

    it('should format element selector correctly', async () => {
      const element = document.createElement('div');
      element.id = 'hero';
      element.className = 'banner main';

      const traceData = {
        ...mockTraceData,
        lcp: {
          ...mockTraceData.lcp,
          element
        }
      };

      reporter = new NewRelicReporter();
      await reporter.sendTrace(traceData);

      expect(mockRecordCustomEvent).toHaveBeenCalledWith(
        'LCPPerformanceTrace',
        expect.objectContaining({
          lcpElement: 'div#hero.banner.main'
        })
      );
    });

    it('should send all resources as separate events', async () => {
      const manyResources = Array.from({ length: 3 }, (_, i) => ({
        name: `https://example.com/resource${i}.js`,
        startTime: i * 10,
        duration: 50 - i,
        transferSize: 1024,
        encodedBodySize: 1000,
        decodedBodySize: 2000,
        initiatorType: 'script'
      }));

      const traceData = {
        ...mockTraceData,
        resources: manyResources
      };

      reporter = new NewRelicReporter();
      await reporter.sendTrace(traceData);

      // Should have 1 main event + 3 resource events = 4 total calls
      expect(mockRecordCustomEvent).toHaveBeenCalledTimes(4);
      
      // Check main event
      expect(mockRecordCustomEvent).toHaveBeenCalledWith(
        'LCPPerformanceTrace',
        expect.objectContaining({
          resourceCount: 3
        })
      );

      // Check resource events
      expect(mockRecordCustomEvent).toHaveBeenCalledWith(
        'LCPResourceTrace',
        expect.objectContaining({
          resourceName: 'https://example.com/resource0.js',
          resourceIndex: 0
        })
      );
    });

    it('should sanitize URLs with sensitive parameters', async () => {
      const traceData = {
        ...mockTraceData,
        url: 'https://example.com/page?token=secret123&normal=value'
      };

      reporter = new NewRelicReporter();
      await reporter.sendTrace(traceData);

      expect(mockRecordCustomEvent).toHaveBeenCalledWith(
        'LCPPerformanceTrace',
        expect.objectContaining({
          url: 'https://example.com/page?token=%5BREDACTED%5D&normal=value'
        })
      );
    });

    it('should log to console in debug mode', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      reporter = new NewRelicReporter(true);
      await reporter.sendTrace(mockTraceData);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Sending LCP trace to New Relic:',
        expect.any(Object)
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('LCP trace sent successfully to New Relic')
      );

      consoleSpy.mockRestore();
    });

    it('should skip sending when New Relic is not available', async () => {
      delete (window as any).newrelic;
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      reporter = new NewRelicReporter(true);
      await reporter.sendTrace(mockTraceData);

      expect(consoleSpy).toHaveBeenCalledWith(
        'New Relic is not available. Skipping trace submission.'
      );
      expect(mockRecordCustomEvent).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should handle errors gracefully', async () => {
      mockRecordCustomEvent.mockImplementation(() => {
        throw new Error('Test error');
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      reporter = new NewRelicReporter();
      await reporter.sendTrace(mockTraceData);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to send trace to New Relic:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should truncate long strings', async () => {
      const longUrl = 'https://example.com/' + 'a'.repeat(300);
      const traceData = {
        ...mockTraceData,
        url: longUrl,
        userAgent: 'Mozilla/5.0 ' + 'X'.repeat(300)
      };

      reporter = new NewRelicReporter();
      await reporter.sendTrace(traceData);

      const callArgs = mockRecordCustomEvent.mock.calls[0][1];
      
      expect((callArgs.url as string).length).toBeLessThanOrEqual(200);
      expect((callArgs.userAgent as string).length).toBeLessThanOrEqual(200);
      expect((callArgs.url as string).endsWith('...')).toBe(true);
    });
  });
});