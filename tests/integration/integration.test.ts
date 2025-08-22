import { LCPPerformanceTracer } from '../../src/LCPPerformanceTracer';

describe('Integration Tests', () => {
  let tracer: LCPPerformanceTracer;
  let mockRecordCustomEvent: jest.Mock;

  beforeEach(() => {
    mockRecordCustomEvent = jest.fn();
    (window as any).newrelic = {
      recordCustomEvent: mockRecordCustomEvent
    };

    // Setup complete Performance API mock
    const mockPerformanceEntries = {
      resource: [
        {
          name: 'https://example.com/app.js',
          startTime: 100,
          duration: 150,
          transferSize: 5000,
          encodedBodySize: 4800,
          decodedBodySize: 10000,
          initiatorType: 'script'
        },
        {
          name: 'https://example.com/styles.css',
          startTime: 50,
          duration: 80,
          transferSize: 2000,
          encodedBodySize: 1900,
          decodedBodySize: 4000,
          initiatorType: 'link'
        },
        {
          name: 'https://example.com/hero-image.jpg',
          startTime: 200,
          duration: 300,
          transferSize: 50000,
          encodedBodySize: 50000,
          decodedBodySize: 50000,
          initiatorType: 'img'
        }
      ],
      paint: [
        { name: 'first-contentful-paint', startTime: 450 }
      ],
      'largest-contentful-paint': [
        { startTime: 2800, renderTime: 0, element: null, url: 'https://example.com/hero-image.jpg' }
      ]
    };

    (window.performance.getEntriesByType as jest.Mock).mockImplementation((type: string) => {
      return mockPerformanceEntries[type as keyof typeof mockPerformanceEntries] || [];
    });

    Object.defineProperty(window.performance, 'timing', {
      value: {
        navigationStart: 0,
        domContentLoadedEventEnd: 800,
        loadEventEnd: 1200
      },
      writable: true,
      configurable: true
    });

    Object.defineProperty(window, 'location', {
      value: { href: 'https://example.com/test-page' },
      writable: true,
      configurable: true
    });

    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 Integration Test',
      writable: true,
      configurable: true
    });

    // Mock PerformanceObserver
    const mockObserver = jest.fn().mockImplementation((callback) => {
      // Simulate LCP detection after a delay
      setTimeout(() => {
        callback({
          getEntries: () => [{
            entryType: 'largest-contentful-paint',
            startTime: 2800,
            renderTime: 0,
            element: document.createElement('img'),
            url: 'https://example.com/hero-image.jpg'
          }]
        });
      }, 100);

      return {
        observe: jest.fn(),
        disconnect: jest.fn(),
        takeRecords: jest.fn()
      };
    });

    (global as any).PerformanceObserver = mockObserver;
    (global as any).PerformanceObserver.supportedEntryTypes = ['largest-contentful-paint'];
  });

  afterEach(() => {
    if (tracer && tracer.isTracerRunning()) {
      tracer.stop();
    }
    delete (window as any).newrelic;
    mockRecordCustomEvent.mockClear();
    jest.clearAllMocks();
  });

  describe('End-to-end flow', () => {
    it('should complete full monitoring and reporting cycle', async () => {
      tracer = new LCPPerformanceTracer({
        lcpThreshold: 2500,
        samplingRate: 1.0,
        debug: false,
        enabled: true
      });

      tracer.start();

      // Wait for LCP detection and processing
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(mockRecordCustomEvent).toHaveBeenCalledTimes(4); // 1 main + 3 resources
      expect(mockRecordCustomEvent).toHaveBeenCalledWith(
        'LCPPerformanceTrace',
        expect.objectContaining({
          lcpValue: 2800,
          lcpUrl: 'https://example.com/hero-image.jpg',
          domContentLoaded: 800,
          loadComplete: 1200,
          firstContentfulPaint: 450,
          userAgent: 'Mozilla/5.0 Integration Test',
          url: 'https://example.com/test-page'
        })
      );

      // Verify that resource events were sent
      const resourceEvents = mockRecordCustomEvent.mock.calls.filter(call => call[0] === 'LCPResourceTrace');
      expect(resourceEvents.length).toBeGreaterThan(0);
      
      // Verify hero image resource is included
      const heroImageEvent = resourceEvents.find(call => 
        call[1].resourceName?.includes('hero-image.jpg')
      );
      expect(heroImageEvent).toBeDefined();
      expect(heroImageEvent[1]).toEqual(
        expect.objectContaining({
          resourceDuration: 300,
          resourceTransferSize: 50000
        })
      );
    });

    it('should not report when LCP is below threshold', async () => {
      // Clear previous calls first
      mockRecordCustomEvent.mockClear();
      
      // Update mock to return LCP below threshold
      const mockObserver = jest.fn().mockImplementation((callback) => {
        setTimeout(() => {
          callback({
            getEntries: () => [{
              entryType: 'largest-contentful-paint',
              startTime: 2000, // Below 2500 threshold
              renderTime: 0,
              element: null,
              url: ''
            }]
          });
        }, 100);

        return {
          observe: jest.fn(),
          disconnect: jest.fn(),
          takeRecords: jest.fn()
        };
      });

      (global as any).PerformanceObserver = mockObserver;
      (global as any).PerformanceObserver.supportedEntryTypes = ['largest-contentful-paint'];

      tracer = new LCPPerformanceTracer({
        lcpThreshold: 2500
      });

      tracer.start();

      await new Promise(resolve => setTimeout(resolve, 200));

      expect(mockRecordCustomEvent).not.toHaveBeenCalled(); // Should not be called for LCP < threshold
    });

    it('should handle sampling correctly', () => {
      const mathRandomSpy = jest.spyOn(Math, 'random');
      
      // Test when sampling excludes
      mathRandomSpy.mockReturnValue(0.7);
      const tracer1 = new LCPPerformanceTracer({ samplingRate: 0.5 });
      tracer1.start();
      expect(tracer1.isTracerRunning()).toBe(false);
      
      // Test when sampling includes
      mathRandomSpy.mockReturnValue(0.3);
      const tracer2 = new LCPPerformanceTracer({ samplingRate: 0.5 });
      tracer2.start();
      expect(tracer2.isTracerRunning()).toBe(true);
      tracer2.stop();

      mathRandomSpy.mockRestore();
    });

    it('should work without New Relic', async () => {
      delete (window as any).newrelic;
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      tracer = new LCPPerformanceTracer({
        lcpThreshold: 2500,
        debug: true
      });

      tracer.start();

      await new Promise(resolve => setTimeout(resolve, 200));

      expect(consoleSpy).toHaveBeenCalledWith(
        'New Relic is not available. Skipping trace submission.'
      );
      expect(mockRecordCustomEvent).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should handle multiple LCP updates correctly', async () => {
      // Clear previous calls first
      mockRecordCustomEvent.mockClear();
      
      const mockObserver = jest.fn().mockImplementation((callback) => {
        // Simulate multiple LCP updates
        setTimeout(() => {
          callback({
            getEntries: () => [{
              entryType: 'largest-contentful-paint',
              startTime: 2600,
              renderTime: 0,
              element: document.createElement('div'),
              url: 'https://example.com/first.jpg'
            }]
          });
        }, 50);

        setTimeout(() => {
          callback({
            getEntries: () => [{
              entryType: 'largest-contentful-paint',
              startTime: 2900,
              renderTime: 0,
              element: document.createElement('img'),
              url: 'https://example.com/second.jpg'
            }]
          });
        }, 150);

        return {
          observe: jest.fn(),
          disconnect: jest.fn(),
          takeRecords: jest.fn()
        };
      });

      (global as any).PerformanceObserver = mockObserver;
      (global as any).PerformanceObserver.supportedEntryTypes = ['largest-contentful-paint'];

      tracer = new LCPPerformanceTracer({
        lcpThreshold: 2500
      });

      tracer.start();

      await new Promise(resolve => setTimeout(resolve, 300));

      // Should only report once (first time threshold is exceeded)
      expect(mockRecordCustomEvent).toHaveBeenCalledTimes(4); // 1 main + 3 resources
      // Check that the first LCP event was reported
      expect(mockRecordCustomEvent).toHaveBeenCalledWith(
        'LCPPerformanceTrace',
        expect.objectContaining({
          lcpValue: 2600,
          lcpUrl: 'https://example.com/first.jpg'
        })
      );
    });
  });

  describe('Error resilience', () => {
    it('should continue working when Performance API partially fails', async () => {
      // Make resource timing fail but keep LCP working
      (window.performance.getEntriesByType as jest.Mock).mockImplementation((type: string) => {
        if (type === 'resource') {
          throw new Error('Resource timing failed');
        }
        if (type === 'paint') {
          return [{ name: 'first-contentful-paint', startTime: 450 }];
        }
        if (type === 'largest-contentful-paint') {
          return [{ startTime: 2800, renderTime: 0, element: null, url: '' }];
        }
        return [];
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      tracer = new LCPPerformanceTracer({
        lcpThreshold: 2500
      });

      tracer.start();

      await new Promise(resolve => setTimeout(resolve, 200));

      // Should still send event even with partial data
      expect(mockRecordCustomEvent).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error'),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should handle New Relic errors gracefully', async () => {
      mockRecordCustomEvent.mockImplementation(() => {
        throw new Error('New Relic error');
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      tracer = new LCPPerformanceTracer({
        lcpThreshold: 2500
      });

      tracer.start();

      await new Promise(resolve => setTimeout(resolve, 200));

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to send trace to New Relic:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });
});