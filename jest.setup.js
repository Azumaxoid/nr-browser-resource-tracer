// Mock Performance APIs
global.PerformanceObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  disconnect: jest.fn(),
  takeRecords: jest.fn()
}));

Object.defineProperty(window, 'performance', {
  value: {
    getEntriesByType: jest.fn(),
    getEntriesByName: jest.fn(),
    now: jest.fn(() => Date.now()),
    timing: {
      navigationStart: 0,
      domContentLoadedEventEnd: 100,
      loadEventEnd: 200
    }
  },
  writable: true,
  configurable: true
});