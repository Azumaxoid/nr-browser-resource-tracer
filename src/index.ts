export { LCPPerformanceTracer } from './LCPPerformanceTracer';
export { ConfigManager } from './ConfigManager';
export { LCPMonitor } from './LCPMonitor';
export { ResourceCollector } from './ResourceCollector';
export { NewRelicReporter } from './NewRelicReporter';

export type {
  LCPTracerConfig,
  LCPEntry,
  ResourceTimingData,
  NavigationTimingData,
  TraceData,
  LCPTraceEvent,
  ErrorLog,
  NewRelicGlobal
} from './types';