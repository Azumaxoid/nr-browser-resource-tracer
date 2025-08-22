import { ResourceCollector } from '../ResourceCollector';

describe('ResourceCollector', () => {
  let collector: ResourceCollector;
  
  beforeEach(() => {
    collector = new ResourceCollector(10);
  });

  describe('collectResourceTiming', () => {
    it('should collect resource timing data', () => {
      const mockEntries = [
        {
          name: 'https://example.com/script.js',
          startTime: 100,
          duration: 50,
          transferSize: 1024,
          encodedBodySize: 1000,
          decodedBodySize: 2000,
          initiatorType: 'script'
        },
        {
          name: 'https://example.com/style.css',
          startTime: 150,
          duration: 30,
          transferSize: 512,
          encodedBodySize: 500,
          decodedBodySize: 1000,
          initiatorType: 'link'
        }
      ];

      (window.performance.getEntriesByType as jest.Mock).mockReturnValue(mockEntries);

      const result = collector.collectResourceTiming();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        name: 'https://example.com/script.js',
        startTime: 100,
        duration: 50,
        transferSize: 1024,
        encodedBodySize: 1000,
        decodedBodySize: 2000,
        initiatorType: 'script'
      });
    });

    it('should handle missing Performance API', () => {
      const originalPerformance = window.performance;
      Object.defineProperty(window, 'performance', {
        value: undefined,
        writable: true
      });

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const result = collector.collectResourceTiming();

      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith('Performance API not available');

      consoleSpy.mockRestore();
      Object.defineProperty(window, 'performance', {
        value: originalPerformance,
        writable: true
      });
    });

    it('should handle errors gracefully', () => {
      (window.performance.getEntriesByType as jest.Mock).mockImplementation(() => {
        throw new Error('Test error');
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const result = collector.collectResourceTiming();

      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith('Error collecting resource timing:', expect.any(Error));

      consoleSpy.mockRestore();
    });
  });

  describe('collectNavigationTiming', () => {
    it('should collect navigation timing data', () => {
      Object.defineProperty(window.performance, 'timing', {
        value: {
          navigationStart: 1000,
          domContentLoadedEventEnd: 1500,
          loadEventEnd: 2000
        },
        writable: true
      });

      const mockPaintEntries = [
        { name: 'first-contentful-paint', startTime: 300 }
      ];

      const mockLCPEntries = [
        { startTime: 800 },
        { startTime: 1200 }
      ];

      (window.performance.getEntriesByType as jest.Mock)
        .mockImplementation((type: string) => {
          if (type === 'paint') return mockPaintEntries;
          if (type === 'largest-contentful-paint') return mockLCPEntries;
          return [];
        });

      const result = collector.collectNavigationTiming();

      expect(result).toEqual({
        domContentLoaded: 500,
        loadComplete: 1000,
        firstContentfulPaint: 300,
        largestContentfulPaint: 1200
      });
    });

    it('should handle missing timing data', () => {
      Object.defineProperty(window.performance, 'timing', {
        value: undefined,
        writable: true
      });

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const result = collector.collectNavigationTiming();

      expect(result).toEqual({
        domContentLoaded: 0,
        loadComplete: 0,
        firstContentfulPaint: 0,
        largestContentfulPaint: 0
      });

      consoleSpy.mockRestore();
    });
  });

  describe('collectCriticalResources', () => {
    it('should prioritize LCP element resources', () => {
      const mockImage = document.createElement('img');
      mockImage.src = 'https://example.com/hero.jpg';

      const mockResources = [
        {
          name: 'https://example.com/hero.jpg',
          startTime: 100,
          duration: 200,
          transferSize: 5000,
          encodedBodySize: 5000,
          decodedBodySize: 10000,
          initiatorType: 'img'
        },
        {
          name: 'https://example.com/style.css',
          startTime: 50,
          duration: 100,
          transferSize: 1000,
          encodedBodySize: 1000,
          decodedBodySize: 2000,
          initiatorType: 'link'
        },
        {
          name: 'https://example.com/other.js',
          startTime: 150,
          duration: 50,
          transferSize: 500,
          encodedBodySize: 500,
          decodedBodySize: 1000,
          initiatorType: 'script'
        }
      ];

      (window.performance.getEntriesByType as jest.Mock).mockReturnValue(mockResources);

      const result = collector.collectCriticalResources(mockImage);

      expect(result[0].name).toBe('https://example.com/hero.jpg');
      expect(result).toContainEqual(expect.objectContaining({
        name: 'https://example.com/style.css'
      }));
    });

    it('should return top resources by duration when no LCP element', () => {
      const mockResources = [
        { name: 'a.js', duration: 100, startTime: 0, transferSize: 0, encodedBodySize: 0, decodedBodySize: 0, initiatorType: 'script' },
        { name: 'b.js', duration: 200, startTime: 0, transferSize: 0, encodedBodySize: 0, decodedBodySize: 0, initiatorType: 'script' },
        { name: 'c.js', duration: 50, startTime: 0, transferSize: 0, encodedBodySize: 0, decodedBodySize: 0, initiatorType: 'script' },
        { name: 'd.js', duration: 300, startTime: 0, transferSize: 0, encodedBodySize: 0, decodedBodySize: 0, initiatorType: 'script' },
        { name: 'e.js', duration: 150, startTime: 0, transferSize: 0, encodedBodySize: 0, decodedBodySize: 0, initiatorType: 'script' },
        { name: 'f.js', duration: 75, startTime: 0, transferSize: 0, encodedBodySize: 0, decodedBodySize: 0, initiatorType: 'script' }
      ];

      (window.performance.getEntriesByType as jest.Mock).mockReturnValue(mockResources);

      const result = collector.collectCriticalResources(null);

      expect(result).toHaveLength(6);
      expect(result[0].name).toBe('d.js');
      expect(result[1].name).toBe('b.js');
      expect(result[2].name).toBe('e.js');
      expect(result[3].name).toBe('a.js');
      expect(result[4].name).toBe('f.js');
      expect(result[5].name).toBe('c.js');
    });

    it('should extract background image URL from element', () => {
      const mockDiv = document.createElement('div');
      
      Object.defineProperty(window, 'getComputedStyle', {
        value: jest.fn().mockReturnValue({
          backgroundImage: 'url("https://example.com/bg.png")'
        }),
        writable: true
      });

      const mockResources = [
        {
          name: 'https://example.com/bg.png',
          startTime: 100,
          duration: 200,
          transferSize: 3000,
          encodedBodySize: 3000,
          decodedBodySize: 6000,
          initiatorType: 'css'
        }
      ];

      (window.performance.getEntriesByType as jest.Mock).mockReturnValue(mockResources);

      const result = collector.collectCriticalResources(mockDiv);

      expect(result[0].name).toBe('https://example.com/bg.png');
    });
  });
});