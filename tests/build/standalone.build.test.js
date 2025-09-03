const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

describe('Standalone Build Tests', () => {
  const distDir = path.join(__dirname, '../../dist/standalone');
  const devBuild = path.join(distDir, 'lcp-performance-tracer.js');
  const prodBuild = path.join(distDir, 'lcp-performance-tracer.min.js');
  const devSourceMap = path.join(distDir, 'lcp-performance-tracer.js.map');
  const prodSourceMap = path.join(distDir, 'lcp-performance-tracer.min.js.map');

  beforeAll(() => {
    // Build the standalone version
    try {
      execSync('npm run build:standalone', { 
        cwd: path.join(__dirname, '../..'),
        stdio: 'pipe'
      });
    } catch (error) {
      console.error('Build failed:', error.message);
      throw error;
    }
  });

  describe('Build Output', () => {
    test('should create development build', () => {
      expect(fs.existsSync(devBuild)).toBe(true);
    });

    test('should create production build', () => {
      expect(fs.existsSync(prodBuild)).toBe(true);
    });

    test('should create development source map', () => {
      expect(fs.existsSync(devSourceMap)).toBe(true);
    });

    test('should create production source map', () => {
      expect(fs.existsSync(prodSourceMap)).toBe(true);
    });
  });

  describe('File Sizes', () => {
    test('development build should be reasonable size', () => {
      const stats = fs.statSync(devBuild);
      const sizeInKB = stats.size / 1024;
      
      // Development build should be less than 100KB
      expect(sizeInKB).toBeLessThan(100);
      expect(sizeInKB).toBeGreaterThan(10); // But not empty
    });

    test('production build should be smaller than development', () => {
      const devStats = fs.statSync(devBuild);
      const prodStats = fs.statSync(prodBuild);
      
      // Production build should be smaller
      expect(prodStats.size).toBeLessThan(devStats.size);
    });

    test('production build should be reasonably small', () => {
      const stats = fs.statSync(prodBuild);
      const sizeInKB = stats.size / 1024;
      
      // Production build should be less than 50KB
      expect(sizeInKB).toBeLessThan(50);
      expect(sizeInKB).toBeGreaterThan(5); // But not empty
    });
  });

  describe('Build Content', () => {
    let devContent;
    let prodContent;

    beforeAll(() => {
      devContent = fs.readFileSync(devBuild, 'utf8');
      prodContent = fs.readFileSync(prodBuild, 'utf8');
    });

    test('should include UMD wrapper', () => {
      expect(devContent).toContain('typeof exports');
      expect(devContent).toContain('typeof define');
      expect(devContent).toContain('function(global, factory)');
    });

    test('should expose global LCPPerformanceTracer', () => {
      expect(devContent).toContain('LCPPerformanceTracer');
    });

    test('should include all main classes', () => {
      const classes = [
        'LCPPerformanceTracer',
        'ConfigManager',
        'LCPMonitor',
        'ResourceCollector',
        'NewRelicReporter'
      ];

      classes.forEach(className => {
        expect(devContent).toContain(className);
      });
    });

    test('production build should be minified', () => {
      // Check for minification indicators
      const devLines = devContent.split('\n').length;
      const prodLines = prodContent.split('\n').length;
      
      // Minified code should have significantly fewer lines
      expect(prodLines).toBeLessThan(devLines / 2);
    });

    test('should include banner comment', () => {
      expect(devContent).toContain('@azumaxoid/lcp-performance-tracer');
      expect(devContent).toContain('MIT');
    });

    test('should have source map references', () => {
      expect(devContent).toContain('//# sourceMappingURL=lcp-performance-tracer.js.map');
      expect(prodContent).toContain('//# sourceMappingURL=lcp-performance-tracer.min.js.map');
    });
  });

  describe('Source Maps', () => {
    test('development source map should be valid JSON', () => {
      const sourceMapContent = fs.readFileSync(devSourceMap, 'utf8');
      expect(() => JSON.parse(sourceMapContent)).not.toThrow();
    });

    test('production source map should be valid JSON', () => {
      const sourceMapContent = fs.readFileSync(prodSourceMap, 'utf8');
      expect(() => JSON.parse(sourceMapContent)).not.toThrow();
    });

    test('source maps should contain sources', () => {
      const devMap = JSON.parse(fs.readFileSync(devSourceMap, 'utf8'));
      const prodMap = JSON.parse(fs.readFileSync(prodSourceMap, 'utf8'));
      
      expect(devMap.sources).toBeDefined();
      expect(devMap.sources.length).toBeGreaterThan(0);
      expect(prodMap.sources).toBeDefined();
      expect(prodMap.sources.length).toBeGreaterThan(0);
    });
  });

  describe('Bundle Analysis', () => {
    test('should not include test files', () => {
      const content = fs.readFileSync(devBuild, 'utf8');
      expect(content).not.toContain('__tests__');
      expect(content).not.toContain('.test.');
      expect(content).not.toContain('describe(');
      expect(content).not.toContain('jest');
    });

    test('should not include Node.js specific code', () => {
      const content = fs.readFileSync(devBuild, 'utf8');
      expect(content).not.toContain('require("fs")');
      expect(content).not.toContain('require("path")');
      expect(content).not.toContain('process.env.NODE_ENV');
    });

    test('should be browser-compatible', () => {
      const content = fs.readFileSync(devBuild, 'utf8');
      // Should reference browser APIs
      expect(content).toContain('window');
      expect(content).toContain('document');
      expect(content).toContain('performance');
    });
  });
});

describe('Bundle Size Monitoring', () => {
  test('should track bundle sizes', () => {
    const output = execSync('npm run analyze:bundle', {
      cwd: path.join(__dirname, '../..'),
      encoding: 'utf8'
    });

    // Output should contain file sizes
    expect(output).toContain('lcp-performance-tracer.js');
    expect(output).toContain('lcp-performance-tracer.min.js');
  });
});