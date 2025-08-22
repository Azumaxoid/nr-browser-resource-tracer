import { LCPMonitor } from '../LCPMonitor';

describe('LCPMonitor', () => {
  let monitor: LCPMonitor;
  let mockCallback: jest.Mock;
  let mockObserver: jest.Mock;

  beforeEach(() => {
    mockCallback = jest.fn();
    mockObserver = jest.fn().mockImplementation(() => ({
      observe: jest.fn(),
      disconnect: jest.fn(),
      takeRecords: jest.fn()
    }));
    
    (global as any).PerformanceObserver = mockObserver;
    (global as any).PerformanceObserver.supportedEntryTypes = ['largest-contentful-paint'];
  });

  afterEach(() => {
    if (monitor && monitor.isRunning()) {
      monitor.stop();
    }
    jest.clearAllMocks();
  });

  describe('start', () => {
    it('should start monitoring with PerformanceObserver', () => {
      monitor = new LCPMonitor(2500, mockCallback);
      monitor.start();

      expect(mockObserver).toHaveBeenCalled();
      expect(monitor.isRunning()).toBe(true);
    });

    it('should not start twice if already running', () => {
      monitor = new LCPMonitor(2500, mockCallback);
      monitor.start();
      monitor.start();

      expect(mockObserver).toHaveBeenCalledTimes(1);
    });

    it('should fall back when PerformanceObserver is not supported', () => {
      (global as any).PerformanceObserver.supportedEntryTypes = [];
      
      const setIntervalSpy = jest.spyOn(window, 'setInterval');
      
      monitor = new LCPMonitor(2500, mockCallback);
      monitor.start();

      expect(setIntervalSpy).toHaveBeenCalled();
      expect(monitor.isRunning()).toBe(true);
      
      setIntervalSpy.mockRestore();
    });
  });

  describe('stop', () => {
    it('should stop monitoring and disconnect observer', () => {
      const mockDisconnect = jest.fn();
      mockObserver.mockImplementation(() => ({
        observe: jest.fn(),
        disconnect: mockDisconnect,
        takeRecords: jest.fn()
      }));

      monitor = new LCPMonitor(2500, mockCallback);
      monitor.start();
      monitor.stop();

      expect(mockDisconnect).toHaveBeenCalled();
      expect(monitor.isRunning()).toBe(false);
    });

    it('should clear interval in fallback mode', () => {
      (global as any).PerformanceObserver.supportedEntryTypes = [];
      
      const clearIntervalSpy = jest.spyOn(window, 'clearInterval');
      
      monitor = new LCPMonitor(2500, mockCallback);
      monitor.start();
      monitor.stop();

      expect(clearIntervalSpy).toHaveBeenCalled();
      
      clearIntervalSpy.mockRestore();
    });

    it('should not error when stopping if not started', () => {
      monitor = new LCPMonitor(2500, mockCallback);
      expect(() => monitor.stop()).not.toThrow();
    });
  });

  describe('LCP detection', () => {
    it('should trigger callback when LCP exceeds threshold', () => {
      const mockEntry = {
        entryType: 'largest-contentful-paint',
        startTime: 3000,
        renderTime: 0,
        element: document.createElement('div'),
        url: 'https://example.com/image.jpg'
      };

      let observerCallback: any;
      mockObserver.mockImplementation((callback: any) => {
        observerCallback = callback;
        return {
          observe: jest.fn(),
          disconnect: jest.fn(),
          takeRecords: jest.fn()
        };
      });

      monitor = new LCPMonitor(2500, mockCallback);
      monitor.start();

      observerCallback({
        getEntries: () => [mockEntry]
      });

      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          value: 3000,
          element: mockEntry.element,
          url: 'https://example.com/image.jpg',
          timestamp: expect.any(Number)
        })
      );
    });

    it('should not trigger callback when LCP is below threshold', () => {
      const mockEntry = {
        entryType: 'largest-contentful-paint',
        startTime: 2000,
        renderTime: 0,
        element: document.createElement('div'),
        url: 'https://example.com/image.jpg'
      };

      let observerCallback: any;
      mockObserver.mockImplementation((callback: any) => {
        observerCallback = callback;
        return {
          observe: jest.fn(),
          disconnect: jest.fn(),
          takeRecords: jest.fn()
        };
      });

      monitor = new LCPMonitor(2500, mockCallback);
      monitor.start();

      observerCallback({
        getEntries: () => [mockEntry]
      });

      expect(mockCallback).not.toHaveBeenCalled();
    });

    it('should only trigger callback once', () => {
      const mockEntry1 = {
        entryType: 'largest-contentful-paint',
        startTime: 3000,
        renderTime: 0,
        element: document.createElement('div'),
        url: 'https://example.com/image1.jpg'
      };

      const mockEntry2 = {
        entryType: 'largest-contentful-paint',
        startTime: 3500,
        renderTime: 0,
        element: document.createElement('div'),
        url: 'https://example.com/image2.jpg'
      };

      let observerCallback: any;
      mockObserver.mockImplementation((callback: any) => {
        observerCallback = callback;
        return {
          observe: jest.fn(),
          disconnect: jest.fn(),
          takeRecords: jest.fn()
        };
      });

      monitor = new LCPMonitor(2500, mockCallback);
      monitor.start();

      observerCallback({
        getEntries: () => [mockEntry1]
      });

      observerCallback({
        getEntries: () => [mockEntry2]
      });

      expect(mockCallback).toHaveBeenCalledTimes(1);
    });
  });

  describe('getCurrentLCP', () => {
    it('should return current LCP entry', () => {
      const mockEntry = {
        entryType: 'largest-contentful-paint',
        startTime: 3000,
        renderTime: 0,
        element: document.createElement('div'),
        url: 'https://example.com/image.jpg'
      };

      let observerCallback: any;
      mockObserver.mockImplementation((callback: any) => {
        observerCallback = callback;
        return {
          observe: jest.fn(),
          disconnect: jest.fn(),
          takeRecords: jest.fn()
        };
      });

      monitor = new LCPMonitor(2500, mockCallback);
      monitor.start();

      observerCallback({
        getEntries: () => [mockEntry]
      });

      const currentLCP = monitor.getCurrentLCP();
      expect(currentLCP).toEqual(
        expect.objectContaining({
          value: 3000,
          element: mockEntry.element,
          url: 'https://example.com/image.jpg'
        })
      );
    });

    it('should return null when no LCP detected', () => {
      monitor = new LCPMonitor(2500, mockCallback);
      monitor.start();

      expect(monitor.getCurrentLCP()).toBeNull();
    });
  });
});