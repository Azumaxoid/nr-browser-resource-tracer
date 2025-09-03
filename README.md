# LCP Performance Tracer

A TypeScript library for tracking Largest Contentful Paint (LCP) performance metrics and sending trace data to New Relic when LCP exceeds configured thresholds.

## Features

- **Automatic LCP Monitoring**: Tracks LCP using Performance Observer API with fallback support
- **Resource Timing Collection**: Collects detailed timing data for critical resources
- **New Relic Integration**: Automatically sends performance data to New Relic when available
- **Configurable Thresholds**: Set custom LCP thresholds to trigger data collection
- **Sampling Support**: Control data collection frequency with configurable sampling rates
- **Zero Dependencies**: Lightweight library with no external dependencies
- **TypeScript Support**: Full TypeScript definitions included

## Installation

### NPM Installation

```bash
npm install @azumaxoid/lcp-performance-tracer
```

### Standalone Browser Usage

You can also use the library directly in the browser without any build tools. Simply include the script tag in your HTML:

```html
<!-- Latest version from GitHub -->
<script src="https://github.com/Azumaxoid/nr-browser-resource-tracer/releases/latest/download/lcp-performance-tracer.min.js"></script>

<!-- Or specific version -->
<script src="https://github.com/Azumaxoid/nr-browser-resource-tracer/releases/download/v1.0.0/lcp-performance-tracer.min.js"></script>

<!-- Or from local file -->
<script src="path/to/lcp-performance-tracer.min.js"></script>
```

## Quick Start

### Basic Usage (NPM)

```javascript
import { LCPPerformanceTracer } from '@azumaxoid/lcp-performance-tracer';

// Create and start the tracer with default settings
const tracer = LCPPerformanceTracer.autoStart();

// Or manually control the tracer
const tracer = new LCPPerformanceTracer({
  lcpThreshold: 2500,    // Trigger when LCP > 2.5 seconds
  samplingRate: 1.0,     // Sample 100% of sessions
  debug: true,           // Enable debug logging
  enabled: true,         // Enable the tracer
  maxResources: 20       // Collect up to 20 resources (default: 10)
});

tracer.start();

// Stop the tracer when needed
tracer.stop();
```

### Standalone Browser Usage

When using the standalone browser version, the library is available via the global `LCPPerformanceTracer` object:

```html
<!DOCTYPE html>
<html>
<head>
  <title>LCP Performance Monitoring</title>
  <!-- Include the standalone library -->
  <script src="https://github.com/Azumaxoid/nr-browser-resource-tracer/releases/latest/download/lcp-performance-tracer.min.js"></script>
</head>
<body>
  <h1>My Application</h1>
  
  <script>
    // The library is available as a global object
    const tracer = new LCPPerformanceTracer.LCPPerformanceTracer({
      newRelicAccountId: 'your-account-id',
      newRelicInsertKey: 'your-insert-key',
      lcpThreshold: 2500,
      enableDebug: true,
      collectResourceDetails: true
    });
    
    // Start monitoring
    tracer.start();
    
    // Access other classes if needed
    const config = new LCPPerformanceTracer.ConfigManager({
      newRelicAccountId: 'your-account-id',
      newRelicInsertKey: 'your-insert-key'
    });
    
    // Check library version
    console.log('LCP Tracer Version:', LCPPerformanceTracer.version);
  </script>
</body>
</html>
```

### TypeScript Usage

```typescript
import { LCPPerformanceTracer, LCPTracerConfig } from 'lcp-performance-tracer';

const config: LCPTracerConfig = {
  lcpThreshold: 3000,
  samplingRate: 0.5,
  debug: false,
  enabled: true
};

const tracer = new LCPPerformanceTracer(config);
tracer.start();
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `lcpThreshold` | number | 2500 | LCP threshold in milliseconds. Data is collected when LCP exceeds this value |
| `samplingRate` | number | 1.0 | Sampling rate between 0 and 1 (e.g., 0.5 = 50% of sessions) |
| `debug` | boolean | false | Enable debug logging to console |
| `enabled` | boolean | true | Enable or disable the tracer |
| `maxResources` | number | 10 | Maximum number of resources to collect (1-100) |

## How It Works

1. **LCP Monitoring**: The library uses the Performance Observer API to monitor LCP events in real-time
2. **Threshold Detection**: When LCP exceeds the configured threshold, data collection is triggered
3. **Resource Collection**: Critical resources related to the LCP element are identified and collected
4. **Data Formatting**: Performance data is formatted into a structured event
5. **New Relic Reporting**: If New Relic is available, the data is sent using `newrelic.recordCustomEvent`

## Data Collected

When LCP exceeds the threshold, the following data is collected and sent:

- **LCP Metrics**: Value, element selector, URL
- **Navigation Timing**: DOMContentLoaded, load complete, First Contentful Paint
- **Critical Resources**: All collected resources (configurable with `maxResources`)
- **Metadata**: User agent, page URL, timestamp, sampling rate

## New Event Types

The library sends two types of events to New Relic:

1. **`LCPPerformanceTrace`**: Main event with LCP and navigation data
2. **`LCPResourceTrace`**: Individual events for each collected resource

## New Relic Integration

### Prerequisites

This library requires New Relic Browser Agent to be already installed and configured in your application. The library will automatically detect and use the global `newrelic` object.

### Event Structure

#### Main LCP Event (`LCPPerformanceTrace`)
```javascript
{
  lcpValue: 3000,
  lcpElement: 'img#hero-image',
  lcpUrl: 'https://example.com/image.jpg',
  domContentLoaded: 500,
  loadComplete: 1000,
  firstContentfulPaint: 300,
  resourceCount: 15,
  userAgent: 'Mozilla/5.0...',
  url: 'https://example.com/page',
  timestamp: 1234567890,
  samplingRate: 1.0,
  traceId: 'lcp_1234567890_abc123'
}
```

#### Resource Events (`LCPResourceTrace`)
```javascript
{
  traceId: 'lcp_1234567890_abc123',
  resourceIndex: 0,
  resourceName: 'https://example.com/hero-image.jpg',
  resourceDuration: 300,
  resourceStartTime: 200,
  resourceTransferSize: 50000,
  resourceEncodedSize: 50000,
  resourceDecodedSize: 50000,
  resourceInitiatorType: 'img',
  lcpValue: 3000,
  url: 'https://example.com/page',
  timestamp: 1234567890
}
```

### Querying in New Relic

You can query the collected data in New Relic using NRQL:

#### Main LCP Analysis
```sql
SELECT average(lcpValue), percentile(lcpValue, 75) 
FROM LCPPerformanceTrace 
WHERE lcpValue > 2500 
SINCE 24 hours ago
```

#### Resource Analysis
```sql
SELECT resourceName, average(resourceDuration) 
FROM LCPResourceTrace 
WHERE resourceInitiatorType = 'img' 
FACET resourceName 
SINCE 24 hours ago
```

#### Join Events by Trace ID
```sql
SELECT lcp.lcpValue, res.resourceName, res.resourceDuration
FROM LCPPerformanceTrace lcp 
JOIN LCPResourceTrace res ON lcp.traceId = res.traceId
WHERE lcp.lcpValue > 3000
SINCE 24 hours ago
```

## API Reference

### `LCPPerformanceTracer`

#### Constructor

```typescript
new LCPPerformanceTracer(config?: LCPTracerConfig)
```

Creates a new instance of the LCP Performance Tracer.

#### Methods

##### `start(): void`

Starts monitoring LCP and collecting performance data.

##### `stop(): void`

Stops monitoring and cleans up resources.

##### `isTracerRunning(): boolean`

Returns whether the tracer is currently running.

##### `getConfig(): Readonly<Required<LCPTracerConfig>>`

Returns the current configuration.

#### Static Methods

##### `create(config?: LCPTracerConfig): LCPPerformanceTracer`

Factory method to create a new tracer instance.

##### `autoStart(config?: LCPTracerConfig): LCPPerformanceTracer`

Creates and automatically starts a tracer when the DOM is ready.

## Browser Support

- Chrome 77+
- Edge 79+
- Safari 14.1+
- Firefox 122+

The library includes fallback mechanisms for browsers that don't fully support the Performance Observer API.

## Examples

### Conditional Monitoring

```javascript
// Only monitor in production
const tracer = new LCPPerformanceTracer({
  enabled: window.location.hostname === 'production.example.com',
  lcpThreshold: 2500
});
tracer.start();
```

### Sampling Configuration

```javascript
// Sample 10% of sessions to reduce data volume
const tracer = new LCPPerformanceTracer({
  samplingRate: 0.1,
  lcpThreshold: 2500
});
tracer.start();
```

### Debug Mode

```javascript
// Enable detailed logging for troubleshooting
const tracer = new LCPPerformanceTracer({
  debug: true,
  lcpThreshold: 2500
});
tracer.start();
```

## Testing

```bash
# Run unit tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## Building

```bash
# Build the library (all formats)
npm run build

# Build standalone browser version only
npm run build:standalone

# Watch mode for standalone development
npm run build:standalone:watch

# Clean build artifacts
npm run clean

# Run linting
npm run lint

# Type checking
npm run typecheck
```

## Standalone Build

The standalone build creates UMD bundles that can be used directly in browsers:

- `dist/standalone/lcp-performance-tracer.js` - Development version (with source maps)
- `dist/standalone/lcp-performance-tracer.min.js` - Production version (minified, with source maps)

### File Sizes

- Development build: ~34KB
- Production build (minified): ~15KB
- Production build (minified + gzipped): ~5KB

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For issues and questions, please use the [GitHub issues page](https://github.com/your-org/lcp-performance-tracer/issues).