import { LCPPerformanceTracer } from './LCPPerformanceTracer';
import { ConfigManager } from './ConfigManager';
import { LCPMonitor } from './LCPMonitor';
import { ResourceCollector } from './ResourceCollector';
import { NewRelicReporter } from './NewRelicReporter';
import * as types from './types';

// Package version
const version = '1.0.0';

// Global namespace interface
interface GlobalLCPTracer {
  LCPPerformanceTracer: typeof LCPPerformanceTracer;
  ConfigManager: typeof ConfigManager;
  LCPMonitor: typeof LCPMonitor;
  ResourceCollector: typeof ResourceCollector;
  NewRelicReporter: typeof NewRelicReporter;
  types: typeof types;
  version: string;
}

// Create the global namespace object
const LCPPerformanceTracerNamespace: GlobalLCPTracer = {
  LCPPerformanceTracer,
  ConfigManager,
  LCPMonitor,
  ResourceCollector,
  NewRelicReporter,
  types,
  version
};

// Register to global scope (window in browser)
if (typeof window !== 'undefined') {
  (window as any).LCPPerformanceTracer = LCPPerformanceTracerNamespace;
}

// Export for UMD builds
export default LCPPerformanceTracerNamespace;

// Re-export all classes and types for module systems
export {
  LCPPerformanceTracer,
  ConfigManager,
  LCPMonitor,
  ResourceCollector,
  NewRelicReporter,
  types,
  version
};