import { LCPPerformanceTracer } from '../LCPPerformanceTracer';
import { LCPTracerConfig } from '../types';

describe('LCPPerformanceTracer', () => {
  let tracer: LCPPerformanceTracer;
  let mockObserver: jest.Mock;
  let mockRecordCustomEvent: jest.Mock;

  beforeEach(() => {
    mockRecordCustomEvent = jest.fn();
    (window as any).newrelic = {
      recordCustomEvent: mockRecordCustomEvent
    };

    mockObserver = jest.fn().mockImplementation(() => ({
      observe: jest.fn(),
      disconnect: jest.fn(),
      takeRecords: jest.fn()
    }));
    
    (global as any).PerformanceObserver = mockObserver;
    (global as any).PerformanceObserver.supportedEntryTypes = ['largest-contentful-paint'];

    (window.performance.getEntriesByType as jest.Mock).mockReturnValue([]);
    
    Object.defineProperty(window, 'location', {
      value: { href: 'https://example.com/page' },
      writable: true
    });
    
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 Test Browser',
      writable: true
    });
  });

  afterEach(() => {
    if (tracer && tracer.isTracerRunning()) {
      tracer.stop();
    }
    delete (window as any).newrelic;
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      tracer = new LCPPerformanceTracer();
      const config = tracer.getConfig();

      expect(config.lcpThreshold).toBe(2500);
      expect(config.samplingRate).toBe(1.0);
      expect(config.debug).toBe(false);
      expect(config.enabled).toBe(true);
    });

    it('should initialize with custom config', () => {
      const customConfig: LCPTracerConfig = {
        lcpThreshold: 3000,
        samplingRate: 0.5,
        debug: true,
        enabled: true,
        maxResources: 10
      };

      tracer = new LCPPerformanceTracer(customConfig);
      const config = tracer.getConfig();

      expect(config).toEqual(customConfig);
    });

    it('should log initialization in debug mode', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      tracer = new LCPPerformanceTracer({ debug: true });

      expect(consoleSpy).toHaveBeenCalledWith(
        'LCPPerformanceTracer initialized with config:',
        expect.any(Object)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('start', () => {
    it('should start monitoring when enabled', () => {
      tracer = new LCPPerformanceTracer();
      tracer.start();

      expect(tracer.isTracerRunning()).toBe(true);
      expect(mockObserver).toHaveBeenCalled();
    });

    it('should not start when already running', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      tracer = new LCPPerformanceTracer({ debug: true });
      tracer.start();
      tracer.start();

      expect(consoleSpy).toHaveBeenCalledWith('LCPPerformanceTracer is already running');
      expect(mockObserver).toHaveBeenCalledTimes(1);

      consoleSpy.mockRestore();
    });

    it('should not start when disabled', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      tracer = new LCPPerformanceTracer({ enabled: false, debug: true });
      tracer.start();

      expect(tracer.isTracerRunning()).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('LCPPerformanceTracer is disabled');

      consoleSpy.mockRestore();
    });

    it('should respect sampling rate', () => {
      const mathRandomSpy = jest.spyOn(Math, 'random');
      mathRandomSpy.mockReturnValue(0.7);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      tracer = new LCPPerformanceTracer({ samplingRate: 0.5, debug: true });
      tracer.start();

      expect(tracer.isTracerRunning()).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('LCPPerformanceTracer skipped due to sampling');

      mathRandomSpy.mockRestore();
      consoleSpy.mockRestore();
    });
  });

  describe('stop', () => {
    it('should stop monitoring', () => {
      tracer = new LCPPerformanceTracer();
      tracer.start();
      tracer.stop();

      expect(tracer.isTracerRunning()).toBe(false);
    });

    it('should do nothing when not running', () => {
      tracer = new LCPPerformanceTracer();
      expect(() => tracer.stop()).not.toThrow();
    });

    it('should log stop in debug mode', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      tracer = new LCPPerformanceTracer({ debug: true });
      tracer.start();
      tracer.stop();

      expect(consoleSpy).toHaveBeenCalledWith('Stopping LCPPerformanceTracer');

      consoleSpy.mockRestore();
    });
  });

  describe('LCP detection and reporting', () => {
    it('should send trace when LCP exceeds threshold', async () => {
      const mockLCPEntry = {
        entryType: 'largest-contentful-paint',
        startTime: 3000,
        renderTime: 0,
        element: document.createElement('div'),
        url: 'https://example.com/image.jpg'
      };

      const mockResources = [
        {
          name: 'https://example.com/script.js',
          startTime: 100,
          duration: 50,
          transferSize: 1024,
          encodedBodySize: 1000,
          decodedBodySize: 2000,
          initiatorType: 'script'
        }
      ];

      (window.performance.getEntriesByType as jest.Mock)
        .mockImplementation((type: string) => {
          if (type === 'resource') return mockResources;
          if (type === 'paint') return [{ name: 'first-contentful-paint', startTime: 300 }];
          if (type === 'largest-contentful-paint') return [mockLCPEntry];
          return [];
        });

      Object.defineProperty(window.performance, 'timing', {
        value: {
          navigationStart: 1000,
          domContentLoadedEventEnd: 1500,
          loadEventEnd: 2000
        },
        writable: true
      });

      let observerCallback: any;
      mockObserver.mockImplementation((callback: any) => {
        observerCallback = callback;
        return {
          observe: jest.fn(),
          disconnect: jest.fn(),
          takeRecords: jest.fn()
        };
      });

      tracer = new LCPPerformanceTracer({ debug: true });
      tracer.start();

      observerCallback({
        getEntries: () => [mockLCPEntry]
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockRecordCustomEvent).toHaveBeenCalledWith(
        'LCPPerformanceTrace',
        expect.objectContaining({
          lcpValue: 3000,
          lcpUrl: 'https://example.com/image.jpg'
        })
      );
    });

    it('should handle errors during LCP detection', async () => {
      const mockLCPEntry = {
        entryType: 'largest-contentful-paint',
        startTime: 3000,
        renderTime: 0,
        element: null,
        url: ''
      };

      (window.performance.getEntriesByType as jest.Mock).mockImplementation(() => {
        throw new Error('Test error');
      });

      let observerCallback: any;
      mockObserver.mockImplementation((callback: any) => {
        observerCallback = callback;
        return {
          observe: jest.fn(),
          disconnect: jest.fn(),
          takeRecords: jest.fn()
        };
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      tracer = new LCPPerformanceTracer();
      tracer.start();

      observerCallback({
        getEntries: () => [mockLCPEntry]
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error'),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('static methods', () => {
    it('should create instance with create()', () => {
      const instance = LCPPerformanceTracer.create({ debug: true });
      expect(instance).toBeInstanceOf(LCPPerformanceTracer);
      expect(instance.getConfig().debug).toBe(true);
    });

    it('should auto-start when DOM is ready', () => {
      Object.defineProperty(document, 'readyState', {
        value: 'complete',
        writable: true
      });

      const instance = LCPPerformanceTracer.autoStart();
      expect(instance.isTracerRunning()).toBe(true);
      
      instance.stop();
    });

    it('should wait for DOMContentLoaded when loading', () => {
      Object.defineProperty(document, 'readyState', {
        value: 'loading',
        writable: true
      });

      const addEventListenerSpy = jest.spyOn(document, 'addEventListener');

      const instance = LCPPerformanceTracer.autoStart();
      
      expect(instance.isTracerRunning()).toBe(false);
      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'DOMContentLoaded',
        expect.any(Function)
      );

      addEventListenerSpy.mockRestore();
    });
  });
});